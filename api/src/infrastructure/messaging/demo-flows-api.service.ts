import { Injectable } from '@nestjs/common';
import type { FlowCatalogContext, WhatsAppFlowSummary } from '../../application/ports/flow-catalog.port.js';

/**
 * Provider demo: dos formularios de mentira para poder armar y simular un
 * flujo con nodo de formulario sin una WABA real detrás.
 */
@Injectable()
export class DemoFlowsApiService {
  async listFlows(_context: FlowCatalogContext): Promise<WhatsAppFlowSummary[]> {
    return [
      {
        id: 'demo-flow-turno',
        name: 'Reserva de turno (demo)',
        status: 'PUBLISHED',
        categories: ['APPOINTMENT_BOOKING'],
        hasEndpoint: false,
        screens: ['DATOS', 'CONFIRMACION'],
      },
      {
        id: 'demo-flow-contacto',
        name: 'Datos de contacto (demo)',
        status: 'PUBLISHED',
        categories: ['LEAD_GENERATION'],
        hasEndpoint: false,
        screens: ['CONTACTO'],
      },
    ];
  }
}
