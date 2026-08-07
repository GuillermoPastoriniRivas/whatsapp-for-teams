// ── Alta guiada del asistente ────────────────────────────────────
// De cuatro respuestas cerradas a un bot que contesta. Crea el agente IA con
// su perfil, arma la automatización y la publica, todo en una llamada.
//
// La estructura del grafo es determinística (ver assistant-blueprint); la IA
// solo reescribe los textos con las palabras del negocio, y si falla se usan
// los textos por defecto. Así el alta nunca queda a medias por un problema
// del modelo.

import { Logger } from '@nestjs/common';
import type { AiCompletionPort } from '../../../ports/ai-completion.port.js';
import type { TenantRepository } from '../../../../domain/repositories/tenant.repository.js';
import { EMPTY_BUSINESS_PROFILE } from '../../../../domain/value-objects/business-profile.js';
import { CreateFlowUseCase } from '../create-flow.use-case.js';
import { UpdateFlowUseCase } from '../update-flow.use-case.js';
import { PublishFlowUseCase } from '../publish-flow.use-case.js';
import { Result, ok, err } from '../../../common/result.js';
import { DomainError, FlowInvalidGraphError } from '../../../../domain/errors/domain-errors.js';
import {
  AssistantAnswers, AssistantCopy, buildAssistantGraph, defaultCopy, describeSchedule, topicsFor,
} from './assistant-blueprint.js';

export interface SetupAssistantInput extends AssistantAnswers {
  tenantId: string;
  createdByAgentId: string;
  /** Nombre del asistente; si no viene se deriva del negocio */
  assistantName?: string;
}

export interface SetupAssistantOutput {
  flowId: string;
  published: boolean;
  /** Motivo por el que no se pudo publicar, si aplica */
  publishBlockedReason: string | null;
}

export class SetupAssistantUseCase {
  private readonly logger = new Logger(SetupAssistantUseCase.name);

  constructor(
    private readonly tenantRepo: TenantRepository,
    private readonly createFlow: CreateFlowUseCase,
    private readonly updateFlow: UpdateFlowUseCase,
    private readonly publishFlow: PublishFlowUseCase,
    private readonly aiCompletion: AiCompletionPort,
  ) {}

  async execute(input: SetupAssistantInput): Promise<Result<SetupAssistantOutput, DomainError>> {
    // 1. Los datos del negocio van a la cuenta: son del negocio, no del bot,
    // y todos los nodos de IA de todos los flujos los leen de ahí.
    await this.tenantRepo.updateBusinessProfile(input.tenantId, {
      businessProfile: {
        ...EMPTY_BUSINESS_PROFILE,
        vertical: input.vertical,
        businessName: input.businessName,
        description: input.description ?? '',
        address: input.address ?? '',
        extraNotes: `Horario de atención: ${describeSchedule(input.schedule)}.`,
      },
      timezone: input.schedule.timezone,
    });

    // La conducta, en cambio, viaja adentro de los nodos de IA del grafo.
    const aiConfig = {
      name: input.assistantName?.trim() || `Asistente de ${input.businessName}`.substring(0, 60),
      behavior: {
        goal: 'Resolver la consulta del cliente y, si no podés, pasarlo con una persona del equipo.',
      },
      handoffRules: { onCustomerRequest: true, maxConsecutiveFailures: 3 },
    };

    // 2. Los textos: la IA los personaliza, pero nunca bloquea el alta.
    const copy = await this.writeCopy(input);

    // 3. El grafo y el flujo.
    const flowResult = await this.createFlow.execute({
      tenantId: input.tenantId,
      createdByAgentId: input.createdByAgentId,
      name: `Atención de ${input.businessName}`.substring(0, 80),
      description: 'Creado con el asistente de configuración',
    });
    if (!flowResult.ok) return err(flowResult.error);
    const flowId = flowResult.value.id;

    const graph = buildAssistantGraph(input, copy, aiConfig);
    const updated = await this.updateFlow.execute({
      tenantId: input.tenantId,
      flowId,
      draftGraph: graph,
    });
    if (!updated.ok) return err(updated.error);

    // 4. Publicar. Si el plan no da o algo no valida, el flujo queda en
    // borrador y se le dice por qué: nunca se pierde el trabajo.
    const publishResult = await this.publishFlow.execute(input.tenantId, flowId, input.createdByAgentId);
    if (publishResult.ok) {
      return ok({ flowId, published: true, publishBlockedReason: null });
    }

    const reason =
      publishResult.error instanceof FlowInvalidGraphError
        ? publishResult.error.errors.map((e) => e.message).join(' ')
        : publishResult.error.message;
    this.logger.warn(`Alta guiada: el flujo ${flowId} quedó en borrador — ${reason}`);
    return ok({ flowId, published: false, publishBlockedReason: reason });
  }

