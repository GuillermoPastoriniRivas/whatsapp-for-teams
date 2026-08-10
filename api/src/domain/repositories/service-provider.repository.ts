import { ServiceProvider } from '../entities/service-provider.entity.js';

export type CreateServiceProviderInput = Omit<
  ServiceProvider,
  'id' | 'createdAt' | 'updatedAt' | 'lastAssignedAt' | 'assignedCount' | 'canReceive'
>;

export interface UpdateServiceProviderInput {
  name?: string;
  phone?: string;
  services?: string[];
  active?: boolean;
  optInAt?: Date | null;
  optInNote?: string;
  notes?: string;
}

export interface ServiceProviderRepository {
  create(input: CreateServiceProviderInput): Promise<ServiceProvider>;
  findById(id: string): Promise<ServiceProvider | null>;
  findByTenantId(tenantId: string): Promise<ServiceProvider[]>;
  /** Para saber si quien escribe es un proveedor. Indexado por {tenantId, phone}. */
  findByTenantAndPhone(tenantId: string, phone: string): Promise<ServiceProvider | null>;
  update(id: string, patch: UpdateServiceProviderInput): Promise<ServiceProvider | null>;
  delete(id: string): Promise<boolean>;
  /**
   * Elige al siguiente proveedor activo del servicio y le estampa el reparto,
   * todo en una sola operación atómica: si dos clientes eligen "carpintería" a
   * la vez, dos lecturas seguidas de una escritura le darían los dos al mismo.
   *
   * Gana el que hace más tiempo que no recibe (los que nunca recibieron, primero).
   */
  claimNextForService(tenantId: string, service: string): Promise<ServiceProvider | null>;
}
