import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Res,
  ServiceUnavailableException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiConsumes, ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../decorators/public.decorator.js';
import { CurrentAgent } from '../decorators/current-agent.decorator.js';
import type { RequestAgent } from '../decorators/current-agent.decorator.js';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js';
import {
  ListMediaQuerySchema,
  UpdateMediaRequestSchema,
  UploadMediaRequestSchema,
} from '../request-dtos/media-request.dto.js';
import type {
  ListMediaQueryDto,
  UpdateMediaRequestDto,
  UploadMediaRequestDto,
} from '../request-dtos/media-request.dto.js';
import { ListMediaUseCase } from '../../application/use-cases/media/list-media.use-case.js';
import { GetMediaUsageUseCase } from '../../application/use-cases/media/get-media-usage.use-case.js';
import { UpdateMediaUseCase } from '../../application/use-cases/media/update-media.use-case.js';
import { DeleteMediaUseCase } from '../../application/use-cases/media/delete-media.use-case.js';
import { UploadMediaUseCase } from '../../application/use-cases/media/upload-media.use-case.js';
import { MediaAccessService } from '../../application/use-cases/media/media-access.service.js';
import { serializeMediaAsset } from '../../application/use-cases/media/media-payloads.util.js';
import type { MediaAssetRepository } from '../../domain/repositories/media-asset.repository.js';
import type { ConversationRepository } from '../../domain/repositories/conversation.repository.js';
import type { MediaUrlSignerPort } from '../../application/ports/media-url-signer.port.js';
import { MediaSource } from '../../domain/enums/media-source.enum.js';
import { MAX_UPLOAD_BYTES, isUnsafeInline } from '../../domain/constants/media-constraints.js';
import { MediaGoneAtSourceError } from '../../application/ports/media-provider.port.js';

@ApiTags('Media')
@ApiBearerAuth('JWT')
@Controller('media')
export class MediaController {
  constructor(
    @Inject('ListMediaUseCase') private readonly listMedia: ListMediaUseCase,
    @Inject('GetMediaUsageUseCase') private readonly getUsage: GetMediaUsageUseCase,
    @Inject('UpdateMediaUseCase') private readonly updateMedia: UpdateMediaUseCase,
    @Inject('DeleteMediaUseCase') private readonly deleteMedia: DeleteMediaUseCase,
    @Inject('UploadMediaUseCase') private readonly uploadMedia: UploadMediaUseCase,
    @Inject('MediaAccessService') private readonly mediaAccess: MediaAccessService,
    @Inject('MediaAssetRepository') private readonly assetRepo: MediaAssetRepository,
    @Inject('ConversationRepository') private readonly conversationRepo: ConversationRepository,
    @Inject('MediaUrlSignerPort') private readonly signer: MediaUrlSignerPort,
    private readonly config: ConfigService,
  ) {}

  // ── Biblioteca e historial ──────────────────────────────

  @Get()
  @ApiOperation({
    summary: 'List media',
    description:
      'Lists the tenant media. scope=library returns the curated library, scope=history everything that went through the chats.',
  })
  async list(
    @Query(new ZodValidationPipe(ListMediaQuerySchema)) query: ListMediaQueryDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const result = await this.listMedia.execute({
      tenantId: agent.tenantId,
      agentId: agent._id,
      agentRole: agent.role,
      inLibrary: query.scope === 'all' ? undefined : query.scope === 'library',
      kinds: query.kinds,
      sources: query.sources,
      tags: query.tags,
      conversationId: query.conversationId,
      contactId: query.contactId,
      search: query.search,
      from: query.from,
      to: query.to,
      page: query.page,
      limit: query.limit,
    });

    return {
      data: result.data.map((item) => serializeMediaAsset(item.asset, item.urls)),
      meta: result.meta,
    };
  }

  @Get('usage')
  @ApiOperation({
    summary: 'Storage usage',
    description: 'Storage consumption, quota and — on the free plan — how many files were already lost.',
  })
  async usage(@CurrentAgent() agent: RequestAgent) {
    return this.getUsage.execute(agent.tenantId);
  }

