import { templateBelongsToPhone } from './template-scope.js';

describe('templateBelongsToPhone', () => {
  it('acepta la plantilla del propio número', () => {
    expect(templateBelongsToPhone({ phoneNumberId: 'p1', wabaId: 'w1' }, { id: 'p1', wabaId: 'w1' })).toBe(true);
  });

  // El caso que rompía con Meta directo: la WABA tiene dos números y la
  // plantilla quedó guardada con el que la sincronizó primero.
  it('acepta la plantilla de otro número de la misma WABA', () => {
    expect(templateBelongsToPhone({ phoneNumberId: 'p1', wabaId: 'w1' }, { id: 'p2', wabaId: 'w1' })).toBe(true);
  });

  it('rechaza la plantilla de otra WABA', () => {
    expect(templateBelongsToPhone({ phoneNumberId: 'p1', wabaId: 'w1' }, { id: 'p2', wabaId: 'w2' })).toBe(false);
  });

  // Sin WABA no hay nada que comparar: dos números sin cuenta configurada no
  // deben poder mandarse las plantillas entre sí.
  it('rechaza cuando falta la WABA, aunque falte en los dos', () => {
    expect(templateBelongsToPhone({ phoneNumberId: 'p1', wabaId: null }, { id: 'p2', wabaId: null })).toBe(false);
    expect(templateBelongsToPhone({ phoneNumberId: 'p1', wabaId: '' }, { id: 'p2', wabaId: '' })).toBe(false);
  });
});
