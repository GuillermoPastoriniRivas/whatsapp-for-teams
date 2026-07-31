// Conexiones (credenciales cifradas para el nodo HTTP). El secreto es
// write-only: la API jamás lo devuelve.

import type { FlowConnectionRepository } from '../../../domain/repositories/flow-connection.repository.js';
import type { FlowRepository } from '../../../domain/repositories/flow.repository.js';
import type { FlowVersionRepository } from '../../../domain/repositories/flow-version.repository.js';
import type { FlowSecretsPort } from '../../ports/flow-secrets.port.js';
import { FlowStatus } from '../../../domain/enums/flow-status.enum.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError, FlowConnectionNotFoundError, FlowConnectionInUseError } from '../../../domain/errors/domain-errors.js';

export interface ConnectionView {
  id: string;
  name: string;
  headerName: string;
  createdAt: Date;
}

export class CreateFlowConnectionUseCase {
  constructor(
    private readonly connectionRepo: FlowConnectionRepository,
    private readonly secrets: FlowSecretsPort,
  ) {}

  async execute(tenantId: string, name: string, headerName: string, secret: string): Promise<Result<ConnectionView, DomainError>> {
    const connection = await this.connectionRepo.create({
      tenantId,
      name,
      headerName,
      secretEncrypted: this.secrets.encrypt(secret),
    });
    return ok({ id: connection.id, name: connection.name, headerName: connection.headerName, createdAt: connection.createdAt });
  }
}

export class ListFlowConnectionsUseCase {
  constructor(private readonly connectionRepo: FlowConnectionRepository) {}

  async execute(tenantId: string): Promise<ConnectionView[]> {
    const connections = await this.connectionRepo.findByTenantId(tenantId);
    return connections.map((c) => ({ id: c.id, name: c.name, headerName: c.headerName, createdAt: c.createdAt }));
  }
}

export class DeleteFlowConnectionUseCase {
  constructor(
    private readonly connectionRepo: FlowConnectionRepository,
    private readonly flowRepo: FlowRepository,
    private readonly versionRepo: FlowVersionRepository,
  ) {}

  async execute(tenantId: string, connectionId: string): Promise<Result<void, DomainError>> {
    const connection = await this.connectionRepo.findById(connectionId);
    if (!connection || connection.tenantId !== tenantId) return err(new FlowConnectionNotFoundError());

    // 409 si alguna versión que todavía puede correr la referencia. Incluye
    // los flujos PAUSADOS: conservan su versión publicada y se reactivan sin
    // volver a validar, así que borrar la conexión los rompería.
    const flows = await this.flowRepo.findByTenantId(tenantId);
    const publishedIds = flows
      .filter((f) => (f.status === FlowStatus.PUBLISHED || f.status === FlowStatus.PAUSED) && f.publishedVersionId)
      .map((f) => f.publishedVersionId!);
    const versions = await this.versionRepo.findByIds(publishedIds);
    const inUse = versions.some((v) =>
      v.graph.nodes.some((n) => n.type === 'action.http' && (n.data as any)?.connectionId === connectionId),
    );
    if (inUse) return err(new FlowConnectionInUseError());

    await this.connectionRepo.delete(connectionId);
    return ok(undefined);
  }
}