  @Get('tags')
  @ApiOperation({ summary: 'List tags', description: 'All tags in use by the tenant' })
  async tags(@CurrentAgent() agent: RequestAgent) {
    return { tags: await this.assetRepo.listTags(agent.tenantId) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Media detail' })
  async detail(@Param('id') id: string, @CurrentAgent() agent: RequestAgent) {
    const asset = await this.assetRepo.findById(id);
    if (!asset || asset.tenantId !== agent.tenantId || asset.deletedAt) {
      throw new NotFoundException('El archivo no existe.');
    }
    return serializeMediaAsset(asset, await this.mediaAccess.viewUrls(asset));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update media', description: 'Save to library, rename or tag' })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateMediaRequestSchema)) body: UpdateMediaRequestDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const result = await this.updateMedia.execute({ assetId: id, tenantId: agent.tenantId, ...body });
    if (!result.ok) {
      if (result.error.code === 'MEDIA_STORAGE_NOT_CONFIGURED') {
        throw new ServiceUnavailableException(result.error.message);
      }
      if (result.error.code === 'MEDIA_LIBRARY_UNAVAILABLE') {
        throw new ForbiddenException(result.error.message);
      }
      throw new NotFoundException(result.error.message);
    }
    return serializeMediaAsset(result.value, await this.mediaAccess.viewUrls(result.value));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete media', description: 'Moves it to the trash; purged after 30 days' })
  async remove(@Param('id') id: string, @CurrentAgent() agent: RequestAgent) {
    const result = await this.deleteMedia.execute(id, agent.tenantId);
    if (!result.ok) throw new NotFoundException(result.error.message);
    return { deleted: true };
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore media', description: 'Takes it back out of the trash' })
  async restore(@Param('id') id: string, @CurrentAgent() agent: RequestAgent) {
    const result = await this.deleteMedia.restore(id, agent.tenantId);
    if (!result.ok) throw new NotFoundException(result.error.message);
    return { restored: true };
  }

  // ── Upload ──────────────────────────────────────────────

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload a file',
    description:
      'Validates against the WhatsApp limits and stores it. Without a media library the file goes straight to WhatsApp and needs a conversationId or phoneNumberId.',
  })
  async upload(
    @UploadedFile() file: { buffer: Buffer; originalname?: string; mimetype?: string } | undefined,
    @Body(new ZodValidationPipe(UploadMediaRequestSchema)) body: UploadMediaRequestDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException("Falta el archivo (campo multipart 'file').");
    }

    let phoneNumberId = body.phoneNumberId ?? null;
    let contactId: string | null = null;

    if (body.conversationId) {
      const conversation = await this.conversationRepo.findById(body.conversationId);
      if (!conversation || conversation.tenantId !== agent.tenantId) {
        throw new NotFoundException('La conversación no existe.');
      }
      phoneNumberId = conversation.phoneNumberId;
      contactId = conversation.contactId;
    }

    const result = await this.uploadMedia.execute({
      tenantId: agent.tenantId,
      agentId: agent._id,
      buffer: file.buffer,
      declaredMimeType: file.mimetype ?? null,
      filename: sanitizeFilename(file.originalname),
      phoneNumberId,
      conversationId: body.conversationId ?? null,
      contactId,
      source: body.conversationId ? MediaSource.AGENT_UPLOAD : MediaSource.LIBRARY_UPLOAD,
      inLibrary: body.inLibrary,
      title: body.title ?? null,
      tags: body.tags,
    });

    if (!result.ok) {
      if (result.error.code === 'MEDIA_STORAGE_NOT_CONFIGURED') {
        // No es culpa del cliente ni de su plan: falta configurar el entorno.
        throw new ServiceUnavailableException(result.error.message);
      }
      if (result.error.code === 'STORAGE_QUOTA_EXCEEDED' || result.error.code === 'MEDIA_LIBRARY_UNAVAILABLE') {
        throw new ForbiddenException(result.error.message);
      }
      throw new BadRequestException(result.error.message);
    }

    return serializeMediaAsset(result.value, await this.mediaAccess.viewUrls(result.value));
  }

  // ── Proxy ───────────────────────────────────────────────

  /**
   * Sirve los bytes del archivo.
   *
   * Es público a propósito: un `<img src>` no puede mandar el header
   * Authorization, así que la autorización viaja en un token firmado de corta
   * vida en la query — el mismo espíritu que una URL prefirmada de S3.
   *
   * Con storage propio y un backend que sepa firmar, el front nunca llega acá:
   * va directo a S3 y no gasta ancho de banda del servidor. Este camino es el
   * del plan free (passthrough contra Meta) y el del disco local.
   */
  @Get(':id/raw')
  @Public()
  // Más holgado que el límite global (una grilla son 40 miniaturas de golpe),
  // pero con tope: en passthrough cada request es una bajada contra Graph, y
  // ese rate limit lo comparte el número con el envío de mensajes.
  @Throttle({ short: { ttl: 1000, limit: 60 }, medium: { ttl: 60000, limit: 900 } })
  @ApiExcludeEndpoint()
  async raw(@Param('id') id: string, @Query('t') token: string, @Res() res: Response) {
    const claims = token ? this.signer.verify(token) : null;
    if (!claims || claims.assetId !== id) {
      res.status(403).send('Forbidden');
      return;
    }

    const asset = await this.assetRepo.findById(id);
    if (!asset || asset.deletedAt) {
      res.status(404).send('Not found');
      return;
    }

    let bytes;
    try {
      bytes = await this.mediaAccess.readBytes(asset, claims.variant);
    } catch (error) {
      if (error instanceof MediaGoneAtSourceError) {
        // 410: el archivo existió y se perdió. La UI lo distingue de un 404 y
        // muestra el aviso de los 30 días con el upsell.
        res.status(410).send('Gone');
        return;
      }
      throw error;
    }

    // Contenido subido por terceros: nunca con un Content-Type ejecutable ni
    // dejando que el navegador adivine el tipo.
    const safeMime = isUnsafeInline(bytes.mimeType) ? 'application/octet-stream' : bytes.mimeType;
    const disposition = claims.download || safeMime === 'application/octet-stream' ? 'attachment' : 'inline';
    const cacheSeconds = this.config.get<number>('media.browserCacheSeconds', 86400);

    res.setHeader('Content-Type', safeMime);
    res.setHeader('Content-Length', bytes.buffer.byteLength);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${encodeURIComponent(bytes.filename)}"`,
    );
    // El contenido de un asset no cambia nunca. Sin esto, cada scroll de la
    // bandeja vuelve a pegarle a Graph y termina throttleándonos el WABA.
    res.setHeader('Cache-Control', `private, max-age=${cacheSeconds}, immutable`);
    res.setHeader('ETag', `"${asset.sha256 ?? asset.id}-${claims.variant}"`);

    res.send(bytes.buffer);
  }
}

/** El nombre viene del cliente: se limpia antes de guardarlo o devolverlo. */
function sanitizeFilename(filename: string | undefined): string | null {
  if (!filename) return null;
  const base = filename.split(/[\\/]/).pop() ?? filename;
  const cleaned = base.replace(/[ -<>:"|?*]/g, '').trim();
  return cleaned.slice(0, 200) || null;
}
