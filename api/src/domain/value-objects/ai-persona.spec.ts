import { resolveAiPersona, DEFAULT_MULTI_MESSAGE } from './ai-persona.js';
import { EMPTY_BUSINESS_PROFILE } from './business-profile.js';

// Desde ago-2026 el bot dejó de ser una entidad: su config se arma en el
// momento con el negocio (de la cuenta) y la conducta (del nodo del flujo).
// Si esto se rompe, los asistentes contestan sin saber nada del negocio o se
// caen a mitad de una conversación en curso.

const tenant = {
  businessProfile: { ...EMPTY_BUSINESS_PROFILE, businessName: 'Barbería Don Pedro', vertical: 'beauty' as const },
  timezone: 'America/Montevideo',
  businessHours: { monday: { open: '09:00', close: '18:00' } },
};

describe('persona del asistente', () => {
  it('toma el negocio de la cuenta y la conducta del nodo', () => {
    const persona = resolveAiPersona(tenant, {
      name: 'Sofía',
      behavior: { formality: 'formal', goal: 'Sacar turnos' },
    });

    expect(persona.businessProfile.businessName).toBe('Barbería Don Pedro');
    expect(persona.timezone).toBe('America/Montevideo');
    expect(persona.name).toBe('Sofía');
    expect(persona.behavior.formality).toBe('formal');
    expect(persona.behavior.goal).toBe('Sacar turnos');
  });

  it('completa con defaults lo que el nodo no define', () => {
    // Un nodo publicado hace meses puede no tener campos nuevos: un turno de
    // IA nunca debe caerse por eso.
    const persona = resolveAiPersona(tenant, {});

    expect(persona.name).toBe('Asistente');
    expect(persona.behavior.language).toBe('es');
    expect(persona.handoffRules.maxConsecutiveFailures).toBe(3);
    expect(persona.multiMessage).toEqual(DEFAULT_MULTI_MESSAGE);
  });

  it('respeta el campo `instructions` de los nodos viejos', () => {
    // Así se llamaba el texto libre del nodo "Respuesta IA" antes del cambio.
    const persona = resolveAiPersona(tenant, { instructions: 'Solo horarios y precios' });
    expect(persona.behavior.customInstructions).toBe('Solo horarios y precios');
  });

  it('la cuenta sin perfil cargado no rompe nada', () => {
    const persona = resolveAiPersona(
      { businessProfile: EMPTY_BUSINESS_PROFILE, timezone: null, businessHours: null },
      { name: 'Bot' },
    );
    expect(persona.businessProfile.businessName).toBe('');
    expect(persona.timezone).toBeNull();
  });
});
