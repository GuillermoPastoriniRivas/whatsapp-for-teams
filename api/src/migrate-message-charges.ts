/**
 * Arranca la contabilidad de mensajes:
 *
 *  1. Siembra la primera rate card (si no hay ninguna).
 *  2. Reconstruye `message_charges` desde los `messages` salientes viejos.
 *
 * SOBRE EL HISTÓRICO: lo reconstruido es una **estimación**, no un dato. De los
 * mensajes viejos no se puede recuperar lo que Meta cobró de verdad (el
 * `pricing` llega una sola vez y se tiraba), ni cuándo se entregaron (no había
 * `deliveredAt`), ni la categoría que tenía la plantilla al enviarse. Por eso
 * todas esas filas quedan con `source: 'backfill'` y hay que mostrarlas siempre
 * como estimadas.
 *
 * Idempotente: `message_charges` tiene índice único por `waMessageId`, así que
 * correrlo dos veces no duplica nada.
 *
 *   npm run migrate:message-charges -- --dry-run   # muestra qué haría
 *   npm run migrate:message-charges                # aplica
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { resolveDestinationMarket } from './domain/value-objects/destination-market.js';
import { SEED_RATE_ENTRIES } from './domain/value-objects/meta-rate-cards.js';

/** Desde cuándo vale la card semilla. Meta cobra service recién desde acá. */
const SEED_EFFECTIVE_FROM = new Date('2026-10-01T00:00:00.000Z');

const BATCH = 1000;

async function seedRateCard(dryRun: boolean): Promise<void> {
  const cards = mongoose.connection.collection('rate_cards');
  const existing = await cards.countDocuments();
  if (existing > 0) {
    console.log(`= rate_cards: ya hay ${existing} card(s), no se toca nada\n`);
    return;
  }

  console.log(`+ rate_cards: sembrando ${SEED_RATE_ENTRIES.length} precios, vigentes desde ${SEED_EFFECTIVE_FROM.toISOString().slice(0, 10)}`);
  console.log('  OJO: son valores de arranque. Confirmalos contra el rate card oficial de Meta antes de mostrarle plata a un cliente.\n');
  if (dryRun) return;

  await cards.insertOne({
    name: 'Meta — arranque',
    effectiveFrom: SEED_EFFECTIVE_FROM,
    effectiveTo: null,
    currency: 'USD',
    entries: SEED_RATE_ENTRIES,
    source: 'seed',
    createdAt: new Date(),
  });
}

async function backfillCharges(dryRun: boolean): Promise<void> {
  const messages = mongoose.connection.collection('messages');
  const charges = mongoose.connection.collection('message_charges');
  const conversations = mongoose.connection.collection('conversations');
  const contacts = mongoose.connection.collection('contacts');

  const total = await messages.countDocuments({ direction: 'outbound' });
  console.log(`${total} mensajes salientes en la base${dryRun ? ' (DRY RUN, no escribe)' : ''}\n`);

  // Caché de conversaciones y contactos: un chat tiene muchos mensajes y sin
  // esto son dos lecturas por mensaje.
  const convCache = new Map<string, any>();
  const contactCache = new Map<string, any>();

  let written = 0;
  let skipped = 0;
  let orphaned = 0;

  const cursor = messages.find({ direction: 'outbound' }).batchSize(BATCH);

  for await (const msg of cursor) {
    if (!msg.waMessageId) {
      skipped++;
      continue;
    }
    if (await charges.countDocuments({ waMessageId: msg.waMessageId }, { limit: 1 })) {
      skipped++;
      continue;
    }

    const convKey = String(msg.conversationId);
    if (!convCache.has(convKey)) {
      convCache.set(convKey, await conversations.findOne({ _id: msg.conversationId }));
    }
    const conversation = convCache.get(convKey);
    if (!conversation) {
      // Sin conversación no hay tenant, y un charge sin tenant no sirve para
      // nada: no se puede atribuir ni agrupar.
      orphaned++;
      continue;
    }

    const contactKey = String(conversation.contactId);
    if (!contactCache.has(contactKey)) {
      contactCache.set(contactKey, await contacts.findOne({ _id: conversation.contactId }));
    }
    const contact = contactCache.get(contactKey);
    const market = resolveDestinationMarket(contact?.phone ?? null, contact?.bsuid ?? null);

    const isTemplate = msg.messageType === 'template';
    // `deliveredAt` no existía: se aproxima con el timestamp del envío para los
    // que llegaron a delivered/read. Es justamente por qué esto es estimación.
    const reachedDelivery = msg.waStatus === 'delivered' || msg.waStatus === 'read';

    if (!dryRun) {
      await charges.insertOne({
        waMessageId: msg.waMessageId,
        tenantId: conversation.tenantId,
        phoneNumberId: conversation.phoneNumberId,
        conversationId: msg.conversationId,
        messageId: msg._id,
        contactId: conversation.contactId,
        destinationCountry: market.country,
        destinationPrefix: market.prefix,
        sentAt: msg.timestamp,
        deliveredAt: msg.deliveredAt ?? (reachedDelivery ? msg.timestamp : null),
        failedAt: msg.failedAt ?? (msg.waStatus === 'failed' ? msg.timestamp : null),
        waErrorCode: msg.waErrorCode ?? null,
        // Los previos a ago-2026 no tienen `senderKind` y no hay forma de
        // deducirlo: `unknown` en vez de inventar una atribución.
        senderKind: msg.senderKind ?? (msg.campaignId ? 'campaign' : 'unknown'),
        campaignId: msg.campaignId ?? null,
        automationId: null,
        isTemplate,
        // Qué plantilla fue no se guardaba en el mensaje: se pierde.
        templateId: null,
        templateCategory: null,
        marketingLite: false,
        estimatedCategory: isTemplate ? 'utility' : 'service',
        freeEntryPoint: false,
        windowOpen: !isTemplate,
        meta: null,
        rate: null,
        source: 'backfill',
      });
    }
    written++;

    if (written % 5000 === 0) console.log(`  … ${written} filas`);
  }

  console.log(`\n${written} filas reconstruidas, ${skipped} ya existían, ${orphaned} sin conversación (se saltearon)`);
  console.log('Todas quedaron con source=backfill: son estimaciones, no lo que Meta cobró.');
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('Falta MONGODB_URI');

  await mongoose.connect(uri);

  await seedRateCard(dryRun);
  await backfillCharges(dryRun);

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
