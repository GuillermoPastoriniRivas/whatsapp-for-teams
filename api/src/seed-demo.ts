/**
 * Demo seed script — creates a fully populated demo tenant with realistic data.
 *
 * Usage:
 *   npm run seed:demo
 *
 * Idempotent: wipes all demo tenant data, then re-creates everything.
 *
 * Los modelos se arman con los MISMOS schemas que usa la app (no con copias
 * inline): si alguien agrega un campo al modelo real, el seed lo respeta sin
 * que haya que acordarse de actualizar este archivo.
 */

import * as bcrypt from 'bcrypt';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { connect, connection, model, Types } from 'mongoose';

import { TenantSchema } from './infrastructure/persistence/mongoose/schemas/tenant.schema.js';
import { AgentSchema } from './infrastructure/persistence/mongoose/schemas/agent.schema.js';
import { PhoneNumberSchema } from './infrastructure/persistence/mongoose/schemas/phone-number.schema.js';
import { AgentPhoneAccessSchema } from './infrastructure/persistence/mongoose/schemas/agent-phone-access.schema.js';
import { ContactSchema } from './infrastructure/persistence/mongoose/schemas/contact.schema.js';
import { ConversationSchema } from './infrastructure/persistence/mongoose/schemas/conversation.schema.js';
import { MessageSchema } from './infrastructure/persistence/mongoose/schemas/message.schema.js';
import { ConversationEventSchema } from './infrastructure/persistence/mongoose/schemas/conversation-event.schema.js';
import { ConversationNoteSchema } from './infrastructure/persistence/mongoose/schemas/conversation-note.schema.js';
import { LabelSchema } from './infrastructure/persistence/mongoose/schemas/label.schema.js';
import { ConversationLabelSchema } from './infrastructure/persistence/mongoose/schemas/conversation-label.schema.js';
import { AiAgentConfigSchema } from './infrastructure/persistence/mongoose/schemas/ai-agent-config.schema.js';
import { MessageTemplateSchema } from './infrastructure/persistence/mongoose/schemas/message-template.schema.js';
import { CampaignSchema } from './infrastructure/persistence/mongoose/schemas/campaign.schema.js';
import { CampaignRecipientSchema } from './infrastructure/persistence/mongoose/schemas/campaign-recipient.schema.js';
import { SubscriptionSchema } from './infrastructure/persistence/mongoose/schemas/subscription.schema.js';
import { BillingRecordSchema } from './infrastructure/persistence/mongoose/schemas/billing-record.schema.js';
import { AiUsageSchema } from './infrastructure/persistence/mongoose/schemas/ai-usage.schema.js';
import { FlowSchema } from './infrastructure/persistence/mongoose/schemas/flow.schema.js';
import { FlowVersionSchema } from './infrastructure/persistence/mongoose/schemas/flow-version.schema.js';
import { FlowExecutionSchema } from './infrastructure/persistence/mongoose/schemas/flow-execution.schema.js';
import { FlowNodeStatSchema } from './infrastructure/persistence/mongoose/schemas/flow-node-stat.schema.js';
import { FlowConnectionSchema } from './infrastructure/persistence/mongoose/schemas/flow-connection.schema.js';
import { ApiKeySchema } from './infrastructure/persistence/mongoose/schemas/api-key.schema.js';
import { WebhookEndpointSchema } from './infrastructure/persistence/mongoose/schemas/webhook-endpoint.schema.js';
import { WebhookDeliverySchema } from './infrastructure/persistence/mongoose/schemas/webhook-delivery.schema.js';

// ── Helpers ─────────────────────────────────────────────

function ago(minutes: number): Date {
  return new Date(Date.now() - minutes * 60 * 1000);
}

