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

// ── Helpers ─────────────────────────────────────────────

function ago(minutes: number): Date {
  return new Date(Date.now() - minutes * 60 * 1000);
}

function inDays(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function dayKey(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function waId(): string {
  return `demo-${new Types.ObjectId().toHexString()}`;
}

// ── Main ────────────────────────────────────────────────

async function seedDemo() {
  const mongoUri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/whatsapp-teams';

  console.log(`Connecting to ${mongoUri}...`);
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
    { tenantId: T, waId: '5491155551001', name: 'Maria Gonzalez', phone: '+54 9 11 5555-1001', company: 'Tienda Ropa BA', customFields: { direccion: 'Palermo, CABA', presupuesto: '$35.600' }, lastSeenAt: ago(30) },
    { tenantId: T, waId: '5491155551002', name: 'Juan Rodriguez', phone: '+54 9 11 5555-1002', notes: 'Cliente frecuente', lastSeenAt: ago(15) },
    { tenantId: T, waId: '5491155551003', name: 'Valentina Ramirez', phone: '+54 9 11 5555-1003', email: 'vale@email.com', customFields: { talle: 'S', interes: 'buzos y camperas' }, lastSeenAt: ago(5) },
    { tenantId: T, waId: '5491155551004', name: 'Diego Torres', phone: '+54 9 11 5555-1004', company: 'Torres Electronica', lastSeenAt: ago(3) },
    { tenantId: T, waId: '5491155551005', name: 'Camila Herrera', phone: '+54 9 11 5555-1005', lastSeenAt: ago(20) },
    { tenantId: T, waId: '5491155551006', name: 'Sebastian Morales', phone: '+54 9 11 5555-1006', company: 'Morales y Cia', lastSeenAt: ago(1440) },
    { tenantId: T, waId: '5491155551007', name: 'Isabella Acosta', phone: '+54 9 11 5555-1007', email: 'isa.acosta@gmail.com', lastSeenAt: ago(4320) },
    { tenantId: T, waId: '5491155551008', name: 'Mateo Vargas', phone: '+54 9 11 5555-1008', notes: 'Consulto por mayoreo', customFields: { tipo_cliente: 'mayorista', productos: 'remeras y buzos', cantidad_minima: '12 unidades' }, lastSeenAt: ago(60) },
    { tenantId: T, waId: '5491155551009', name: 'Florencia Diaz', phone: '+54 9 351 555-1009', email: 'florencia@tiendacba.com', company: '3 sucursales en Cordoba', customFields: { ciudad: 'Cordoba', volumen_mensual: '200 unidades', tipo_cliente: 'mayorista premium' }, lastSeenAt: ago(25) },
    // Contactos de la campana: uno respondio, otro todavia no
    { tenantId: T, waId: '5491155551010', name: 'Lucas Benitez', phone: '+54 9 11 5555-1010', customFields: { origen: 'campana bienvenida' }, lastSeenAt: ago(95) },
    { tenantId: T, waId: '5491155551011', name: 'Agustina Rossi', phone: '+54 9 11 5555-1011', customFields: { origen: 'campana bienvenida' }, lastSeenAt: ago(180) },
    // Contacto sin asignar, para que la cola de "Sin asignar" tenga trabajo
    { tenantId: T, waId: '5491155551012', name: 'Nicolas Peralta', phone: '+54 9 11 5555-1012', lastSeenAt: ago(2) },
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
  const conv7 = await Conversation.create({
    tenantId: T, phoneNumberId: phone._id, contactId: contacts[6]._id,
    agentId: sofia._id, status: 'active',
    lastMessageAt: ago(8), lastInboundAt: ago(10),
  });
  await createMessages(conv7._id, [
    { dir: 'inbound', body: 'Hola! Donde queda el local? Y a que hora abren?', minutesAgo: 12 },
    { dir: 'outbound', body: 'Hola Isabella! Nuestro local queda en Av. Santa Fe 1234, Palermo. El horario es Lunes a Viernes de 9 a 18hs y Sabados de 10 a 14hs. Te esperamos!', minutesAgo: 11, agentId: sofia._id.toString(), agentName: 'Sofia IA' },
    { dir: 'inbound', body: 'Tienen estacionamiento?', minutesAgo: 10 },
    { dir: 'outbound', body: 'No tenemos estacionamiento propio, pero hay un parking a media cuadra en Av. Santa Fe 1250. Los sabados suele haber lugar en la calle tambien.', minutesAgo: 8, agentId: sofia._id.toString(), agentName: 'Sofia IA' },
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
  const [tplBienvenida, tplPromo, tplCarrito] = templates;
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
        waId: contact.waId, phone: contact.phone,
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
        waId: contact.waId, phone: contact.phone,
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
