import { UpdateBusinessProfileUseCase } from './update-business-profile.use-case.js';
import type { BusinessProfileUpdate } from '../../ports/business-profile.port.js';
import type { WhatsAppBusinessProfile } from '../../../domain/entities/whatsapp-business-profile.entity.js';

const EMPTY_PROFILE: WhatsAppBusinessProfile = {
  about: null,
  address: null,
  description: null,
  email: null,
  vertical: null,
  websites: [],
  profilePictureUrl: null,
};

function setup(current: WhatsAppBusinessProfile) {
  const sent: BusinessProfileUpdate[] = [];
  const phone = {
    id: 'phone-1',
    tenantId: 'tenant-1',
    provider: 'meta',
    providerConfig: { accessToken: 'x' },
    phoneNumberId: '123',
    businessProfile: current,
  };

  const phoneRepo = {
    findById: async () => phone,
    update: async () => phone,
  } as any;

  const profileApi = {
    getProfile: async () => current,
    updateProfile: async (_ctx: unknown, update: BusinessProfileUpdate) => {
      sent.push(update);
    },
    uploadProfilePicture: async () => 'handle',
  } as any;

  return { useCase: new UpdateBusinessProfileUseCase(phoneRepo, profileApi), sent };
}

const base = { tenantId: 'tenant-1', phoneId: 'phone-1' };

describe('UpdateBusinessProfileUseCase', () => {
  // El formulario manda el perfil entero siempre. Meta contesta 131000
  // ("Something went wrong") cuando le llegan campos vacíos que no cambian
  // nada, así que solo puede viajar lo que efectivamente cambia.
  it('manda solo el campo que cambió, no el formulario entero', async () => {
    const { useCase, sent } = setup(EMPTY_PROFILE);

    const result = await useCase.execute({
      ...base,
      about: '',
      address: '',
      description: 'Hotel frente al lago',
      email: '',
      vertical: 'UNDEFINED',
      websites: [],
    });

    expect(result.ok).toBe(true);
    expect(sent).toEqual([{ description: 'Hotel frente al lago' }]);
  });

  it('no llama al proveedor cuando no cambió nada', async () => {
    const { useCase, sent } = setup({ ...EMPTY_PROFILE, description: 'Igual', vertical: 'HOTEL' });

    const result = await useCase.execute({
      ...base,
      about: '',
      description: 'Igual',
      vertical: 'HOTEL',
      websites: [],
    });

    expect(result.ok).toBe(true);
    expect(sent).toEqual([]);
  });

  // Vaciar un campo que tenía algo sí es un cambio y tiene que viajar.
  it('manda la cadena vacía para borrar un campo que tenía valor', async () => {
    const { useCase, sent } = setup({ ...EMPTY_PROFILE, email: 'hola@aloe.test' });

    await useCase.execute({ ...base, email: '' });

    expect(sent).toEqual([{ email: '' }]);
  });

  it('detecta cambios en los sitios web', async () => {
    const { useCase, sent } = setup({ ...EMPTY_PROFILE, websites: ['https://aloe.test'] });

    await useCase.execute({ ...base, websites: ['https://aloe.test', 'https://otro.test'] });

    expect(sent).toEqual([{ websites: ['https://aloe.test', 'https://otro.test'] }]);
  });

  // El handle es de un solo uso y solo llega cuando se subió una imagen nueva.
  it('manda siempre el handle de la foto', async () => {
    const { useCase, sent } = setup(EMPTY_PROFILE);

    await useCase.execute({ ...base, description: '', profilePictureHandle: 'h1' });

    expect(sent).toEqual([{ profilePictureHandle: 'h1' }]);
  });
});