  /**
   * Le pide a la IA los textos del menú. Devuelve los defaults ante cualquier
   * problema (modelo caído, JSON inválido, campos faltantes).
   */
  private async writeCopy(input: SetupAssistantInput): Promise<AssistantCopy> {
    const fallbackCopy = defaultCopy(input);
    const labels = topicsFor(input.vertical)
      .filter((t) => input.topics.includes(t.id) || t.id === 'humano')
      .map((t) => t.label);

    try {
      const result = await this.aiCompletion.complete({
        systemPrompt: [
          'Escribís mensajes de WhatsApp para el bot de atención de un negocio pequeño de Latinoamérica.',
          'Tono cercano y natural, voseo rioplatense, sin sonar robótico ni corporativo.',
          'Respondé SOLO un objeto JSON con estas claves exactas:',
          '{"greeting": string, "horarios": string, "ubicacion": string, "fallback": string}',
          '- greeting: saludo + invitación a elegir una opción. Máximo 160 caracteres. Puede tener 1 emoji.',
          '- horarios: informa el horario de atención textualmente.',
          '- ubicacion: informa la dirección. Si no hay dirección, decí que se la pasás enseguida.',
          '- fallback: qué decir cuando el cliente escribe algo que no está en el menú.',
          'Sin markdown, sin explicaciones, solo el JSON.',
        ].join('\n'),
        messages: [
          {
            role: 'user',
            content: [
              `Negocio: ${input.businessName}`,
              `Rubro: ${input.vertical}`,
              input.description ? `Descripción: ${input.description}` : '',
              input.address ? `Dirección: ${input.address}` : 'Sin dirección cargada.',
              `Horario: ${describeSchedule(input.schedule)}`,
              `Opciones del menú: ${labels.join(', ')}`,
            ]
              .filter(Boolean)
              .join('\n'),
          },
        ],
        maxTokens: 500,
      });

      const parsed = parseJsonObject(result.content ?? '');
      if (!parsed) return fallbackCopy;

      return {
        greeting: str(parsed.greeting, fallbackCopy.greeting).substring(0, 1024),
        menuFooter: '',
        answers: {
          horarios: str(parsed.horarios, fallbackCopy.answers.horarios ?? '').substring(0, 4096),
          ubicacion: str(parsed.ubicacion, fallbackCopy.answers.ubicacion ?? '').substring(0, 4096),
        },
        fallbackMessage: str(parsed.fallback, fallbackCopy.fallbackMessage).substring(0, 4096),
      };
    } catch (error: any) {
      this.logger.warn(`Alta guiada: la IA no pudo redactar los textos, se usan los de base — ${error?.message}`);
      return fallbackCopy;
    }
  }
}

function str(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

/** Parseo defensivo: JSON directo → bloque con fence → primer objeto suelto. */
function parseJsonObject(raw: string): Record<string, unknown> | null {
  const tryParse = (text: string): Record<string, unknown> | null => {
    try {
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };

  return (
    tryParse(raw.trim()) ??
    tryParse(raw.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1]?.trim() ?? '') ??
    tryParse(raw.match(/\{[\s\S]*\}/)?.[0] ?? '')
  );
}