function inDays(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function inMinutes(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function dayKey(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function waId(): string {
  return `demo-${new Types.ObjectId().toHexString()}`;
}

/** La URI trae usuario y contrasena: nunca va entera a los logs. */
function safeUri(uri: string): string {
  try {
    const url = new URL(uri);
    return `${url.protocol}//${url.hostname}${url.pathname}`;
  } catch {
    return '(uri invalida)';
  }
}

// ── Main ────────────────────────────────────────────────

async function seedDemo() {
  const mongoUri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/whatsapp-teams';

  console.log(`Connecting to ${safeUri(mongoUri)}...`);
  await connect(mongoUri);
  console.log('Connected.\n');

  const Tenant = model('Tenant', TenantSchema);
  const Agent = model('Agent', AgentSchema);
  const PhoneNumber = model('PhoneNumber', PhoneNumberSchema);
  const Access = model('AgentPhoneAccess', AgentPhoneAccessSchema);
  const Contact = model('Contact', ContactSchema);
  const Conversation = model('Conversation', ConversationSchema);
  const Message = model('Message', MessageSchema);
  const ConvEvent = model('ConversationEvent', ConversationEventSchema);
  const ConvNote = model('ConversationNote', ConversationNoteSchema);
  const AiConfig = model('AiAgentConfig', AiAgentConfigSchema);
  const Label = model('Label', LabelSchema);
  const ConvLabel = model('ConversationLabel', ConversationLabelSchema);
  const Template = model('MessageTemplate', MessageTemplateSchema);
  const Campaign = model('Campaign', CampaignSchema);
  const Recipient = model('CampaignRecipient', CampaignRecipientSchema);
  const Subscription = model('Subscription', SubscriptionSchema);
  const BillingRecord = model('BillingRecord', BillingRecordSchema);
  const AiUsage = model('AiUsage', AiUsageSchema);
  const Flow = model('Flow', FlowSchema);
  const FlowVersion = model('FlowVersion', FlowVersionSchema);
  const FlowExecution = model('FlowExecution', FlowExecutionSchema);
  const FlowNodeStat = model('FlowNodeStat', FlowNodeStatSchema);
  const FlowConnection = model('FlowConnection', FlowConnectionSchema);
  const ApiKey = model('ApiKey', ApiKeySchema);
  const WebhookEndpoint = model('WebhookEndpoint', WebhookEndpointSchema);
  const WebhookDelivery = model('WebhookDelivery', WebhookDeliverySchema);

  // ── 1. Clean existing demo data ──
  const existingTenant = await Tenant.findOne({ slug: 'demo-asis-chat' });
  if (existingTenant) {
    const tid = existingTenant._id;
    console.log('Cleaning existing demo data...');

    const agents = await Agent.find({ tenantId: tid });
    const agentIds = agents.map((a) => a._id);

    // Get conversation IDs FIRST, then delete messages before conversations
    const conversations = await Conversation.find({ tenantId: tid });
    const convIds = conversations.map((c) => c._id);
    await Message.deleteMany({ conversationId: { $in: convIds } });

    // Also clean orphan messages (from previous incomplete cleanups)
    const allConvIds = (await Conversation.distinct('_id')) as Types.ObjectId[];
    const orphanResult = await Message.deleteMany({ conversationId: { $nin: allConvIds } });
    if (orphanResult.deletedCount > 0) console.log(`  Cleaned ${orphanResult.deletedCount} orphan messages`);

    await FlowExecution.deleteMany({ tenantId: tid });
    await FlowNodeStat.deleteMany({ tenantId: tid });
    await FlowVersion.deleteMany({ tenantId: tid });
    await Flow.deleteMany({ tenantId: tid });
    await FlowConnection.deleteMany({ tenantId: tid });
    await WebhookDelivery.deleteMany({ tenantId: tid });
    await WebhookEndpoint.deleteMany({ tenantId: tid });
    await ApiKey.deleteMany({ tenantId: tid });
    await ConvEvent.deleteMany({ tenantId: tid });
    await ConvNote.deleteMany({ tenantId: tid });
    await ConvLabel.deleteMany({ tenantId: tid });
    await Conversation.deleteMany({ tenantId: tid });
    await Contact.deleteMany({ tenantId: tid });
    await AiConfig.deleteMany({ tenantId: tid });
    await Label.deleteMany({ tenantId: tid });
    await Recipient.deleteMany({ tenantId: tid });
    await Campaign.deleteMany({ tenantId: tid });
    await Template.deleteMany({ tenantId: tid });
    await Subscription.deleteMany({ tenantId: tid });
    await BillingRecord.deleteMany({ tenantId: tid });
    await AiUsage.deleteMany({ tenantId: tid });
    await Access.deleteMany({ agentId: { $in: agentIds } });
    await PhoneNumber.deleteMany({ tenantId: tid });
    await Agent.deleteMany({ tenantId: tid });
    await Tenant.deleteOne({ _id: tid });

    // Clean Agenda jobs
    const db = connection.db;
    if (db) {
      await db.collection('jobs').deleteMany({ 'data.tenantId': tid.toString() });
    }

    console.log('Cleaned.\n');
  }

  // ── 2. Tenant ──
  const tenant = await Tenant.create({
    name: 'Demo asis.chat',
    slug: 'demo-asis-chat',
    isDemo: true,
  });
  const T = tenant._id;
  console.log(`+ Tenant "${tenant.name}" (${T})`);

  // ── 3. Agents ──
  const passwordHash = await bcrypt.hash('demo123', 10);

  const ana = await Agent.create({
    tenantId: T, name: 'Demo User', email: 'demo@asis.chat',
    passwordHash, role: 'admin', status: 'available', type: 'human', emailVerified: true,
  });
  const carlos = await Agent.create({
    tenantId: T, name: 'Carlos Lopez', email: 'carlos@demo.asis.chat',
    passwordHash, role: 'agent', status: 'available', type: 'human', emailVerified: true,
  });
  const lucia = await Agent.create({
    tenantId: T, name: 'Lucia Fernandez', email: 'lucia@demo.asis.chat',
    passwordHash, role: 'agent', status: 'busy', type: 'human', emailVerified: true,
  });
  const sofia = await Agent.create({
    tenantId: T, name: 'Sofia IA', email: 'sofia-ai@demo.asis.chat',
    passwordHash, role: 'agent', status: 'available', type: 'ai', emailVerified: true,
  });

  console.log(`+ 4 agents (Ana admin, Carlos, Lucia, Sofia IA)`);

  // ── 4. AI Agent Config (Sofia) ──
  await AiConfig.create({
    agentId: sofia._id,
    tenantId: T,
    businessProfile: {
      vertical: 'retail',
      businessName: 'Demo Store',
      description: 'Tienda de ropa urbana con venta minorista y mayorista.',
      address: 'Av. Santa Fe 1234, Palermo, CABA',
      paymentMethods: 'Efectivo, transferencia, tarjetas de crédito/débito',
      catalog: [
        { name: 'Remera básica (mayorista x12)', price: '$6.500 c/u', description: 'Surtido de talles S a XL' },
        { name: 'Remera oversize (mayorista x12)', price: '$8.900 c/u', description: '' },
        { name: 'Buzo canguro (mayorista x12)', price: '$8.200 c/u', description: '' },
        { name: 'Buzo oversize (mayorista x12)', price: '$9.500 c/u', description: '' },
      ],
      faqs: [
        { question: '¿Cuánto tardan los envíos?', answer: 'CABA 24-48hs, interior 3-5 días hábiles.' },
        { question: '¿Puedo devolver un producto?', answer: 'Sí, hasta 30 días con ticket de compra.' },
        { question: '¿Hacen precios mayoristas?', answer: 'Sí, a partir de 12 unidades por modelo.' },
      ],
      extraNotes: 'Horarios: Lunes a Viernes 9-18hs, Sábados 10-14hs.',
    },
    behavior: {
      language: 'es',
      formality: 'informal',
      useEmojis: true,
      goal: 'Si el cliente muestra interés mayorista, preguntá nombre, empresa y volumen aproximado. Si quiere comprar, pedí dirección de envío.',
      customInstructions: '',
    },
    handoffRules: {
      keywords: ['hablar con humano', 'agente', 'persona real', 'quiero hablar con alguien'],
      maxConsecutiveFailures: 3,
      onCustomerRequest: true,
      urgencyKeywords: ['urgente', 'reclamo', 'queja', 'problema grave'],
    },
    contextConfig: { maxHistoryMessages: 10, includeContactInfo: true },
    rateLimits: { maxMessagesPerDay: 500, maxTokensPerDay: 100000 },
    multiMessage: { enabled: true, maxBubbles: 3, interBubbleDelayMs: 1200, debounceWindowMs: 2000, debounceMaxWaitMs: 20000 },
    timezone: 'America/Argentina/Buenos_Aires',
    businessHours: {
      mon: { open: '09:00', close: '18:00' },
      tue: { open: '09:00', close: '18:00' },
      wed: { open: '09:00', close: '18:00' },
      thu: { open: '09:00', close: '18:00' },
      fri: { open: '09:00', close: '18:00' },
      sat: { open: '10:00', close: '14:00' },
      sun: null,
    },
    isActive: true,
  });
  console.log(`+ AI config for Sofia IA`);

  // ── 5. Phone Number (demo) ──
  const phone = await PhoneNumber.create({
    tenantId: T,
    provider: 'demo',
    providerConfig: {},
    wabaId: 'demo',
    phoneNumberId: 'demo-whatsapp-1',
    displayPhone: '+54 9 11 5555-0001',
    label: 'WhatsApp Demo',
    webhookSecret: 'demo-secret',
    status: 'active',
  });
  console.log(`+ Phone "${phone.label}"`);

  // ── 6. Phone access for all agents ──
  for (const agent of [ana, carlos, lucia, sofia]) {
    await Access.create({ agentId: agent._id, phoneNumberId: phone._id });
  }
  console.log(`+ Phone access for 4 agents`);

  // ── 7. Contacts ──
  const contacts = await Contact.insertMany([
    { tenantId: T, phone: '5491155551001', name: 'Maria Gonzalez', company: 'Tienda Ropa BA', customFields: { direccion: 'Palermo, CABA', presupuesto: '$35.600' }, lastSeenAt: ago(30) },
    { tenantId: T, phone: '5491155551002', name: 'Juan Rodriguez', notes: 'Cliente frecuente', lastSeenAt: ago(15) },
    { tenantId: T, phone: '5491155551003', name: 'Valentina Ramirez', email: 'vale@email.com', customFields: { talle: 'S', interes: 'buzos y camperas' }, lastSeenAt: ago(5) },
    { tenantId: T, phone: '5491155551004', name: 'Diego Torres', company: 'Torres Electronica', lastSeenAt: ago(3) },
    { tenantId: T, phone: '5491155551005', name: 'Camila Herrera', lastSeenAt: ago(20) },
    { tenantId: T, phone: '5491155551006', name: 'Sebastian Morales', company: 'Morales y Cia', lastSeenAt: ago(1440) },
    { tenantId: T, phone: '5491155551007', name: 'Isabella Acosta', email: 'isa.acosta@gmail.com', lastSeenAt: ago(4320) },
    { tenantId: T, phone: '5491155551008', name: 'Mateo Vargas', notes: 'Consulto por mayoreo', customFields: { tipo_cliente: 'mayorista', productos: 'remeras y buzos', cantidad_minima: '12 unidades' }, lastSeenAt: ago(60) },
    { tenantId: T, phone: '5491155551009', name: 'Florencia Diaz', email: 'florencia@tiendacba.com', company: '3 sucursales en Cordoba', customFields: { ciudad: 'Cordoba', volumen_mensual: '200 unidades', tipo_cliente: 'mayorista premium' }, lastSeenAt: ago(25) },
    // Contactos de la campana: uno respondio, otro todavia no
    { tenantId: T, phone: '5491155551010', name: 'Lucas Benitez', customFields: { origen: 'campana bienvenida' }, lastSeenAt: ago(95) },
    { tenantId: T, phone: '5491155551011', name: 'Agustina Rossi', customFields: { origen: 'campana bienvenida' }, lastSeenAt: ago(180) },
    // Contacto sin asignar, para que la cola de "Sin asignar" tenga trabajo
    { tenantId: T, phone: '5491155551012', name: 'Nicolas Peralta', lastSeenAt: ago(2) },
  ]);
  console.log(`+ ${contacts.length} contacts`);

  const [maria, juan, valentina, diego, camila, sebastian, _isabella, _mateo, florencia, lucas, agustina, nicolas] = contacts;

  // ── 8. Conversations & Messages ──

  // Helper to create messages
  async function createMessages(
    convId: Types.ObjectId,
    msgs: {
      dir: 'inbound' | 'outbound';
      body: string;
      minutesAgo: number;
      agentId?: string;
      agentName?: string;
      type?: string;
      campaignId?: Types.ObjectId;
      /** Botones/lista que dibuja la burbuja saliente */
      interactivePayload?: Record<string, unknown>;
      /** Id del boton/fila que toco el cliente ('fl:<nodo>:<idx>') */
      interactiveReplyId?: string;
      location?: { latitude: number; longitude: number; name?: string; address?: string };
    }[],
  ) {
    const docs = msgs.map((m) => ({
      conversationId: convId,
      direction: m.dir,
      messageType: m.type ?? 'text',
      body: m.body,
      waMessageId: waId(),
      waStatus: m.dir === 'outbound' ? 'delivered' : 'read',
      timestamp: ago(m.minutesAgo),
      senderAgentId: m.agentId ?? null,
      senderAgentName: m.agentName ?? null,
      campaignId: m.campaignId ?? null,
      interactivePayload: m.interactivePayload ?? null,
      interactiveReplyId: m.interactiveReplyId ?? null,
      location: m.location ?? null,
    }));
    await Message.insertMany(docs);
  }

  // --- Conv 1: Maria → Sofia IA atiende, handoff a Carlos que sigue ---
  const conv1 = await Conversation.create({
    tenantId: T, phoneNumberId: phone._id, contactId: maria._id,
    agentId: carlos._id, status: 'active',
    lastMessageAt: ago(15), lastInboundAt: ago(20),
    summary: 'Cliente interesada en remera oversize negra M ($12.500). Pidio hablar con humano para asesoramiento de combinaciones. Carlos armo look completo por $35.600. Cliente quiere comprar, se le paso link de MercadoPago.',
  });
  await createMessages(conv1._id, [
    { dir: 'inbound', body: 'Hola! Queria saber si tienen la remera oversize en talle M', minutesAgo: 120 },
    { dir: 'outbound', body: 'Hola Maria! Si, tenemos la remera oversize en talle M. La tenemos en negro, blanco y verde. Cual te interesa?', minutesAgo: 119, agentId: sofia._id.toString(), agentName: 'Sofia IA' },
    { dir: 'inbound', body: 'La negra! Cuanto sale?', minutesAgo: 110 },
    { dir: 'outbound', body: 'La remera oversize negra en talle M sale $12.500. Hacemos envios a todo CABA en 24-48hs. Queres que te pase las opciones de pago?', minutesAgo: 109, agentId: sofia._id.toString(), agentName: 'Sofia IA' },
    { dir: 'inbound', body: 'Si! Pero quiero hablar con alguien para que me asesore sobre combinaciones', minutesAgo: 65 },
    { dir: 'outbound', body: 'Entendido! Te derivo con un miembro del equipo para que te asesore. En unos minutos se va a comunicar con vos.', minutesAgo: 64, agentId: sofia._id.toString(), agentName: 'Sofia IA' },
    { dir: 'outbound', body: 'Hola Maria! Soy Carlos. Vi que te interesa la remera oversize negra. Te queda genial con un jean mom o una falda midi. Queres que te arme un combo?', minutesAgo: 55, agentId: carlos._id.toString(), agentName: 'Carlos Lopez' },
    { dir: 'inbound', body: 'Siii! Armame un look completo', minutesAgo: 50 },
    { dir: 'outbound', body: 'Dale! Te armo esto:\n- Remera oversize negra M: $12.500\n- Jean mom celeste S: $18.900\n- Cinturon trenzado: $4.200\nTotal: $35.600 con envio gratis a CABA', minutesAgo: 40, agentId: carlos._id.toString(), agentName: 'Carlos Lopez' },
    { dir: 'inbound', body: 'Me encanta! Lo quiero. Como pago?', minutesAgo: 20 },
    { dir: 'outbound', body: 'Te paso el link de pago por MercadoPago. Aceptamos tarjeta y transferencia. El envio te llega en 24-48hs!', minutesAgo: 15, agentId: carlos._id.toString(), agentName: 'Carlos Lopez' },
  ]);

  // --- Conv 2: Juan → active, assigned to Carlos (order tracking, frustrated) ---
  // Termina con dos mensajes del cliente sin leer: es el caso que muestra el badge.
  const conv2 = await Conversation.create({
    tenantId: T, phoneNumberId: phone._id, contactId: juan._id,
    agentId: carlos._id, status: 'active',
    lastMessageAt: ago(10), lastInboundAt: ago(10),
    unreadCount: 2,
  });
  await createMessages(conv2._id, [
    { dir: 'inbound', body: 'Buenas, hice un pedido hace 5 dias y todavia no llego. Numero de orden: #4521', minutesAgo: 45 },
    { dir: 'outbound', body: 'Hola Juan! Dejame chequear el estado de tu pedido', minutesAgo: 40, agentId: carlos._id.toString(), agentName: 'Carlos Lopez' },
    { dir: 'outbound', body: 'Tu pedido #4521 fue despachado el lunes. Segun el tracking esta en el centro de distribucion de Correo Argentino. Deberia llegar hoy o manana', minutesAgo: 35, agentId: carlos._id.toString(), agentName: 'Carlos Lopez' },
    { dir: 'inbound', body: 'Me dijeron lo mismo la semana pasada...', minutesAgo: 15 },
    { dir: 'inbound', body: 'Ya estoy un poco cansado la verdad', minutesAgo: 10 },
  ]);

  // --- Conv 3: Valentina → Sofia IA atiende (pricing inquiry, fully resolved by AI) ---
  const conv3 = await Conversation.create({
    tenantId: T, phoneNumberId: phone._id, contactId: valentina._id,
    agentId: sofia._id, status: 'active',
    lastMessageAt: ago(3), lastInboundAt: ago(5),
    summary: 'Cliente consulta descuentos de la semana. Interesada en buzos talle S. Se le informaron 3 modelos con precios y descuento 20%.',
  });
  await createMessages(conv3._id, [
    { dir: 'inbound', body: 'Hola, buenos dias! Vi en Instagram que tienen descuentos esta semana', minutesAgo: 8 },
    { dir: 'outbound', body: 'Hola Valentina! Si, esta semana tenemos 20% de descuento en buzos y camperas. Queres que te pase los precios?', minutesAgo: 7, agentId: sofia._id.toString(), agentName: 'Sofia IA' },
    { dir: 'inbound', body: 'Sii! Queria saber los precios de los buzos. Tienen talle S?', minutesAgo: 5 },
    { dir: 'outbound', body: 'Tenemos 3 modelos en talle S:\n- Buzo basico: $9.800 (con dto: $7.840)\n- Buzo canguro: $11.500 (con dto: $9.200)\n- Buzo oversize: $13.200 (con dto: $10.560)\nTodos con envio gratis a CABA!', minutesAgo: 3, agentId: sofia._id.toString(), agentName: 'Sofia IA' },
  ]);

  // --- Conv 4: Diego → Sofia IA atiende (technical question) ---
  const conv4 = await Conversation.create({
    tenantId: T, phoneNumberId: phone._id, contactId: diego._id,
    agentId: sofia._id, status: 'active',
    lastMessageAt: ago(1), lastInboundAt: ago(3),
  });
  await createMessages(conv4._id, [
    { dir: 'inbound', body: 'Hola, necesito saber las especificaciones tecnicas del parlante bluetooth que tienen publicado', minutesAgo: 4 },
    { dir: 'outbound', body: 'Hola Diego! El parlante bluetooth tiene las siguientes especificaciones:\n- Bluetooth 5.3\n- Bateria: 12hs de reproduccion\n- Potencia: 20W\n- Resistencia: IPX7 (sumergible hasta 1m)\n- Peso: 540g\nQueres saber algo mas?', minutesAgo: 3, agentId: sofia._id.toString(), agentName: 'Sofia IA' },
    { dir: 'inbound', body: 'Es resistente al agua? Lo necesito para la pileta', minutesAgo: 2 },
    { dir: 'outbound', body: 'Si! Tiene certificacion IPX7, eso significa que aguanta sumergido en agua hasta 1 metro durante 30 minutos. Ideal para la pileta o la ducha. Sale $15.900, te interesa?', minutesAgo: 1, agentId: sofia._id.toString(), agentName: 'Sofia IA' },
  ]);

  // --- Conv 5: Camila → Sofia IA atiende (returns policy) ---
  const conv5 = await Conversation.create({
    tenantId: T, phoneNumberId: phone._id, contactId: camila._id,
    agentId: sofia._id, status: 'active',
    lastMessageAt: ago(18), lastInboundAt: ago(20),
    summary: 'Cliente quiere cambiar campera por talle incorrecto. Se le explico proceso de cambio y devolucion. Horarios y requisitos informados.',
  });
  await createMessages(conv5._id, [
    { dir: 'inbound', body: 'Hola, compre una campera la semana pasada y me queda grande. Puedo cambiarla?', minutesAgo: 45 },
    { dir: 'outbound', body: 'Hola Camila! Si, podes hacer el cambio dentro de los 30 dias desde la compra. Necesitas tener el ticket de compra. Queres que te explique el proceso?', minutesAgo: 44, agentId: sofia._id.toString(), agentName: 'Sofia IA' },
    { dir: 'inbound', body: 'Si dale, como hago?', minutesAgo: 40 },
    { dir: 'outbound', body: 'Es muy simple:\n1. Acercate a nuestra sucursal con la campera y el ticket\n2. Elegí el talle correcto\n3. Si hay diferencia de precio, se ajusta en el momento\n\nNuestro horario es Lunes a Viernes de 9 a 18hs y Sabados de 10 a 14hs', minutesAgo: 39, agentId: sofia._id.toString(), agentName: 'Sofia IA' },
    { dir: 'inbound', body: 'Y si quiero que me devuelvan la plata en vez de cambiar?', minutesAgo: 25 },
    { dir: 'outbound', body: 'Tambien se puede! La devolucion se procesa en 5-7 dias habiles al mismo medio de pago que usaste. Solo necesitas el ticket y el producto en buen estado con las etiquetas', minutesAgo: 18, agentId: sofia._id.toString(), agentName: 'Sofia IA' },
  ]);

  // --- Conv 6: Sebastian → shipping issue atendido por Sofia IA + Ana ---
  const conv6 = await Conversation.create({
    tenantId: T, phoneNumberId: phone._id, contactId: sebastian._id,
    agentId: ana._id, status: 'active',
    lastMessageAt: ago(1440), lastInboundAt: ago(1445),
  });
  await createMessages(conv6._id, [
    { dir: 'inbound', body: 'Hola, me llego el pedido equivocado. Pedi zapatillas talle 42 y me mandaron talle 38', minutesAgo: 1500 },
    { dir: 'outbound', body: 'Hola Sebastian! Lamento el inconveniente. Te voy a derivar con un agente para que te solucione esto lo antes posible.', minutesAgo: 1498, agentId: sofia._id.toString(), agentName: 'Sofia IA' },
    { dir: 'outbound', body: 'Hola Sebastian! Disculpa por el error. Te vamos a mandar el talle correcto por envio express sin costo', minutesAgo: 1490, agentId: ana._id.toString(), agentName: 'Demo User' },
    { dir: 'inbound', body: 'Y que hago con las que me llegaron?', minutesAgo: 1450 },
    { dir: 'outbound', body: 'Un cadete las pasa a buscar manana entre 10 y 14hs. No te preocupes por nada, nosotros nos encargamos!', minutesAgo: 1445, agentId: ana._id.toString(), agentName: 'Demo User' },
  ]);

  // --- Conv 7: Isabella → Sofia IA (horarios y ubicacion) ---
  // Cierra con una ubicacion compartida: es el unico lugar del demo donde se
  // ve el mapa que dibuja el inbox para los mensajes de tipo location.
  const conv7 = await Conversation.create({
    tenantId: T, phoneNumberId: phone._id, contactId: contacts[6]._id,
    agentId: sofia._id, status: 'active',
    lastMessageAt: ago(5), lastInboundAt: ago(6),
  });
  await createMessages(conv7._id, [
    { dir: 'inbound', body: 'Hola! Donde queda el local? Y a que hora abren?', minutesAgo: 12 },
    { dir: 'outbound', body: 'Hola Isabella! Nuestro local queda en Av. Santa Fe 1234, Palermo. El horario es Lunes a Viernes de 9 a 18hs y Sabados de 10 a 14hs. Te esperamos!', minutesAgo: 11, agentId: sofia._id.toString(), agentName: 'Sofia IA' },
    { dir: 'inbound', body: 'Tienen estacionamiento?', minutesAgo: 10 },
    { dir: 'outbound', body: 'No tenemos estacionamiento propio, pero hay un parking a media cuadra en Av. Santa Fe 1250. Los sabados suele haber lugar en la calle tambien.', minutesAgo: 8, agentId: sofia._id.toString(), agentName: 'Sofia IA' },
    {
      dir: 'inbound', type: 'location', body: 'Casa: Thames 1500',
      minutesAgo: 6,
      location: { latitude: -34.5875, longitude: -58.4302, name: 'Casa', address: 'Thames 1500, Palermo, CABA' },
    },
    { dir: 'outbound', body: 'Genial, estas a 12 cuadras del local 🙌 Si preferis, te lo mandamos a domicilio: el envio a Palermo es gratis y llega en 24hs.', minutesAgo: 5, agentId: sofia._id.toString(), agentName: 'Sofia IA' },
  ]);

  // --- Conv 8: Mateo → Sofia IA (mayoreo inquiry) ---
  const conv8 = await Conversation.create({
    tenantId: T, phoneNumberId: phone._id, contactId: contacts[7]._id,
    agentId: sofia._id, status: 'active',
    lastMessageAt: ago(50), lastInboundAt: ago(55),
    summary: 'Consulta mayorista. Tiene local, necesita remeras y buzos surtido S-XL. Se le paso lista de precios mayoristas (x12 unidades). Quedo en confirmar.',
  });
  await createMessages(conv8._id, [
    { dir: 'inbound', body: 'Buen dia, queria consultar si hacen precios por cantidad. Tengo un local y necesito remeras y buzos', minutesAgo: 60 },
    { dir: 'outbound', body: 'Hola Mateo! Si, trabajamos con precios mayoristas a partir de 12 unidades por modelo. Queres que te pase la lista de precios mayorista?', minutesAgo: 59, agentId: sofia._id.toString(), agentName: 'Sofia IA' },
    { dir: 'inbound', body: 'Dale si, pasame la lista. Necesito surtido de talles S a XL', minutesAgo: 55 },
    { dir: 'outbound', body: 'Precios mayoristas (x12 unidades):\n- Remera basica: $6.500 c/u\n- Remera oversize: $8.900 c/u\n- Buzo canguro: $8.200 c/u\n- Buzo oversize: $9.500 c/u\nIncluye surtido de talles S a XL. Envio gratis a CABA, interior consultar.', minutesAgo: 54, agentId: sofia._id.toString(), agentName: 'Sofia IA' },
    { dir: 'inbound', body: 'Bien, voy a revisar y te confirmo. Gracias!', minutesAgo: 52 },
    { dir: 'outbound', body: 'Perfecto Mateo! Cuando quieras confirmar escribime y coordinamos. Tambien podemos armar un pedido personalizado si necesitas.', minutesAgo: 50, agentId: sofia._id.toString(), agentName: 'Sofia IA' },
  ]);

  // --- Conv 9: Florencia → Sofia IA (lead qualification flow — showcases goals + data collection) ---
  const conv9 = await Conversation.create({
    tenantId: T, phoneNumberId: phone._id, contactId: florencia._id,
    agentId: sofia._id, status: 'active',
    lastMessageAt: ago(22), lastInboundAt: ago(25),
    summary: 'Lead mayorista calificado. Florencia tiene 3 sucursales en Cordoba, necesita 200 unidades/mes de remeras y buzos. Se le paso lista de precios premium. Pidio email para seguir por ahi.',
  });
  await createMessages(conv9._id, [
    { dir: 'inbound', body: 'Hola! Vi que hacen ropa por mayor. Me interesa para mi tienda', minutesAgo: 35 },
    { dir: 'outbound', body: 'Hola Florencia! Si, trabajamos con mayoristas. Contame, que tipo de productos necesitas?', minutesAgo: 34, agentId: sofia._id.toString(), agentName: 'Sofia IA' },
    { dir: 'inbound', body: 'Necesito remeras y buzos. Tengo 3 sucursales en Cordoba', minutesAgo: 32 },
    { dir: 'outbound', body: 'Genial! Para darte los mejores precios, me contas que cantidad aproximada necesitarias por mes?', minutesAgo: 31, agentId: sofia._id.toString(), agentName: 'Sofia IA' },
    { dir: 'inbound', body: 'Unas 200 unidades por mes masomenos', minutesAgo: 29 },
    { dir: 'outbound', body: 'Excelente! Con ese volumen tenemos precios mayoristas premium. Te paso la lista:\n- Remera basica: $5.800 c/u\n- Remera oversize: $7.900 c/u\n- Buzo canguro: $7.200 c/u\n- Buzo oversize: $8.500 c/u\nSurtido de talles S a XL. Envio a Cordoba incluido para pedidos de 200+ unidades.', minutesAgo: 28, agentId: sofia._id.toString(), agentName: 'Sofia IA' },
    { dir: 'inbound', body: 'Muy buenos precios! Pasame tu email asi te mando los datos de facturacion', minutesAgo: 25 },
    { dir: 'outbound', body: 'El mail de ventas mayoristas es ventas@tienda.com. Tambien te podemos mandar un catalogo completo por ahi. Cualquier cosa escribime!', minutesAgo: 22, agentId: sofia._id.toString(), agentName: 'Sofia IA' },
  ]);

  // --- Conv 10: Nicolas → sin asignar, con un mensaje sin leer (cola de entrada) ---
  const conv10 = await Conversation.create({
    tenantId: T, phoneNumberId: phone._id, contactId: nicolas._id,
    agentId: null, status: 'unassigned',
    lastMessageAt: ago(2), lastInboundAt: ago(2),
    unreadCount: 1,
  });
  await createMessages(conv10._id, [
    { dir: 'inbound', body: 'Hola! Vi una campera en la vidriera del local, la tienen en talle L?', minutesAgo: 2 },
  ]);

  console.log(`+ 10 conversations with messages`);

  // ── 9. Templates ──
  // Cubren los tres estados que el usuario ve en la lista (aprobada, en
  // revision, rechazada) y las tres categorias de Meta.
  const templates = await Template.insertMany([
    {
      tenantId: T, phoneNumberId: phone._id, wabaId: 'demo',
      metaTemplateId: 'demo-tpl-bienvenida', name: 'bienvenida_nuevo_cliente',
      language: 'es_AR', category: 'utility', status: 'approved', qualityScore: 'green',
      components: [
        { type: 'BODY', text: 'Hola {{1}}! Gracias por escribirnos. Somos Demo Store y te vamos a estar acompanando por acá. En que podemos ayudarte?' },
        { type: 'FOOTER', text: 'Demo Store' },
      ],
      lastSyncedAt: ago(120),
    },
    {
      tenantId: T, phoneNumberId: phone._id, wabaId: 'demo',
      metaTemplateId: 'demo-tpl-promo', name: 'promo_temporada',
      language: 'es_AR', category: 'marketing', status: 'approved', qualityScore: 'green',
      components: [
        { type: 'HEADER', format: 'TEXT', text: 'Nueva temporada' },
        { type: 'BODY', text: 'Hola {{1}}! Arrancó la nueva temporada con {{2}} de descuento en toda la coleccion. Te esperamos!' },
        { type: 'FOOTER', text: 'Respondé BAJA para no recibir mas promociones' },
        { type: 'BUTTONS', buttons: [{ type: 'URL', text: 'Ver catalogo', url: 'https://asis.chat/demo' }] },
      ],
      lastSyncedAt: ago(120),
    },
    {
      tenantId: T, phoneNumberId: phone._id, wabaId: 'demo',
      metaTemplateId: 'demo-tpl-carrito', name: 'recordatorio_carrito',
      language: 'es_AR', category: 'marketing', status: 'approved', qualityScore: 'yellow',
      components: [
        { type: 'BODY', text: 'Hola {{1}}, dejaste productos en el carrito. Los guardamos por 48hs por si querés terminar la compra.' },
      ],
      lastSyncedAt: ago(240),
    },
    {
      tenantId: T, phoneNumberId: phone._id, wabaId: 'demo',
      metaTemplateId: 'demo-tpl-envio', name: 'aviso_envio',
      language: 'es_AR', category: 'utility', status: 'approved', qualityScore: 'green',
      components: [
        { type: 'BODY', text: 'Hola {{1}}! Tu pedido {{2}} ya salio de nuestro deposito y llega en 24-48hs.' },
      ],
      lastSyncedAt: ago(240),
    },
    {
      tenantId: T, phoneNumberId: phone._id, wabaId: 'demo',
      metaTemplateId: null, name: 'promo_black_friday',
      language: 'es_AR', category: 'marketing', status: 'pending', qualityScore: 'unknown',
      components: [
        { type: 'BODY', text: 'Hola {{1}}! Black Friday: 40% en toda la tienda solo por hoy.' },
      ],
    },
    {
      tenantId: T, phoneNumberId: phone._id, wabaId: 'demo',
      metaTemplateId: null, name: 'descuento_ultimo_momento',
      language: 'es_AR', category: 'marketing', status: 'rejected', qualityScore: 'unknown',
      components: [
        { type: 'BODY', text: 'ULTIMA OPORTUNIDAD!!! COMPRA YA!!! No te lo pierdas!!!' },
      ],
      rejectionReason: 'El contenido no cumple las politicas de Meta: uso excesivo de mayusculas y lenguaje promocional agresivo.',
    },
  ]);
  const [tplBienvenida, tplPromo, tplCarrito, tplEnvio] = templates;
  console.log(`+ ${templates.length} templates (aprobadas, en revision y rechazada)`);

  // ── 10. Campaigns ──
  const audienceAll = { type: 'contactIds', contactIds: contacts.slice(0, 9).map((c) => c._id.toString()) };

  // Campana 1: completada, con destinatarios y metricas reales.
  const campaignDone = await Campaign.create({
    tenantId: T, phoneNumberId: phone._id, templateId: tplBienvenida._id,
    name: 'Bienvenida clientes nuevos',
    status: 'completed',
    variableMappings: [{ component: 'body', position: '1', source: 'contact_field', value: 'name' }],
    audience: audienceAll,
    scheduledAt: null,
    startedAt: ago(200), completedAt: ago(195),
    throttle: { messagesPerSecond: 10, batchSize: 50 },
    replyWindowHours: 72,
    counts: { total: 9, queued: 0, sent: 9, delivered: 9, read: 7, failed: 0, skipped: 0, replied: 3 },
    createdByAgentId: ana._id,
  });

  // Campana 2: completada con un fallo y un salteado, para que se vea que
  // la pantalla tambien muestra los errores.
  const campaignMixed = await Campaign.create({
    tenantId: T, phoneNumberId: phone._id, templateId: tplCarrito._id,
    name: 'Recordatorio carrito abandonado',
    status: 'completed',
    variableMappings: [{ component: 'body', position: '1', source: 'contact_field', value: 'name' }],
    audience: audienceAll,
    scheduledAt: null,
    startedAt: ago(2880), completedAt: ago(2875),
    throttle: { messagesPerSecond: 10, batchSize: 50 },
    replyWindowHours: 72,
    counts: { total: 9, queued: 0, sent: 7, delivered: 6, read: 4, failed: 1, skipped: 1, replied: 1 },
    createdByAgentId: ana._id,
  });

  // Campana 3: borrador — el visitante puede abrirla, editarla y arrancarla.
  const campaignDraft = await Campaign.create({
    tenantId: T, phoneNumberId: phone._id, templateId: tplPromo._id,
    name: 'Promo primavera (borrador)',
    status: 'draft',
    variableMappings: [
      { component: 'body', position: '1', source: 'contact_field', value: 'name' },
      { component: 'body', position: '2', source: 'static', value: '25%' },
    ],
    audience: audienceAll,
    scheduledAt: null,
    startedAt: null, completedAt: null,
    throttle: { messagesPerSecond: 10, batchSize: 50 },
    replyWindowHours: 72,
    counts: { total: 0, queued: 0, sent: 0, delivered: 0, read: 0, failed: 0, skipped: 0, replied: 0 },
    createdByAgentId: ana._id,
  });
  console.log(`+ 3 campaigns (2 completadas + 1 borrador para arrancar en vivo)`);

  // ── 11. Campaign recipients ──
  const doneStatuses: Array<{ status: string; read: boolean; replied: boolean }> = [
    { status: 'read', read: true, replied: true },
    { status: 'read', read: true, replied: true },
    { status: 'read', read: true, replied: true },
    { status: 'read', read: true, replied: false },
    { status: 'read', read: true, replied: false },
    { status: 'read', read: true, replied: false },
    { status: 'read', read: true, replied: false },
    { status: 'delivered', read: false, replied: false },
    { status: 'delivered', read: false, replied: false },
  ];

  await Recipient.insertMany(
    contacts.slice(0, 9).map((contact, i) => {
      const row = doneStatuses[i];
      return {
        campaignId: campaignDone._id, tenantId: T, contactId: contact._id,
        phone: contact.phone, bsuid: contact.bsuid ?? null,
        resolvedVariables: { 'body.1': contact.name },
        status: row.status,
        attemptCount: 1,
        waMessageId: waId(),
        sentAt: ago(200), deliveredAt: ago(199),
        readAt: row.read ? ago(198) : null,
        repliedAt: row.replied ? ago(190) : null,
        replyWindowExpiresAt: inDays(1),
      };
    }),
  );

  await Recipient.insertMany(
    contacts.slice(0, 9).map((contact, i) => {
      // El ultimo falla y el anteultimo se saltea por falta de variables.
      const failed = i === 8;
      const skipped = i === 7;
      return {
        campaignId: campaignMixed._id, tenantId: T, contactId: contact._id,
        phone: contact.phone, bsuid: contact.bsuid ?? null,
        resolvedVariables: skipped ? {} : { 'body.1': contact.name },
        status: failed ? 'failed' : skipped ? 'skipped' : i < 4 ? 'read' : 'delivered',
        attemptCount: failed ? 3 : 1,
        waMessageId: failed || skipped ? null : waId(),
        sentAt: failed || skipped ? null : ago(2880),
        deliveredAt: failed || skipped ? null : ago(2879),
        readAt: !failed && !skipped && i < 4 ? ago(2878) : null,
        repliedAt: i === 0 ? ago(2870) : null,
        failureCode: failed ? '131026' : null,
        failureReason: failed
          ? 'El numero no tiene WhatsApp o no puede recibir mensajes'
          : skipped
            ? 'Missing variables: body.1'
            : null,
      };
    }),
  );
  console.log(`+ 18 campaign recipients`);

  // ── 12. Conversaciones nacidas de la campana ──
  // origin 'campaign' + hasReplied distingue quien contesto un envio masivo:
  // es el embudo que muestra la pantalla de campanas.
  const convCampaignReplied = await Conversation.create({
    tenantId: T, phoneNumberId: phone._id, contactId: lucas._id,
    agentId: sofia._id, status: 'active',
    lastMessageAt: ago(90), lastInboundAt: ago(90),
    origin: 'campaign', hasReplied: true, repliedAt: ago(95),
    unreadCount: 1,
  });
  await createMessages(convCampaignReplied._id, [
    { dir: 'outbound', body: 'Hola Lucas! Gracias por escribirnos. Somos Demo Store y te vamos a estar acompanando por acá. En que podemos ayudarte?', minutesAgo: 200, type: 'template', agentId: ana._id.toString(), agentName: 'Demo User', campaignId: campaignDone._id },
    { dir: 'inbound', body: 'Hola! Justo estaba buscando una campera de abrigo, tienen?', minutesAgo: 95 },
    { dir: 'outbound', body: 'Hola Lucas! Si, tenemos camperas de abrigo desde $24.900. Que talle buscas?', minutesAgo: 93, agentId: sofia._id.toString(), agentName: 'Sofia IA' },
    { dir: 'inbound', body: 'Talle L. Me pasas fotos?', minutesAgo: 90 },
  ]);

  const convCampaignSilent = await Conversation.create({
    tenantId: T, phoneNumberId: phone._id, contactId: agustina._id,
    agentId: null, status: 'unassigned',
    lastMessageAt: ago(200), lastInboundAt: ago(200),
    origin: 'campaign', hasReplied: false, repliedAt: null,
  });
  await createMessages(convCampaignSilent._id, [
    { dir: 'outbound', body: 'Hola Agustina! Gracias por escribirnos. Somos Demo Store y te vamos a estar acompanando por acá. En que podemos ayudarte?', minutesAgo: 200, type: 'template', agentId: ana._id.toString(), agentName: 'Demo User', campaignId: campaignDone._id },
  ]);
  console.log(`+ 2 conversaciones originadas en campana (una respondio, otra no)`);

  // ── 13. Conversation Events ──
  const events = [
    // Conv 1 — Sofia IA primero, handoff a Carlos
    { conversationId: conv1._id, tenantId: T, type: 'created', createdAt: ago(120) },
    { conversationId: conv1._id, tenantId: T, type: 'assigned', performedBy: sofia._id.toString(), data: { agentName: 'Sofia IA' }, createdAt: ago(119) },
    { conversationId: conv1._id, tenantId: T, type: 'reassigned', performedBy: sofia._id.toString(), data: { fromAgentName: 'Sofia IA', toAgentName: 'Carlos Lopez' }, createdAt: ago(56) },
    // Conv 2
    { conversationId: conv2._id, tenantId: T, type: 'created', createdAt: ago(45) },
    { conversationId: conv2._id, tenantId: T, type: 'assigned', performedBy: carlos._id.toString(), data: { agentName: 'Carlos Lopez' }, createdAt: ago(40) },
    // Conv 3
    { conversationId: conv3._id, tenantId: T, type: 'created', createdAt: ago(8) },
    { conversationId: conv3._id, tenantId: T, type: 'assigned', performedBy: sofia._id.toString(), data: { agentName: 'Sofia IA' }, createdAt: ago(7) },
    // Conv 4
    { conversationId: conv4._id, tenantId: T, type: 'created', createdAt: ago(4) },
    { conversationId: conv4._id, tenantId: T, type: 'assigned', performedBy: sofia._id.toString(), data: { agentName: 'Sofia IA' }, createdAt: ago(3) },
    // Conv 5
    { conversationId: conv5._id, tenantId: T, type: 'created', createdAt: ago(45) },
    { conversationId: conv5._id, tenantId: T, type: 'assigned', performedBy: sofia._id.toString(), data: { agentName: 'Sofia IA' }, createdAt: ago(44) },
    // Conv 6 — Sofia IA primero, handoff a Ana
    { conversationId: conv6._id, tenantId: T, type: 'created', createdAt: ago(1500) },
    { conversationId: conv6._id, tenantId: T, type: 'assigned', performedBy: sofia._id.toString(), data: { agentName: 'Sofia IA' }, createdAt: ago(1499) },
    { conversationId: conv6._id, tenantId: T, type: 'reassigned', performedBy: sofia._id.toString(), data: { fromAgentName: 'Sofia IA', toAgentName: 'Demo User' }, createdAt: ago(1491) },
    // Conv 7
    { conversationId: conv7._id, tenantId: T, type: 'created', createdAt: ago(12) },
    { conversationId: conv7._id, tenantId: T, type: 'assigned', performedBy: sofia._id.toString(), data: { agentName: 'Sofia IA' }, createdAt: ago(11) },
    // Conv 8
    { conversationId: conv8._id, tenantId: T, type: 'created', createdAt: ago(60) },
    { conversationId: conv8._id, tenantId: T, type: 'assigned', performedBy: sofia._id.toString(), data: { agentName: 'Sofia IA' }, createdAt: ago(59) },
    { conversationId: conv8._id, tenantId: T, type: 'contact_updated', performedBy: sofia._id.toString(), data: { fields: ['tipo_cliente', 'productos', 'cantidad_minima'], source: 'ai' }, createdAt: ago(58) },
    { conversationId: conv8._id, tenantId: T, type: 'goal_completed', performedBy: sofia._id.toString(), data: { goal: 'lead_qualified', agentName: 'Sofia IA' }, createdAt: ago(54) },
    // Conv 9 — Florencia lead qualification
    { conversationId: conv9._id, tenantId: T, type: 'created', createdAt: ago(35) },
    { conversationId: conv9._id, tenantId: T, type: 'assigned', performedBy: sofia._id.toString(), data: { agentName: 'Sofia IA' }, createdAt: ago(34) },
    { conversationId: conv9._id, tenantId: T, type: 'contact_updated', performedBy: sofia._id.toString(), data: { fields: ['name', 'company', 'ciudad'], source: 'ai' }, createdAt: ago(31) },
    { conversationId: conv9._id, tenantId: T, type: 'contact_updated', performedBy: sofia._id.toString(), data: { fields: ['volumen_mensual', 'tipo_cliente'], source: 'ai' }, createdAt: ago(28) },
    { conversationId: conv9._id, tenantId: T, type: 'goal_completed', performedBy: sofia._id.toString(), data: { goal: 'lead_qualified', agentName: 'Sofia IA' }, createdAt: ago(28) },
    { conversationId: conv9._id, tenantId: T, type: 'contact_updated', performedBy: sofia._id.toString(), data: { fields: ['email'], source: 'ai' }, createdAt: ago(22) },
    // Conv 1 — contact data collected by Sofia before handoff
    { conversationId: conv1._id, tenantId: T, type: 'contact_updated', performedBy: sofia._id.toString(), data: { fields: ['direccion', 'presupuesto'], source: 'ai' }, createdAt: ago(109) },
    // Conv 3 — contact data collected by Sofia
    { conversationId: conv3._id, tenantId: T, type: 'contact_updated', performedBy: sofia._id.toString(), data: { fields: ['talle', 'interes'], source: 'ai' }, createdAt: ago(5) },
    // Conv 10 — entro sin asignar
    { conversationId: conv10._id, tenantId: T, type: 'created', createdAt: ago(2) },
    // Conversacion nacida de la campana
    { conversationId: convCampaignReplied._id, tenantId: T, type: 'created', createdAt: ago(200) },
    { conversationId: convCampaignReplied._id, tenantId: T, type: 'assigned', performedBy: sofia._id.toString(), data: { agentName: 'Sofia IA' }, createdAt: ago(94) },
    { conversationId: convCampaignSilent._id, tenantId: T, type: 'created', createdAt: ago(200) },
  ];
  await ConvEvent.insertMany(events);
  console.log(`+ ${events.length} conversation events`);

  // ── 14. Conversation Notes ──
  await ConvNote.insertMany([
    {
      conversationId: conv1._id, tenantId: T,
      authorId: sofia._id.toString(), authorName: 'Sofia IA',
      body: 'Cliente pidio hablar con una persona para asesoramiento de combinaciones. Derivado a Carlos.',
      createdAt: ago(57),
    },
    {
      conversationId: conv2._id, tenantId: T,
      authorId: carlos._id.toString(), authorName: 'Carlos Lopez',
      body: 'Cliente VIP, priorizar respuesta. Ya tuvo problemas con envios anteriores.',
      createdAt: ago(38),
    },
    {
      conversationId: conv6._id, tenantId: T,
      authorId: ana._id.toString(), authorName: 'Demo User',
      body: 'Resuelto - se reenvio el paquete con talle correcto por express.',
      createdAt: ago(1435),
    },
  ]);
  console.log(`+ 3 conversation notes`);

  // ── 15. Labels ──
  const labels = await Label.insertMany([
    { tenantId: T, name: 'VIP', color: 'yellow' },
    { tenantId: T, name: 'Urgente', color: 'red' },
    { tenantId: T, name: 'Nuevo', color: 'blue' },
    { tenantId: T, name: 'Envio', color: 'purple' },
    { tenantId: T, name: 'Devolucion', color: 'orange' },
    { tenantId: T, name: 'Mayorista', color: 'green' },
  ]);
  const [lVip, lUrgente, lNuevo, lEnvio, lDevolucion, lMayorista] = labels;
  console.log(`+ 6 labels`);

  // ── 16. Conversation Labels ──
  await ConvLabel.insertMany([
    { conversationId: conv1._id, tenantId: T, labelId: lVip._id, assignedBy: carlos._id.toString() },
    { conversationId: conv2._id, tenantId: T, labelId: lUrgente._id, assignedBy: carlos._id.toString() },
    { conversationId: conv2._id, tenantId: T, labelId: lEnvio._id, assignedBy: carlos._id.toString() },
    { conversationId: conv3._id, tenantId: T, labelId: lNuevo._id, assignedBy: sofia._id.toString() },
    { conversationId: conv5._id, tenantId: T, labelId: lDevolucion._id, assignedBy: sofia._id.toString() },
    { conversationId: conv6._id, tenantId: T, labelId: lEnvio._id, assignedBy: ana._id.toString() },
    { conversationId: conv7._id, tenantId: T, labelId: lNuevo._id, assignedBy: sofia._id.toString() },
    { conversationId: conv8._id, tenantId: T, labelId: lMayorista._id, assignedBy: sofia._id.toString() },
    { conversationId: conv9._id, tenantId: T, labelId: lMayorista._id, assignedBy: sofia._id.toString() },
    { conversationId: conv9._id, tenantId: T, labelId: lVip._id, assignedBy: sofia._id.toString() },
    { conversationId: convCampaignReplied._id, tenantId: T, labelId: lNuevo._id, assignedBy: sofia._id.toString() },
  ]);
  console.log(`+ 11 conversation-label assignments`);

  // ── 17. Suscripcion + historial de facturacion ──
  // Sin esto el demo cae a FREE, que no alcanza para 3 agentes humanos y deja
  // la pantalla de Facturacion vacia.
  await Subscription.create({
    tenantId: T,
    plan: 'pro',
    status: 'active',
    currentPeriodStart: ago(12 * 24 * 60),
    currentPeriodEnd: inDays(18),
    paymentProvider: 'none',
  });
  await BillingRecord.insertMany([
    { tenantId: T, eventType: 'subscription_created', plan: 'pro', amountCents: 4900, description: 'Suscripcion al plan Pro', createdAt: ago(72 * 24 * 60) },
    { tenantId: T, eventType: 'payment_success', plan: 'pro', amountCents: 4900, description: 'Pago mensual - plan Pro', createdAt: ago(42 * 24 * 60) },
    { tenantId: T, eventType: 'payment_success', plan: 'pro', amountCents: 4900, description: 'Pago mensual - plan Pro', createdAt: ago(12 * 24 * 60) },
  ]);
  console.log(`+ Suscripcion Pro activa + 3 registros de facturacion`);

  // ── 18. Uso de IA (ultimos 14 dias) ──
  const usage = Array.from({ length: 14 }, (_, i) => ({
    tenantId: T,
    aiAgentId: sofia._id,
    date: dayKey(i),
    messageCount: 18 + ((i * 7) % 23),
    tokenCount: 4200 + ((i * 811) % 5300),
  }));
  await AiUsage.insertMany(usage);
  console.log(`+ ${usage.length} dias de uso de IA`);

  // ── 19. Automatizaciones (flujos) ────────────────────────
  // Los grafos apuntan a entidades reales del demo (etiquetas, la IA, la
  // plantilla aprobada y el numero): el visitante los abre, los publica y los
  // prueba sin tener que configurar nada antes. Si cambia el catalogo de nodos
  // hay que revisar estos grafos: se guardan ya publicados, sin pasar por el
  // validador de publish-flow.
  const sofiaId = sofia._id.toString();

  const menuGraph = {
    nodes: [
      {
        id: 'trigger', type: 'trigger.inbound_message', position: { x: 40, y: 260 },
        data: { phoneNumberIds: [], match: 'any', keywords: [], keywordMode: 'contains', onlyNewConversations: true, ignoreIfAssignedToHuman: true },
      },
      {
        id: 'etiqueta', type: 'action.label', position: { x: 340, y: 260 },
        data: { action: 'add', labelId: lNuevo._id.toString() },
      },
      {
        id: 'menu', type: 'action.send_buttons', position: { x: 640, y: 240 },
        data: {
          body: '¡Hola {{contact.name}}! 👋 Gracias por escribir a Demo Store. ¿Con qué te podemos ayudar?',
          footer: 'Elegí una opción',
          buttons: [{ title: 'Ver catálogo' }, { title: 'Estado del pedido' }, { title: 'Hablar con alguien' }],
          timeout: { amount: 1, unit: 'days' },
          saveAs: 'opcion',
          invalidMessage: '',
          windowPolicy: 'error',
        },
      },
      {
        id: 'catalogo', type: 'action.send_text', position: { x: 1020, y: 60 },
        data: {
          body: 'Este es el catálogo de la temporada 👇\n\n👕 Remeras desde $9.800\n🧥 Buzos desde $11.500\n👖 Jeans desde $18.900\n\nDecime cuál te gustó y te paso talles, colores y disponibilidad.',
          windowPolicy: 'error',
        },
      },
      {
        id: 'pedido', type: 'action.ask', position: { x: 1020, y: 280 },
        data: {
          body: '¡Dale! 📦 Pasame el número de pedido (por ejemplo #4521) y lo busco.',
          saveAs: 'pedido', validation: 'texto', invalidMessage: 'Necesito el número de pedido, por ejemplo #4521.',
          saveToContact: '', timeout: { amount: 1, unit: 'days' }, windowPolicy: 'error',
        },
      },
      {
        id: 'nota', type: 'action.internal_note', position: { x: 1380, y: 300 },
        data: { body: 'Consulta por el pedido {{vars.pedido}}. Llegó por el menú de bienvenida.' },
      },
      {
        id: 'humano', type: 'action.handoff_human', position: { x: 1720, y: 340 },
        data: { note: 'El cliente eligió "{{vars.opcion}}" en el menú de bienvenida.' },
      },
      {
        id: 'bot', type: 'action.handoff_ai', position: { x: 1380, y: 60 },
        data: { aiAgentId: sofiaId },
      },
    ],
    edges: [
      { id: 'e1', source: 'trigger', sourceHandle: 'out', target: 'etiqueta' },
      { id: 'e2', source: 'etiqueta', sourceHandle: 'out', target: 'menu' },
      { id: 'e3', source: 'menu', sourceHandle: 'btn:0', target: 'catalogo' },
      { id: 'e4', source: 'menu', sourceHandle: 'btn:1', target: 'pedido' },
      { id: 'e5', source: 'menu', sourceHandle: 'btn:2', target: 'humano' },
      // Respuesta libre: la atiende la IA en vez de cortar la conversación.
      { id: 'e6', source: 'menu', sourceHandle: 'other', target: 'bot' },
      { id: 'e7', source: 'catalogo', sourceHandle: 'out', target: 'bot' },
      { id: 'e8', source: 'pedido', sourceHandle: 'reply', target: 'nota' },
      { id: 'e9', source: 'pedido', sourceHandle: 'timeout', target: 'humano' },
      { id: 'e10', source: 'nota', sourceHandle: 'out', target: 'humano' },
    ],
  };

  const horarioSchedule = { days: [1, 2, 3, 4, 5], from: '09:00', to: '18:00', timezone: 'America/Argentina/Buenos_Aires' };
  const fueraHorarioGraph = {
    nodes: [
      {
        id: 'trigger', type: 'trigger.inbound_message', position: { x: 40, y: 240 },
        data: { phoneNumberIds: [], match: 'any', keywords: [], keywordMode: 'contains', onlyNewConversations: false, ignoreIfAssignedToHuman: true },
      },
      {
        id: 'horario', type: 'logic.condition', position: { x: 340, y: 240 },
        data: { logic: 'and', rules: [{ op: 'in_schedule', schedule: horarioSchedule }] },
      },
      { id: 'bot', type: 'action.handoff_ai', position: { x: 700, y: 100 }, data: { aiAgentId: sofiaId } },
      {
        id: 'cerrado', type: 'action.send_text', position: { x: 700, y: 340 },
        data: {
          body: '¡Gracias por escribirnos! 🙌 Ahora estamos cerrados. Te respondemos apenas abramos: lunes a viernes de 9 a 18 y sábados de 10 a 14.',
          windowPolicy: 'error',
        },
      },
      {
        id: 'esperar', type: 'logic.wait_business_hours', position: { x: 1040, y: 340 },
        data: { schedule: horarioSchedule },
      },
      {
        id: 'humano', type: 'action.handoff_human', position: { x: 1380, y: 340 },
        data: { note: 'Escribió fuera de horario. Contestar apenas se abra.' },
      },
    ],
    edges: [
      { id: 'e1', source: 'trigger', sourceHandle: 'out', target: 'horario' },
      { id: 'e2', source: 'horario', sourceHandle: 'yes', target: 'bot' },
      { id: 'e3', source: 'horario', sourceHandle: 'no', target: 'cerrado' },
      { id: 'e4', source: 'cerrado', sourceHandle: 'out', target: 'esperar' },
      { id: 'e5', source: 'esperar', sourceHandle: 'out', target: 'humano' },
    ],
  };

  const leadsGraph = {
    nodes: [
      {
        id: 'trigger', type: 'trigger.inbound_message', position: { x: 40, y: 300 },
        data: {
          phoneNumberIds: [], match: 'keywords',
          keywords: ['mayorista', 'por mayor', 'mayoreo', 'revendedor', 'cantidad'],
          keywordMode: 'contains', onlyNewConversations: false, ignoreIfAssignedToHuman: true,
        },
      },
      {
        id: 'clasificar', type: 'logic.ai_route', position: { x: 360, y: 300 },
        data: {
          aiAgentId: sofiaId,
          question: '¿Qué está buscando el cliente?',
          options: [
            { key: 'mayorista', label: 'Quiere comprar por mayor o revender' },
            { key: 'minorista', label: 'Compra una o pocas unidades' },
            { key: 'otro', label: 'Es un reclamo o una consulta de otra cosa' },
          ],
        },
      },
      {
        id: 'volumen', type: 'action.ask', position: { x: 720, y: 160 },
        data: {
          body: '¡Genial! 🙌 Para pasarte la lista mayorista: ¿qué cantidad aproximada necesitás por mes?',
          saveAs: 'volumen', validation: 'texto', invalidMessage: '',
          saveToContact: '', timeout: { amount: 12, unit: 'hours' }, windowPolicy: 'error',
        },
      },
      {
        id: 'guardar', type: 'action.update_contact', position: { x: 1040, y: 160 },
        data: {
          fields: [
            { field: 'custom.tipo_cliente', value: 'mayorista' },
            { field: 'custom.volumen_mensual', value: '{{vars.volumen}}' },
          ],
        },
      },
      {
        id: 'etiquetar', type: 'action.label', position: { x: 1360, y: 160 },
        data: { action: 'add', labelId: lMayorista._id.toString() },
      },
      {
        id: 'avisar', type: 'action.emit_event', position: { x: 1680, y: 160 },
        data: { eventName: 'lead.mayorista', fields: [{ key: 'volumen', value: '{{vars.volumen}}' }, { key: 'telefono', value: '{{contact.phone}}' }] },
      },
      { id: 'bot', type: 'action.handoff_ai', position: { x: 2000, y: 160 }, data: { aiAgentId: sofiaId } },
      {
        id: 'humano', type: 'action.handoff_human', position: { x: 720, y: 460 },
        data: { note: 'La IA no lo clasificó como mayorista. Revisar a mano.' },
      },
    ],
    edges: [
      { id: 'e1', source: 'trigger', sourceHandle: 'out', target: 'clasificar' },
      { id: 'e2', source: 'clasificar', sourceHandle: 'opt:mayorista', target: 'volumen' },
      { id: 'e3', source: 'clasificar', sourceHandle: 'opt:minorista', target: 'bot' },
      { id: 'e4', source: 'clasificar', sourceHandle: 'opt:otro', target: 'humano' },
      // Obligatoria: sin fallback el flujo se corta en silencio.
      { id: 'e5', source: 'clasificar', sourceHandle: 'fallback', target: 'humano' },
      { id: 'e6', source: 'volumen', sourceHandle: 'reply', target: 'guardar' },
      { id: 'e7', source: 'volumen', sourceHandle: 'timeout', target: 'humano' },
      { id: 'e8', source: 'guardar', sourceHandle: 'out', target: 'etiquetar' },
      { id: 'e9', source: 'etiquetar', sourceHandle: 'out', target: 'avisar' },
      { id: 'e10', source: 'avisar', sourceHandle: 'out', target: 'bot' },
    ],
  };

  const envioGraph = {
    nodes: [
      {
        id: 'trigger', type: 'trigger.webhook', position: { x: 40, y: 240 },
        data: { phoneNumberId: phone._id.toString(), contactPhoneField: 'telefono', contactNameField: 'nombre' },
      },
      {
        id: 'aviso', type: 'action.send_template', position: { x: 380, y: 240 },
        data: {
          templateId: tplEnvio._id.toString(),
          variables: {
            'body.1': { source: 'contact_field', value: 'name' },
            'body.2': { source: 'flow_var', value: 'webhook.pedido' },
          },
        },
      },
      {
        id: 'avisar', type: 'action.emit_event', position: { x: 740, y: 140 },
        data: { eventName: 'envio.notificado', fields: [{ key: 'pedido', value: '{{webhook.pedido}}' }] },
      },
      {
        id: 'nota', type: 'action.internal_note', position: { x: 740, y: 380 },
        data: { body: 'No se pudo avisar el envío del pedido {{webhook.pedido}}. Contactar a mano.' },
      },
    ],
    edges: [
      { id: 'e1', source: 'trigger', sourceHandle: 'out', target: 'aviso' },
      { id: 'e2', source: 'aviso', sourceHandle: 'out', target: 'avisar' },
      { id: 'e3', source: 'aviso', sourceHandle: 'error', target: 'nota' },
    ],
  };

  // Borrador: queda a medio configurar a proposito, para que el visitante vea
  // el estado "borrador" y pueda terminarlo y publicarlo el mismo.
  const cobroGraph = {
    nodes: [
      {
        id: 'trigger', type: 'trigger.inbound_message', position: { x: 40, y: 240 },
        data: { phoneNumberIds: [], match: 'keywords', keywords: ['pagar', 'pago', 'link de pago'], keywordMode: 'contains', onlyNewConversations: false, ignoreIfAssignedToHuman: true },
      },
      {
        id: 'monto', type: 'action.ask', position: { x: 360, y: 240 },
        data: {
          body: '¡Dale! 💳 ¿Por qué monto te genero el link de pago? (solo el número)',
          saveAs: 'monto', validation: 'numero', invalidMessage: 'Necesito solo el número, por ejemplo: 15000',
          saveToContact: '', timeout: { amount: 12, unit: 'hours' }, windowPolicy: 'error',
        },
      },
      {
        id: 'mp', type: 'action.http', position: { x: 680, y: 240 },
        data: {
          method: 'POST', url: 'https://api.mercadopago.com/checkout/preferences',
          headers: [], connectionId: '', bodyMode: 'json',
          body: '{"items":[{"title":"Pago por WhatsApp","quantity":1,"currency_id":"ARS","unit_price":{{vars.monto}}}]}',
          saveAs: 'pago', retryOnFailure: false,
        },
      },
      {
        id: 'link', type: 'action.send_text', position: { x: 1020, y: 140 },
        data: { body: 'Listo ✅ Acá tenés tu link de pago:\n{{vars.pago.body.init_point}}\n\nAvisanos cuando lo completes.', windowPolicy: 'error' },
      },
      {
        id: 'fallo', type: 'action.handoff_human', position: { x: 1020, y: 360 },
        data: { note: 'El link de pago falló (HTTP {{vars.pago.status}}). Atender a mano.' },
      },
    ],
    edges: [
      { id: 'e1', source: 'trigger', sourceHandle: 'out', target: 'monto' },
      { id: 'e2', source: 'monto', sourceHandle: 'reply', target: 'mp' },
      { id: 'e3', source: 'mp', sourceHandle: 'success', target: 'link' },
      { id: 'e4', source: 'mp', sourceHandle: 'error', target: 'fallo' },
    ],
  };

  /** Crea el flujo + su version publicada (o solo el borrador). */
  async function createFlow(input: {
    name: string;
    description: string;
    graph: any;
    priority: number;
    status: 'published' | 'paused' | 'draft';
    stats: { started: number; completed: number; failed: number; cancelled: number };
    trigger?: Partial<{
      type: 'inbound_message' | 'webhook' | 'campaign_reply';
      match: 'any' | 'keywords';
      keywords: string[];
      onlyNewConversations: boolean;
      contactPhoneField: string | null;
      contactNameField: string | null;
      phoneNumberIds: string[];
    }>;
    createdMinutesAgo: number;
  }) {
    const flow = await Flow.create({
      tenantId: T,
      name: input.name,
      description: input.description,
      status: input.status,
      draftGraph: input.graph,
      priority: input.priority,
      webhookToken: input.trigger?.type === 'webhook' ? randomBytes(32).toString('hex') : null,
      stats: input.stats,
      createdByAgentId: ana._id,
      createdAt: ago(input.createdMinutesAgo),
      updatedAt: ago(Math.round(input.createdMinutesAgo / 3)),
    });

    if (input.status === 'draft') return { flow, version: null };

    const version = await FlowVersion.create({
      flowId: flow._id,
      tenantId: T,
      version: 1,
      graph: input.graph,
      trigger: {
        type: input.trigger?.type ?? 'inbound_message',
        phoneNumberIds: input.trigger?.phoneNumberIds ?? [],
        match: input.trigger?.match ?? 'any',
        keywords: input.trigger?.keywords ?? [],
        keywordMode: 'contains',
        onlyNewConversations: input.trigger?.onlyNewConversations ?? false,
        ignoreIfAssignedToHuman: true,
        contactPhoneField: input.trigger?.contactPhoneField ?? null,
        contactNameField: input.trigger?.contactNameField ?? null,
        campaignIds: [],
      },
      publishedByAgentId: ana._id,
      createdAt: ago(Math.round(input.createdMinutesAgo / 2)),
    });

    await Flow.updateOne(
      { _id: flow._id },
      { publishedVersionId: version._id, publishedVersion: version.version },
    );

    return { flow, version };
  }

  const { flow: flowMenu, version: verMenu } = await createFlow({
    name: 'Menú de bienvenida',
    description: 'Saluda al que escribe por primera vez, lo etiqueta y lo manda al catálogo, al estado del pedido o a una persona.',
    graph: menuGraph, priority: 10, status: 'published',
    stats: { started: 148, completed: 131, failed: 2, cancelled: 6 },
    trigger: { type: 'inbound_message', onlyNewConversations: true },
    createdMinutesAgo: 45 * 24 * 60,
  });

  const { flow: flowHorario, version: verHorario } = await createFlow({
    name: 'Fuera de horario',
    description: 'Dentro del horario deriva a la IA; fuera, avisa cuándo abrimos y espera a que abra para pasarlo al equipo.',
    graph: fueraHorarioGraph, priority: 20, status: 'published',
    stats: { started: 96, completed: 93, failed: 0, cancelled: 3 },
    trigger: { type: 'inbound_message' },
    createdMinutesAgo: 30 * 24 * 60,
  });

  const { flow: flowLeads, version: verLeads } = await createFlow({
    name: 'Calificar leads mayoristas',
    description: 'Clasifica la intención con IA, pregunta el volumen, lo guarda en la ficha, etiqueta y avisa a tus sistemas.',
    graph: leadsGraph, priority: 30, status: 'published',
    stats: { started: 42, completed: 33, failed: 3, cancelled: 6 },
    trigger: { type: 'inbound_message', match: 'keywords', keywords: ['mayorista', 'por mayor', 'mayoreo', 'revendedor', 'cantidad'] },
    createdMinutesAgo: 20 * 24 * 60,
  });

  const { flow: flowEnvio, version: verEnvio } = await createFlow({
    name: 'Aviso de envío desde tu sistema',
    description: 'Tu backend pega en la URL del flujo cuando despacha un pedido y el cliente recibe la plantilla aprobada.',
    graph: envioGraph, priority: 40, status: 'published',
    trigger: { type: 'webhook', contactPhoneField: 'telefono', contactNameField: 'nombre', phoneNumberIds: [phone._id.toString()] },
    stats: { started: 87, completed: 85, failed: 2, cancelled: 0 },
    createdMinutesAgo: 12 * 24 * 60,
  });

  await createFlow({
    name: 'Cobrar con MercadoPago',
    description: 'Genera un link de pago con tu cuenta de MercadoPago y lo manda por WhatsApp. Elegí la conexión en el nodo HTTP y publicalo.',
    graph: cobroGraph, priority: 50, status: 'draft',
    stats: { started: 0, completed: 0, failed: 0, cancelled: 0 },
    createdMinutesAgo: 3 * 24 * 60,
  });
  console.log(`+ 5 flujos (4 publicados + 1 borrador)`);

  // Conexion para el nodo HTTP. El secreto va cifrado con el mismo formato que
  // usa FlowSecretsService; con otra FLOW_SECRETS_KEY en runtime solo falla si
  // un flujo la usa, y ninguno de los publicados la referencia.
  const flowSecretsKey = createHash('sha256').update(process.env.FLOW_SECRETS_KEY ?? 'demo-seed').digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', flowSecretsKey, iv);
  const encrypted = Buffer.concat([cipher.update('APP_USR-demo-token-no-real', 'utf8'), cipher.final()]);
  await FlowConnection.create({
    tenantId: T,
    name: 'MercadoPago (demo)',
    headerName: 'Authorization',
    secretEncrypted: `${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${encrypted.toString('base64')}`,
  });
  console.log(`+ 1 conexion para el nodo HTTP`);

  // ── 20. Conversaciones que nacieron de un flujo o de la API ──
  const flowContacts = await Contact.insertMany([
    { tenantId: T, phone: '5491155551013', name: 'Brenda Suarez', customFields: { origen: 'menu de bienvenida' }, lastSeenAt: ago(190) },
    { tenantId: T, phone: '5491155551014', name: 'Tomas Quiroga', lastSeenAt: ago(240) },
    { tenantId: T, phone: '5491155551015', name: 'Julian Ferrari', lastSeenAt: ago(320) },
    { tenantId: T, phone: '5491155551016', name: 'Ramiro Sosa', company: 'Pedido #5120', customFields: { origen: 'api' }, lastSeenAt: ago(140) },
    { tenantId: T, phone: '5491155551017', name: 'Andres Bustos', lastSeenAt: ago(70) },
  ]);
  const [brenda, tomas, julian, ramiro, andres] = flowContacts;

  const menuButtons = {
    kind: 'buttons',
    body: menuGraph.nodes[2].data.body as string,
    footer: 'Elegí una opción',
    buttons: [
      { id: 'fl:menu:0', title: 'Ver catálogo' },
      { id: 'fl:menu:1', title: 'Estado del pedido' },
      { id: 'fl:menu:2', title: 'Hablar con alguien' },
    ],
  };
  const menuBody = (name: string) => menuButtons.body.replace('{{contact.name}}', name);

  // Brenda: recorrio el menu entero y termino en Carlos.
  const convBrenda = await Conversation.create({
    tenantId: T, phoneNumberId: phone._id, contactId: brenda._id,
    agentId: carlos._id, status: 'active',
    lastMessageAt: ago(180), lastInboundAt: ago(184),
    summary: 'Llegó por el menú de bienvenida, eligió "Estado del pedido" y dejó el número #5087. El flujo la derivó a Carlos con la nota.',
  });
  await createMessages(convBrenda._id, [
    { dir: 'inbound', body: 'Hola! buenas', minutesAgo: 195 },
    { dir: 'outbound', type: 'interactive', body: menuBody('Brenda Suarez'), minutesAgo: 194, agentName: 'Menú de bienvenida', interactivePayload: menuButtons },
    { dir: 'inbound', type: 'interactive', body: 'Estado del pedido', minutesAgo: 190, interactiveReplyId: 'fl:menu:1' },
    { dir: 'outbound', body: '¡Dale! 📦 Pasame el número de pedido (por ejemplo #4521) y lo busco.', minutesAgo: 189, agentName: 'Menú de bienvenida' },
    { dir: 'inbound', body: '#5087', minutesAgo: 184 },
    { dir: 'outbound', body: 'Hola Brenda! Soy Carlos. Tu pedido #5087 salio ayer y lo entregan hoy antes de las 18. Te paso el seguimiento por acá cuando lo tenga.', minutesAgo: 180, agentId: carlos._id.toString(), agentName: 'Carlos Lopez' },
  ]);

  // Tomas: el flujo le mando el menu y todavia no contesto (ejecucion en espera).
  const convTomas = await Conversation.create({
    tenantId: T, phoneNumberId: phone._id, contactId: tomas._id,
    agentId: null, status: 'unassigned',
    lastMessageAt: ago(239), lastInboundAt: ago(240),
  });
  await createMessages(convTomas._id, [
    { dir: 'inbound', body: 'hola', minutesAgo: 240 },
    { dir: 'outbound', type: 'interactive', body: menuBody('Tomas Quiroga'), minutesAgo: 239, agentName: 'Menú de bienvenida', interactivePayload: menuButtons },
  ]);

  // Julian: toco "Hablar con alguien" y el flujo lo derivo directo.
  const convJulian = await Conversation.create({
    tenantId: T, phoneNumberId: phone._id, contactId: julian._id,
    agentId: lucia._id, status: 'active',
    lastMessageAt: ago(310), lastInboundAt: ago(315),
    unreadCount: 1,
  });
  await createMessages(convJulian._id, [
    { dir: 'inbound', body: 'Buenas! consulta', minutesAgo: 322 },
    { dir: 'outbound', type: 'interactive', body: menuBody('Julian Ferrari'), minutesAgo: 321, agentName: 'Menú de bienvenida', interactivePayload: menuButtons },
    { dir: 'inbound', type: 'interactive', body: 'Hablar con alguien', minutesAgo: 315, interactiveReplyId: 'fl:menu:2' },
    { dir: 'outbound', body: 'Hola Julian! Soy Lucia, en que te ayudo?', minutesAgo: 312, agentId: lucia._id.toString(), agentName: 'Lucia Fernandez' },
    { dir: 'inbound', body: 'Queria saber si hacen envios a La Plata', minutesAgo: 310 },
  ]);

  // Ramiro: la conversacion la abrio el backend de la tienda por la API,
  // disparando el flujo de aviso de envio.
  const convRamiro = await Conversation.create({
    tenantId: T, phoneNumberId: phone._id, contactId: ramiro._id,
    agentId: sofia._id, status: 'active',
    origin: 'api', hasReplied: true, repliedAt: ago(140),
    lastMessageAt: ago(138), lastInboundAt: ago(140),
  });
  await createMessages(convRamiro._id, [
    { dir: 'outbound', type: 'template', body: 'Hola Ramiro Sosa! Tu pedido #5120 ya salio de nuestro deposito y llega en 24-48hs.', minutesAgo: 150, agentName: 'Aviso de envío desde tu sistema' },
    { dir: 'inbound', body: 'Gracias! Puede recibirlo un vecino si no estoy?', minutesAgo: 140 },
    { dir: 'outbound', body: 'Si, sin problema 🙌 El correo entrega a cualquier persona en el domicilio con DNI. Si preferis, tambien podes reprogramar la entrega desde el link del seguimiento.', minutesAgo: 138, agentId: sofia._id.toString(), agentName: 'Sofia IA' },
  ]);

  // Andres: el flujo de leads se corto por el limite diario de la IA. Queda sin
  // asignar y con el mensaje sin leer: es el caso que explica la pantalla de
  // ejecuciones fallidas.
  const convAndres = await Conversation.create({
    tenantId: T, phoneNumberId: phone._id, contactId: andres._id,
    agentId: null, status: 'unassigned',
    lastMessageAt: ago(70), lastInboundAt: ago(70),
    unreadCount: 1,
  });
  await createMessages(convAndres._id, [
    { dir: 'inbound', body: 'Hola, hacen precios por mayor? Tengo un local en Rosario', minutesAgo: 70 },
  ]);

  await ConvEvent.insertMany([
    { conversationId: convBrenda._id, tenantId: T, type: 'created', createdAt: ago(195) },
    { conversationId: convBrenda._id, tenantId: T, type: 'reassigned', performedBy: ana._id.toString(), data: { fromAgentName: 'Menú de bienvenida', toAgentName: 'Carlos Lopez' }, createdAt: ago(183) },
    { conversationId: convTomas._id, tenantId: T, type: 'created', createdAt: ago(240) },
    { conversationId: convJulian._id, tenantId: T, type: 'created', createdAt: ago(322) },
    { conversationId: convJulian._id, tenantId: T, type: 'assigned', performedBy: ana._id.toString(), data: { agentName: 'Lucia Fernandez' }, createdAt: ago(314) },
    { conversationId: convRamiro._id, tenantId: T, type: 'created', createdAt: ago(150) },
    { conversationId: convRamiro._id, tenantId: T, type: 'assigned', performedBy: sofia._id.toString(), data: { agentName: 'Sofia IA' }, createdAt: ago(139) },
    { conversationId: convAndres._id, tenantId: T, type: 'created', createdAt: ago(70) },
  ]);
  await ConvLabel.insertMany([
    { conversationId: convBrenda._id, tenantId: T, labelId: lNuevo._id, assignedBy: ana._id.toString() },
    { conversationId: convTomas._id, tenantId: T, labelId: lNuevo._id, assignedBy: ana._id.toString() },
    { conversationId: convJulian._id, tenantId: T, labelId: lNuevo._id, assignedBy: ana._id.toString() },
    { conversationId: convRamiro._id, tenantId: T, labelId: lEnvio._id, assignedBy: ana._id.toString() },
  ]);
  console.log(`+ 5 contactos y conversaciones nacidas de flujos y de la API`);

  // ── 21. Ejecuciones de flujos ──
  let execSeq = 0;
  async function createExecution(input: {
    flowId: Types.ObjectId;
    versionId: Types.ObjectId;
    conversationId: Types.ObjectId;
    contactId: Types.ObjectId;
    status: 'completed' | 'waiting' | 'failed';
    startedMinutesAgo: number;
    endedMinutesAgo?: number;
    currentNodeId?: string | null;
    steps: { nodeId: string; type: string; handle: string | null; status?: 'ok' | 'error' | 'skipped'; note?: string }[];
    variables?: Record<string, unknown>;
    waitState?: Record<string, unknown> | null;
    endReason?: string | null;
    error?: { nodeId: string; message: string } | null;
    triggeredBy?: { type: 'message' | 'webhook'; messageId?: string };
  }) {
    execSeq += 1;
    const start = ago(input.startedMinutesAgo);
    await FlowExecution.create({
      tenantId: T,
      flowId: input.flowId,
      flowVersionId: input.versionId,
      conversationId: input.conversationId,
      contactId: input.contactId,
      phoneNumberId: phone._id,
      status: input.status,
      currentNodeId: input.currentNodeId ?? null,
      resumeToken: randomBytes(16).toString('hex'),
      stepCount: input.steps.length,
      waitState: input.waitState ?? null,
      lastConsumedMessageId: null,
      variables: input.variables ?? {},
      steps: input.steps.map((step, i) => ({
        nodeId: step.nodeId,
        type: step.type,
        status: step.status ?? 'ok',
        handle: step.handle,
        at: new Date(start.getTime() + i * 1500),
        ms: 40 + ((i * 37) % 260),
        note: step.note ?? null,
      })),
      triggeredBy: input.triggeredBy ?? { type: 'message', messageId: `demo-exec-${execSeq}` },
      endReason: input.endReason ?? null,
      error: input.error ?? null,
      runningSince: null,
      startedAt: start,
      endedAt: input.endedMinutesAgo !== undefined ? ago(input.endedMinutesAgo) : null,
      createdAt: start,
      updatedAt: ago(input.endedMinutesAgo ?? input.startedMinutesAgo),
    });
  }

  await createExecution({
    flowId: flowMenu._id, versionId: verMenu!._id,
    conversationId: convBrenda._id, contactId: brenda._id,
    status: 'completed', startedMinutesAgo: 195, endedMinutesAgo: 183,
    variables: { vars: { opcion: 'Estado del pedido', pedido: '#5087' } },
    endReason: 'handoff_human',
    steps: [
      { nodeId: 'trigger', type: 'trigger.inbound_message', handle: 'out' },
      { nodeId: 'etiqueta', type: 'action.label', handle: 'out', note: 'Etiqueta "Nuevo" agregada' },
      { nodeId: 'menu', type: 'action.send_buttons', handle: 'btn:1', note: 'Estado del pedido' },
      { nodeId: 'pedido', type: 'action.ask', handle: 'reply', note: '#5087' },
      { nodeId: 'nota', type: 'action.internal_note', handle: 'out' },
      { nodeId: 'humano', type: 'action.handoff_human', handle: null, note: 'Asignada a Carlos Lopez' },
    ],
  });

  await createExecution({
    flowId: flowMenu._id, versionId: verMenu!._id,
    conversationId: convJulian._id, contactId: julian._id,
    status: 'completed', startedMinutesAgo: 322, endedMinutesAgo: 314,
    variables: { vars: { opcion: 'Hablar con alguien' } },
    endReason: 'handoff_human',
    steps: [
      { nodeId: 'trigger', type: 'trigger.inbound_message', handle: 'out' },
      { nodeId: 'etiqueta', type: 'action.label', handle: 'out' },
      { nodeId: 'menu', type: 'action.send_buttons', handle: 'btn:2', note: 'Hablar con alguien' },
      { nodeId: 'humano', type: 'action.handoff_human', handle: null, note: 'Asignada a Lucia Fernandez' },
    ],
  });

  await createExecution({
    flowId: flowMenu._id, versionId: verMenu!._id,
    conversationId: convTomas._id, contactId: tomas._id,
    status: 'waiting', startedMinutesAgo: 240, currentNodeId: 'menu',
    variables: {},
    waitState: {
      nodeId: 'menu', kind: 'reply',
      timeoutAt: inMinutes(1200), waitingSince: ago(239),
      saveAs: 'opcion',
      optionMap: { 'fl:menu:0': 'btn:0', 'fl:menu:1': 'btn:1', 'fl:menu:2': 'btn:2' },
      textMap: { 'ver catalogo': 'btn:0', 'estado del pedido': 'btn:1', 'hablar con alguien': 'btn:2' },
      attempts: 0, validation: null,
    },
    steps: [
      { nodeId: 'trigger', type: 'trigger.inbound_message', handle: 'out' },
      { nodeId: 'etiqueta', type: 'action.label', handle: 'out' },
      { nodeId: 'menu', type: 'action.send_buttons', handle: null, note: 'Esperando respuesta' },
    ],
  });

  await createExecution({
    flowId: flowHorario._id, versionId: verHorario!._id,
    conversationId: conv3._id, contactId: valentina._id,
    status: 'completed', startedMinutesAgo: 8, endedMinutesAgo: 7,
    variables: {}, endReason: 'handoff_ai',
    steps: [
      { nodeId: 'trigger', type: 'trigger.inbound_message', handle: 'out' },
      { nodeId: 'horario', type: 'logic.condition', handle: 'yes', note: 'Dentro del horario' },
      { nodeId: 'bot', type: 'action.handoff_ai', handle: null, note: 'Sofia IA toma la conversación' },
    ],
  });

  await createExecution({
    flowId: flowHorario._id, versionId: verHorario!._id,
    conversationId: conv6._id, contactId: sebastian._id,
    status: 'completed', startedMinutesAgo: 1500, endedMinutesAgo: 1491,
    variables: {}, endReason: 'handoff_human',
    steps: [
      { nodeId: 'trigger', type: 'trigger.inbound_message', handle: 'out' },
      { nodeId: 'horario', type: 'logic.condition', handle: 'no', note: 'Fuera del horario' },
      { nodeId: 'cerrado', type: 'action.send_text', handle: 'out' },
      { nodeId: 'esperar', type: 'logic.wait_business_hours', handle: 'out', note: 'Esperó a las 09:00' },
      { nodeId: 'humano', type: 'action.handoff_human', handle: null },
    ],
  });

  await createExecution({
    flowId: flowLeads._id, versionId: verLeads!._id,
    conversationId: conv9._id, contactId: florencia._id,
    status: 'completed', startedMinutesAgo: 35, endedMinutesAgo: 22,
    variables: { vars: { volumen: '200 unidades por mes' } },
    endReason: 'handoff_ai',
    steps: [
      { nodeId: 'trigger', type: 'trigger.inbound_message', handle: 'out' },
      { nodeId: 'clasificar', type: 'logic.ai_route', handle: 'opt:mayorista', note: 'mayorista' },
      { nodeId: 'volumen', type: 'action.ask', handle: 'reply', note: '200 unidades por mes' },
      { nodeId: 'guardar', type: 'action.update_contact', handle: 'out', note: '2 campos actualizados' },
      { nodeId: 'etiquetar', type: 'action.label', handle: 'out', note: 'Etiqueta "Mayorista"' },
      { nodeId: 'avisar', type: 'action.emit_event', handle: 'out', note: 'lead.mayorista' },
      { nodeId: 'bot', type: 'action.handoff_ai', handle: null },
    ],
  });

  await createExecution({
    flowId: flowLeads._id, versionId: verLeads!._id,
    conversationId: conv8._id, contactId: contacts[7]._id,
    status: 'completed', startedMinutesAgo: 60, endedMinutesAgo: 52,
    variables: { vars: { volumen: '12 unidades por modelo' } },
    endReason: 'handoff_ai',
    steps: [
      { nodeId: 'trigger', type: 'trigger.inbound_message', handle: 'out' },
      { nodeId: 'clasificar', type: 'logic.ai_route', handle: 'opt:mayorista', note: 'mayorista' },
      { nodeId: 'volumen', type: 'action.ask', handle: 'reply', note: '12 unidades por modelo' },
      { nodeId: 'guardar', type: 'action.update_contact', handle: 'out' },
      { nodeId: 'etiquetar', type: 'action.label', handle: 'out' },
      { nodeId: 'avisar', type: 'action.emit_event', handle: 'out', note: 'lead.mayorista' },
      { nodeId: 'bot', type: 'action.handoff_ai', handle: null },
    ],
  });

  await createExecution({
    flowId: flowLeads._id, versionId: verLeads!._id,
    conversationId: convAndres._id, contactId: andres._id,
    status: 'failed', startedMinutesAgo: 70, endedMinutesAgo: 70,
    variables: {},
    error: { nodeId: 'clasificar', message: 'El asistente IA superó su límite diario de mensajes' },
    endReason: 'error',
    steps: [
      { nodeId: 'trigger', type: 'trigger.inbound_message', handle: 'out' },
      { nodeId: 'clasificar', type: 'logic.ai_route', handle: null, status: 'error', note: 'Límite diario del asistente alcanzado' },
    ],
  });

  await createExecution({
    flowId: flowEnvio._id, versionId: verEnvio!._id,
    conversationId: convRamiro._id, contactId: ramiro._id,
    status: 'completed', startedMinutesAgo: 150, endedMinutesAgo: 150,
    variables: { webhook: { pedido: '#5120', telefono: '5491155551016', nombre: 'Ramiro Sosa' } },
    endReason: 'end_of_flow',
    triggeredBy: { type: 'webhook' },
    steps: [
      { nodeId: 'trigger', type: 'trigger.webhook', handle: 'out' },
      { nodeId: 'aviso', type: 'action.send_template', handle: 'out', note: 'aviso_envio' },
      { nodeId: 'avisar', type: 'action.emit_event', handle: 'out', note: 'envio.notificado' },
    ],
  });
  console.log(`+ ${execSeq} ejecuciones de flujos (completadas, en espera y con error)`);

  // ── 22. Embudo por nodo (lo que dibuja "N× ejecutado" en el canvas) ──
  const nodeStatDocs: Record<string, unknown>[] = [];
  const funnels: { flowId: Types.ObjectId; versionId: Types.ObjectId; nodes: [string, number, number][] }[] = [
    {
      flowId: flowMenu._id, versionId: verMenu!._id,
      // [nodeId, entrantes por dia, errores por dia]. Las ramas suman lo que
      // entra al nodo de arriba: si no, el embudo del canvas miente.
      nodes: [['trigger', 21, 0], ['etiqueta', 21, 0], ['menu', 21, 0], ['catalogo', 8, 0], ['pedido', 6, 0], ['nota', 5, 0], ['humano', 10, 0], ['bot', 11, 0]],
    },
    {
      flowId: flowHorario._id, versionId: verHorario!._id,
      nodes: [['trigger', 14, 0], ['horario', 14, 0], ['bot', 9, 0], ['cerrado', 5, 0], ['esperar', 5, 0], ['humano', 5, 0]],
    },
    {
      flowId: flowLeads._id, versionId: verLeads!._id,
      nodes: [['trigger', 6, 0], ['clasificar', 6, 1], ['volumen', 4, 0], ['guardar', 3, 0], ['etiquetar', 3, 0], ['avisar', 3, 0], ['bot', 4, 0], ['humano', 2, 0]],
    },
    {
      flowId: flowEnvio._id, versionId: verEnvio!._id,
      nodes: [['trigger', 12, 0], ['aviso', 12, 0], ['avisar', 11, 0], ['nota', 1, 0]],
    },
  ];
  for (const funnel of funnels) {
    for (let day = 0; day < 7; day += 1) {
      // La variación es por día, no por nodo: así el embudo sigue siendo
      // decreciente de arriba hacia abajo en cualquier día.
      const delta = ((day * 3) % 5) - 2;
      for (const [nodeId, base, errors] of funnel.nodes) {
        const entered = Math.max(0, base + (base > 4 ? delta : 0));
        if (entered === 0 && errors === 0) continue;
        nodeStatDocs.push({
          tenantId: T, flowId: funnel.flowId, flowVersionId: funnel.versionId,
          nodeId, date: dayKey(day), entered,
          errors: day === 1 ? errors : 0,
          outcomes: {},
        });
      }
    }
  }
  await FlowNodeStat.insertMany(nodeStatDocs);
  console.log(`+ ${nodeStatDocs.length} contadores diarios por nodo`);

  // ── 23. Plataforma de desarrolladores ──
  // Las claves se guardan hasheadas: la de la lista no se puede volver a ver
  // (igual que en produccion). El visitante crea la suya desde la UI para el
  // playground; el plan del demo es Pro y la API esta habilitada en todos.
  const activeKeyPlain = `ak_live_${randomBytes(20).toString('hex')}`;
  const revokedKeyPlain = `ak_live_${randomBytes(20).toString('hex')}`;
  await ApiKey.insertMany([
    {
      tenantId: T, name: 'Backend de la tienda',
      prefix: activeKeyPlain.slice(0, 12),
      keyHash: createHash('sha256').update(activeKeyPlain, 'utf8').digest('hex'),
      createdBy: ana._id, lastUsedAt: ago(12), revokedAt: null,
      createdAt: ago(38 * 24 * 60),
    },
    {
      tenantId: T, name: 'Integración con n8n (vieja)',
      prefix: revokedKeyPlain.slice(0, 12),
      keyHash: createHash('sha256').update(revokedKeyPlain, 'utf8').digest('hex'),
      createdBy: ana._id, lastUsedAt: ago(26 * 24 * 60), revokedAt: ago(9 * 24 * 60),
      createdAt: ago(60 * 24 * 60),
    },
  ]);

  const endpointTienda = await WebhookEndpoint.create({
    tenantId: T,
    url: 'https://api.demostore.com.ar/hooks/asis',
    description: 'Sincroniza conversaciones y pedidos con el backend de la tienda',
    secret: `whsec_${randomBytes(24).toString('hex')}`,
    events: ['message.received', 'conversation.created', 'message.status.updated', 'flow.custom'],
    active: true,
    createdAt: ago(38 * 24 * 60),
  });
  const endpointCrm = await WebhookEndpoint.create({
    tenantId: T,
    url: 'https://hooks.zapier.com/hooks/catch/482913/asis-crm',
    description: 'Alta de leads en el CRM (pausado mientras migramos)',
    secret: `whsec_${randomBytes(24).toString('hex')}`,
    events: ['conversation.created', 'flow.completed'],
    active: false,
    createdAt: ago(21 * 24 * 60),
  });

  const deliveries: Record<string, unknown>[] = [];
  const pushDelivery = (input: {
    endpointId: Types.ObjectId;
    eventType: string;
    data: Record<string, unknown>;
    status: 'success' | 'failed' | 'pending';
    minutesAgo: number;
    attempts: number;
    responseStatus?: number | null;
    lastError?: string | null;
    nextRetryMinutes?: number | null;
  }) => {
    const eventId = `evt_${randomBytes(12).toString('hex')}`;
    deliveries.push({
      tenantId: T,
      endpointId: input.endpointId,
      eventId,
      eventType: input.eventType,
      payload: { id: eventId, type: input.eventType, createdAt: ago(input.minutesAgo).toISOString(), data: input.data },
      status: input.status,
      attempts: input.attempts,
      responseStatus: input.responseStatus ?? null,
      responseBody: input.responseStatus === 200 ? '{"ok":true}' : null,
      lastError: input.lastError ?? null,
      lastAttemptAt: ago(input.minutesAgo),
      nextRetryAt: input.nextRetryMinutes !== undefined && input.nextRetryMinutes !== null ? inMinutes(input.nextRetryMinutes) : null,
      createdAt: ago(input.minutesAgo),
    });
  };

  pushDelivery({
    endpointId: endpointTienda._id, eventType: 'message.received', minutesAgo: 5, status: 'success', attempts: 1, responseStatus: 200,
    data: { message: { conversationId: conv3._id.toString(), direction: 'inbound', type: 'text', body: 'Sii! Queria saber los precios de los buzos. Tienen talle S?' } },
  });
  pushDelivery({
    endpointId: endpointTienda._id, eventType: 'conversation.created', minutesAgo: 70, status: 'success', attempts: 1, responseStatus: 200,
    data: { conversation: { id: convAndres._id.toString(), origin: 'inbound', status: 'unassigned' }, contact: { name: 'Andres Bustos', phone: '5491155551017' } },
  });
  pushDelivery({
    endpointId: endpointTienda._id, eventType: 'flow.custom', minutesAgo: 28, status: 'success', attempts: 1, responseStatus: 200,
    data: { name: 'lead.mayorista', flowId: flowLeads._id.toString(), contactId: florencia._id.toString(), data: { volumen: '200 unidades por mes', telefono: '5491155551009' } },
  });
  pushDelivery({
    endpointId: endpointTienda._id, eventType: 'message.status.updated', minutesAgo: 138, status: 'success', attempts: 1, responseStatus: 200,
    data: { messageId: 'demo-status-1', status: 'read', conversationId: convRamiro._id.toString() },
  });
  pushDelivery({
    endpointId: endpointTienda._id, eventType: 'flow.custom', minutesAgo: 150, status: 'success', attempts: 2, responseStatus: 200,
    data: { name: 'envio.notificado', flowId: flowEnvio._id.toString(), data: { pedido: '#5120' } },
  });
  // Fallo con reintentos pendientes: es el estado que la pantalla deja reintentar a mano.
  pushDelivery({
    endpointId: endpointTienda._id, eventType: 'message.received', minutesAgo: 26, status: 'failed', attempts: 3,
    responseStatus: 502, lastError: 'HTTP 502 Bad Gateway', nextRetryMinutes: 22,
    data: { message: { conversationId: convJulian._id.toString(), direction: 'inbound', type: 'text', body: 'Queria saber si hacen envios a La Plata' } },
  });
  pushDelivery({
    endpointId: endpointTienda._id, eventType: 'conversation.created', minutesAgo: 240, status: 'failed', attempts: 6,
    responseStatus: null, lastError: 'connect ETIMEDOUT 190.2.14.77:443',
    data: { conversation: { id: convTomas._id.toString(), origin: 'inbound', status: 'unassigned' }, contact: { name: 'Tomas Quiroga' } },
  });
  pushDelivery({
    endpointId: endpointCrm._id, eventType: 'conversation.created', minutesAgo: 26 * 60, status: 'success', attempts: 1, responseStatus: 200,
    data: { conversation: { id: convBrenda._id.toString(), origin: 'inbound', status: 'active' }, contact: { name: 'Brenda Suarez' } },
  });
  pushDelivery({
    endpointId: endpointCrm._id, eventType: 'flow.completed', minutesAgo: 27 * 60, status: 'success', attempts: 1, responseStatus: 200,
    data: { flowId: flowMenu._id.toString(), conversationId: convBrenda._id.toString(), endReason: 'handoff_human' },
  });
  await WebhookDelivery.insertMany(deliveries);
  console.log(`+ 2 claves de API, 2 webhooks y ${deliveries.length} entregas`);

  // ── Done ──
  console.log('\n--- Demo seed complete ---');
  console.log(`\nDemo login:`);
  console.log(`  POST /api/auth/demo-login (no body needed)`);
  console.log(`  Or manually: demo@asis.chat / demo123`);

  await connection.close();
}

seedDemo().catch((err) => {
  console.error('Demo seed failed:', err);
  process.exit(1);
});
