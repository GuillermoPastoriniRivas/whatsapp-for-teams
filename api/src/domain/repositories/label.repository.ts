import { Label } from '../entities/label.entity.js';

export interface LabelRepository {
  create(label: Omit<Label, 'id' | 'createdAt'>): Promise<Label>;
  findById(id: string): Promise<Label | null>;
  findByIds(ids: string[]): Promise<Label[]>;
  findByTenantId(tenantId: string): Promise<Label[]>;
  findByTenantIdAndName(tenantId: string, name: string): Promise<Label | null>;
  update(id: string, data: Partial<Pick<Label, 'name' | 'color'>>): Promise<Label | null>;
  delete(id: string): Promise<void>;
}
