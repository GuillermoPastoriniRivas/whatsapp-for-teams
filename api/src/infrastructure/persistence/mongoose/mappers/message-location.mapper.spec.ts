import mongoose, { Types } from 'mongoose';

import { messageToText } from '../../../../domain/entities/message.entity.js';
import { MessageSchema, MessageDocument } from '../schemas/message.schema.js';
import { MessageMapper } from './message.mapper.js';

/**
 * La ubicación viaja como objeto anidado (Mixed). Sin `@Prop` declarado,
 * Mongoose descarta el campo en silencio: el mensaje se guarda igual y las
 * coordenadas se pierden sin un solo error. Estos tests son la red para eso;
 * no necesitan conexión, alcanza con hidratar el modelo.
 */

const MessageModel = mongoose.model<MessageDocument>('MessageLocationSpec', MessageSchema);

const baseDoc = {
  _id: new Types.ObjectId(),
  conversationId: new Types.ObjectId(),
  direction: 'inbound',
  messageType: 'location',
  waMessageId: 'wamid.loc',
  waStatus: 'delivered',
  timestamp: new Date('2026-08-06T12:00:00.000Z'),
};

describe('persistencia de la ubicación', () => {
  it('el schema conserva las coordenadas en vez de descartarlas', () => {
    const doc = new MessageModel({
      ...baseDoc,
      location: { latitude: -34.6289739, longitude: -54.15441, name: null, address: null },
    });

    expect(doc.location).toMatchObject({ latitude: -34.6289739, longitude: -54.15441 });
  });

  it('el mapper devuelve la ubicación en la entidad de dominio', () => {
    const doc = new MessageModel({
      ...baseDoc,
      body: 'Aloe Village',
      location: {
        latitude: -34.6601,
        longitude: -54.169,
        name: 'Aloe Village',
        address: 'La Paloma, Rocha',
      },
    });

    const message = MessageMapper.toDomain(doc);

    expect(message.location).toEqual({
      latitude: -34.6601,
      longitude: -54.169,
      name: 'Aloe Village',
      address: 'La Paloma, Rocha',
    });
  });

  it('un mensaje sin ubicación la deja en null', () => {
    const doc = new MessageModel({ ...baseDoc, messageType: 'text', body: 'hola' });

    expect(MessageMapper.toDomain(doc).location).toBeNull();
  });
});

describe('messageToText', () => {
  it('describe la ubicación cuando el mensaje no tiene texto', () => {
    const text = messageToText({
      body: null,
      location: { latitude: -34.6289739, longitude: -54.15441 },
    });

    // Sin esto la IA y el nodo "Preguntar" reciben un turno vacío.
    expect(text).toBe('-34.6289739, -54.15441');
  });

  it('antepone el nombre del lugar a las coordenadas', () => {
    const text = messageToText({
      body: null,
      location: {
        latitude: -34.66,
        longitude: -54.17,
        name: 'Aloe Village',
        address: 'La Paloma',
      },
    });

    expect(text).toBe('Aloe Village, La Paloma (-34.66, -54.17)');
  });

  it('prioriza el texto que escribió el contacto', () => {
    expect(messageToText({ body: 'hola', location: null })).toBe('hola');
  });
});
