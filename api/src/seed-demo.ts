/**
 * Demo seed script — creates a fully populated demo tenant with realistic data.
 *
 * Usage:
 *   npm run seed:demo
 *
 * Idempotent: wipes all demo tenant data, then re-creates everything.
 */

import * as bcrypt from 'bcrypt';
import { connect, connection, model, Schema, Types } from 'mongoose';

// ── Helpers ─────────────────────────────────────────────

function ago(minutes: number): Date {
  return new Date(Date.now() - minutes * 60 * 1000);
}

function waId(): string {
  return `demo-${new Types.ObjectId().toHexString()}`;
}

// ── Inline Schemas ──────────────────────────────────────

const TenantSchema = new Schema({
  name: String,
  slug: { type: String, unique: true },
  isDemo: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const AgentSchema = new Schema({
  tenantId: Types.ObjectId,
  name: String,
  email: { type: String, unique: true },
  passwordHash: String,
  role: { type: String, default: 'agent' },
  status: { type: String, default: 'available' },
  activeCount: { type: Number, default: 0 },
  type: { type: String, default: 'human' },
  createdAt: { type: Date, default: Date.now },
});

const PhoneNumberSchema = new Schema({
  tenantId: Types.ObjectId,
  provider: String,
  providerConfig: Object,
  wabaId: String,
  phoneNumberId: { type: String, unique: true },
  displayPhone: String,
  label: String,
  webhookSecret: String,
  status: { type: String, default: 'active' },
  createdAt: { type: Date, default: Date.now },
});

const AgentPhoneAccessSchema = new Schema({
  agentId: Types.ObjectId,
  phoneNumberId: Types.ObjectId,
});

const ContactSchema = new Schema({
  tenantId: Types.ObjectId,
  waId: String,
  name: String,
  phone: String,
  profilePicUrl: String,
  email: String,
  company: String,
  notes: String,
  customFields: Object,
  lastSeenAt: Date,
  createdAt: { type: Date, default: Date.now },
});

const ConversationSchema = new Schema({
  tenantId: Types.ObjectId,
  phoneNumberId: Types.ObjectId,
  contactId: Types.ObjectId,
  agentId: { type: Types.ObjectId, default: null },
  status: { type: String, default: 'unassigned' },
  lastMessageAt: Date,
  lastInboundAt: Date,
  resolvedAt: { type: Date, default: null },
  closedBy: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});

const MessageSchema = new Schema({
  conversationId: Types.ObjectId,
  direction: String,
  messageType: { type: String, default: 'text' },
  body: String,
  mediaUrl: { type: String, default: null },
  mimeType: { type: String, default: null },
  waMessageId: { type: String, unique: true },
  waStatus: { type: String, default: 'delivered' },
  timestamp: Date,
  senderAgentId: { type: String, default: null },
  senderAgentName: { type: String, default: null },
});

const ConversationEventSchema = new Schema({
  conversationId: Types.ObjectId,
  tenantId: Types.ObjectId,
  type: String,
  performedBy: { type: String, default: null },
  data: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now },
});

const ConversationNoteSchema = new Schema({
  conversationId: Types.ObjectId,
  tenantId: Types.ObjectId,
  authorId: String,
  authorName: String,
  body: String,
  createdAt: { type: Date, default: Date.now },
});

const LabelSchema = new Schema({
  tenantId: Types.ObjectId,
  name: String,
  color: String,
  createdAt: { type: Date, default: Date.now },
});

const ConversationLabelSchema = new Schema({
  conversationId: Types.ObjectId,
  tenantId: Types.ObjectId,
  labelId: Types.ObjectId,
  assignedBy: String,
  createdAt: { type: Date, default: Date.now },
});

const AiAgentConfigSchema = new Schema({
  agentId: Types.ObjectId,
  tenantId: Types.ObjectId,
  provider: String,
  model: String,
  apiKey: String,
  systemPrompt: String,
  knowledgeBase: { type: String, default: '' },
  persona: Object,
  handoffRules: Object,
  contextConfig: Object,
  rateLimits: Object,
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// ── Main ────────────────────────────────────────────────

async function seedDemo() {
  const mongoUri = process.env.MONGODB_URI ?? '***REMOVED***/whatsapp-teams';

  console.log(`Connecting to ${mongoUri}...`);
  await connect(mongoUri);
  console.log('Connected.\n');

  const Tenant = model('Tenant', TenantSchema, 'tenants');
  const Agent = model('Agent', AgentSchema, 'agents');
  const PhoneNumber = model('PhoneNumber', PhoneNumberSchema, 'phone_numbers');
  const Access = model('AgentPhoneAccess', AgentPhoneAccessSchema, 'agent_phone_access');
  const Contact = model('Contact', ContactSchema, 'contacts');
  const Conversation = model('Conversation', ConversationSchema, 'conversations');
  const Message = model('Message', MessageSchema, 'messages');
  const ConvEvent = model('ConversationEvent', ConversationEventSchema, 'conversation_events');
  const ConvNote = model('ConversationNote', ConversationNoteSchema, 'conversation_notes');
  const AiConfig = model('AiAgentConfig', AiAgentConfigSchema, 'ai_agent_configs');
  const Label = model('Label', LabelSchema, 'labels');
  const ConvLabel = model('ConversationLabel', ConversationLabelSchema, 'conversation_labels');

  // ── 1. Clean existing demo data ──
  const existingTenant = await Tenant.findOne({ slug: 'demo-asis-chat' });
  if (existingTenant) {
    const tid = existingTenant._id;
    console.log('Cleaning existing demo data...');

    const agents = await Agent.find({ tenantId: tid });
    const agentIds = agents.map((a) => a._id);

    const conversations = await Conversation.find({ tenantId: tid });
    const convIds = conversations.map((c) => c._id);

    await Message.deleteMany({ conversationId: { $in: convIds } });
    await ConvEvent.deleteMany({ tenantId: tid });
    await ConvNote.deleteMany({ tenantId: tid });
    await Conversation.deleteMany({ tenantId: tid });
    await Contact.deleteMany({ tenantId: tid });
    await AiConfig.deleteMany({ tenantId: tid });
    await ConvLabel.deleteMany({ tenantId: tid });
    await Label.deleteMany({ tenantId: tid });
    await Access.deleteMany({ agentId: { $in: agentIds } });
    await PhoneNumber.deleteMany({ tenantId: tid });
    await Agent.deleteMany({ tenantId: tid });
    await Tenant.deleteOne({ _id: tid });

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
    passwordHash, role: 'admin', status: 'available', type: 'human',
  });
  const carlos = await Agent.create({
    tenantId: T, name: 'Carlos Lopez', email: 'carlos@demo.asis.chat',
    passwordHash, role: 'agent', status: 'available', type: 'human',
  });
  const lucia = await Agent.create({
    tenantId: T, name: 'Lucia Fernandez', email: 'lucia@demo.asis.chat',
    passwordHash, role: 'agent', status: 'busy', type: 'human',
  });
  const sofia = await Agent.create({
    tenantId: T, name: 'Sofia IA', email: 'sofia-ai@demo.asis.chat',
    passwordHash, role: 'agent', status: 'available', type: 'ai',
  });

  console.log(`+ 4 agents (Ana admin, Carlos, Lucia, Sofia IA)`);

  // ── 4. AI Agent Config (Sofia) ──
  await AiConfig.create({
    agentId: sofia._id,
    tenantId: T,
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    apiKey: 'demo-key-not-real',
    systemPrompt: 'Sos Sofia, asistente virtual de la tienda. Respondé consultas sobre productos, envios, devoluciones y horarios de atencion. Sé amable, concisa y usa español latinoamericano. Si el cliente pide hablar con un humano o tiene un problema que no podes resolver, hace el handoff.',
    knowledgeBase: 'Horarios: Lunes a Viernes 9-18hs, Sábados 10-14hs.\nEnvios: CABA 24-48hs, Interior 3-5 dias habiles.\nDevoluciones: hasta 30 dias con ticket de compra.\nMedios de pago: Efectivo, transferencia, tarjetas de crédito/débito.',
    persona: {
      role: 'Asistente virtual de soporte',
      tone: 'Amable y profesional',
      language: 'es',
      instructions: 'Responde consultas sobre productos, envios y devoluciones. Usa vos en lugar de tu.',
    },
    handoffRules: {
      keywords: ['hablar con humano', 'agente', 'persona real', 'quiero hablar con alguien'],
      maxConsecutiveFailures: 3,
      onCustomerRequest: true,
      urgencyKeywords: ['urgente', 'reclamo', 'queja', 'problema grave'],
    },
    contextConfig: { maxHistoryMessages: 10, includeContactInfo: true },
    rateLimits: { maxMessagesPerDay: 500, maxTokensPerDay: 100000 },
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
    { tenantId: T, waId: '5491155551001', name: 'Maria Gonzalez', phone: '+54 9 11 5555-1001', company: 'Tienda Ropa BA', lastSeenAt: ago(30) },
    { tenantId: T, waId: '5491155551002', name: 'Juan Rodriguez', phone: '+54 9 11 5555-1002', notes: 'Cliente frecuente', lastSeenAt: ago(15) },
    { tenantId: T, waId: '5491155551003', name: 'Valentina Ramirez', phone: '+54 9 11 5555-1003', email: 'vale@email.com', lastSeenAt: ago(5) },
    { tenantId: T, waId: '5491155551004', name: 'Diego Torres', phone: '+54 9 11 5555-1004', company: 'Torres Electronica', lastSeenAt: ago(3) },
    { tenantId: T, waId: '5491155551005', name: 'Camila Herrera', phone: '+54 9 11 5555-1005', lastSeenAt: ago(20) },
    { tenantId: T, waId: '5491155551006', name: 'Sebastian Morales', phone: '+54 9 11 5555-1006', company: 'Morales y Cia', lastSeenAt: ago(1440) },
    { tenantId: T, waId: '5491155551007', name: 'Isabella Acosta', phone: '+54 9 11 5555-1007', email: 'isa.acosta@gmail.com', lastSeenAt: ago(4320) },
    { tenantId: T, waId: '5491155551008', name: 'Mateo Vargas', phone: '+54 9 11 5555-1008', notes: 'Consulto por mayoreo', lastSeenAt: ago(60) },
  ]);
  console.log(`+ 8 contacts`);

  const [maria, juan, valentina, diego, camila, sebastian] = contacts;

  // ── 8. Conversations & Messages ──

  // Helper to create messages
  async function createMessages(convId: Types.ObjectId, msgs: { dir: 'inbound' | 'outbound'; body: string; minutesAgo: number; agentId?: string; agentName?: string }[]) {
    const docs = msgs.map((m) => ({
      conversationId: convId,
      direction: m.dir,
      messageType: 'text',
      body: m.body,
      waMessageId: waId(),
      waStatus: m.dir === 'outbound' ? 'delivered' : undefined,
      timestamp: ago(m.minutesAgo),
      senderAgentId: m.agentId ?? null,
      senderAgentName: m.agentName ?? null,
    }));
    await Message.insertMany(docs);
  }

  // --- Conv 1: Maria → active, assigned to Ana (product & shipping inquiry) ---
  const conv1 = await Conversation.create({
    tenantId: T, phoneNumberId: phone._id, contactId: maria._id,
    agentId: ana._id, status: 'active',
    lastMessageAt: ago(25), lastInboundAt: ago(25),
  });
  await createMessages(conv1._id, [
    { dir: 'inbound', body: 'Hola! Queria saber si tienen la remera oversize en talle M', minutesAgo: 120 },
    { dir: 'outbound', body: 'Hola Maria! Si, tenemos stock en M. La tenemos en negro, blanco y verde. Cual te interesa?', minutesAgo: 115, agentId: ana._id.toString(), agentName: 'Demo User' },
    { dir: 'inbound', body: 'La negra! Cuanto sale?', minutesAgo: 110 },
    { dir: 'outbound', body: '$12.500. Hacemos envios a todo CABA en 24-48hs', minutesAgo: 105, agentId: ana._id.toString(), agentName: 'Demo User' },
    { dir: 'inbound', body: 'Genial, y el envio cuanto sale?', minutesAgo: 60 },
    { dir: 'outbound', body: 'El envio a CABA es gratis para compras mayores a $10.000! Asi que te queda sin cargo', minutesAgo: 55, agentId: ana._id.toString(), agentName: 'Demo User' },
    { dir: 'inbound', body: 'Buenisimo! La quiero. Como pago?', minutesAgo: 30 },
    { dir: 'outbound', body: 'Te paso el link de pago por MercadoPago. Aceptamos tarjeta y transferencia', minutesAgo: 25, agentId: ana._id.toString(), agentName: 'Demo User' },
  ]);

  // --- Conv 2: Juan → active, assigned to Carlos (order tracking) ---
  const conv2 = await Conversation.create({
    tenantId: T, phoneNumberId: phone._id, contactId: juan._id,
    agentId: carlos._id, status: 'active',
    lastMessageAt: ago(10), lastInboundAt: ago(10),
  });
  await createMessages(conv2._id, [
    { dir: 'inbound', body: 'Buenas, hice un pedido hace 5 dias y todavia no llego. Numero de orden: #4521', minutesAgo: 45 },
    { dir: 'outbound', body: 'Hola Juan! Dejame chequear el estado de tu pedido', minutesAgo: 40, agentId: carlos._id.toString(), agentName: 'Carlos Lopez' },
    { dir: 'outbound', body: 'Tu pedido #4521 fue despachado el lunes. Segun el tracking esta en el centro de distribucion de Correo Argentino. Deberia llegar hoy o manana', minutesAgo: 35, agentId: carlos._id.toString(), agentName: 'Carlos Lopez' },
    { dir: 'inbound', body: 'Me dijeron lo mismo la semana pasada...', minutesAgo: 15 },
    { dir: 'inbound', body: 'Ya estoy un poco cansado la verdad', minutesAgo: 10 },
  ]);

  // --- Conv 3: Valentina → unassigned (pricing inquiry) ---
  const conv3 = await Conversation.create({
    tenantId: T, phoneNumberId: phone._id, contactId: valentina._id,
    status: 'unassigned',
    lastMessageAt: ago(5), lastInboundAt: ago(5),
  });
  await createMessages(conv3._id, [
    { dir: 'inbound', body: 'Hola, buenos dias! Vi en Instagram que tienen descuentos esta semana', minutesAgo: 8 },
    { dir: 'inbound', body: 'Queria saber los precios de los buzos', minutesAgo: 7 },
    { dir: 'inbound', body: 'Tienen talle S?', minutesAgo: 5 },
  ]);

  // --- Conv 4: Diego → unassigned (technical question) ---
  const conv4 = await Conversation.create({
    tenantId: T, phoneNumberId: phone._id, contactId: diego._id,
    status: 'unassigned',
    lastMessageAt: ago(3), lastInboundAt: ago(3),
  });
  await createMessages(conv4._id, [
    { dir: 'inbound', body: 'Hola, necesito saber las especificaciones tecnicas del parlante bluetooth que tienen publicado', minutesAgo: 4 },
    { dir: 'inbound', body: 'Es resistente al agua?', minutesAgo: 3 },
  ]);

  // --- Conv 5: Camila → active, assigned to Sofia IA (returns policy) ---
  const conv5 = await Conversation.create({
    tenantId: T, phoneNumberId: phone._id, contactId: camila._id,
    agentId: sofia._id, status: 'active',
    lastMessageAt: ago(18), lastInboundAt: ago(20),
  });
  await createMessages(conv5._id, [
    { dir: 'inbound', body: 'Hola, compre una campera la semana pasada y me queda grande. Puedo cambiarla?', minutesAgo: 45 },
    { dir: 'outbound', body: 'Hola Camila! Si, podes hacer el cambio dentro de los 30 dias desde la compra. Necesitas tener el ticket de compra. Queres que te explique el proceso?', minutesAgo: 44, agentId: sofia._id.toString(), agentName: 'Sofia IA' },
    { dir: 'inbound', body: 'Si dale, como hago?', minutesAgo: 40 },
    { dir: 'outbound', body: 'Es muy simple:\n1. Acercate a nuestra sucursal con la campera y el ticket\n2. Elegí el talle correcto\n3. Si hay diferencia de precio, se ajusta en el momento\n\nNuestro horario es Lunes a Viernes de 9 a 18hs y Sabados de 10 a 14hs', minutesAgo: 39, agentId: sofia._id.toString(), agentName: 'Sofia IA' },
    { dir: 'inbound', body: 'Y si quiero que me devuelvan la plata en vez de cambiar?', minutesAgo: 25 },
    { dir: 'outbound', body: 'Tambien se puede! La devolucion se procesa en 5-7 dias habiles al mismo medio de pago que usaste. Solo necesitas el ticket y el producto en buen estado con las etiquetas', minutesAgo: 18, agentId: sofia._id.toString(), agentName: 'Sofia IA' },
  ]);

  // --- Conv 6: Sebastian → resolved (shipping issue resolved) ---
  const conv6 = await Conversation.create({
    tenantId: T, phoneNumberId: phone._id, contactId: sebastian._id,
    agentId: ana._id, status: 'resolved',
    lastMessageAt: ago(1440), lastInboundAt: ago(1445),
    resolvedAt: ago(1430), closedBy: ana._id.toString(),
  });
  await createMessages(conv6._id, [
    { dir: 'inbound', body: 'Hola, me llego el pedido equivocado. Pedi zapatillas talle 42 y me mandaron talle 38', minutesAgo: 1500 },
    { dir: 'outbound', body: 'Hola Sebastian! Disculpa por el error. Te vamos a mandar el talle correcto por envio express sin costo', minutesAgo: 1490, agentId: ana._id.toString(), agentName: 'Demo User' },
    { dir: 'inbound', body: 'Y que hago con las que me llegaron?', minutesAgo: 1450 },
    { dir: 'outbound', body: 'Un cadete las pasa a buscar manana entre 10 y 14hs. No te preocupes por nada, nosotros nos encargamos!', minutesAgo: 1445, agentId: ana._id.toString(), agentName: 'Demo User' },
  ]);

  console.log(`+ 6 conversations with messages`);

  // ── 9. Conversation Events ──
  const events = [
    // Conv 1
    { conversationId: conv1._id, tenantId: T, type: 'created', createdAt: ago(120) },
    { conversationId: conv1._id, tenantId: T, type: 'assigned', performedBy: ana._id.toString(), data: { agentName: 'Demo User' }, createdAt: ago(115) },
    // Conv 2
    { conversationId: conv2._id, tenantId: T, type: 'created', createdAt: ago(45) },
    { conversationId: conv2._id, tenantId: T, type: 'assigned', performedBy: carlos._id.toString(), data: { agentName: 'Carlos Lopez' }, createdAt: ago(40) },
    // Conv 3
    { conversationId: conv3._id, tenantId: T, type: 'created', createdAt: ago(8) },
    // Conv 4
    { conversationId: conv4._id, tenantId: T, type: 'created', createdAt: ago(4) },
    // Conv 5
    { conversationId: conv5._id, tenantId: T, type: 'created', createdAt: ago(45) },
    { conversationId: conv5._id, tenantId: T, type: 'assigned', performedBy: sofia._id.toString(), data: { agentName: 'Sofia IA' }, createdAt: ago(44) },
    // Conv 6
    { conversationId: conv6._id, tenantId: T, type: 'created', createdAt: ago(1500) },
    { conversationId: conv6._id, tenantId: T, type: 'assigned', performedBy: ana._id.toString(), data: { agentName: 'Demo User' }, createdAt: ago(1490) },
    { conversationId: conv6._id, tenantId: T, type: 'resolved', performedBy: ana._id.toString(), data: { agentName: 'Demo User' }, createdAt: ago(1430) },
  ];
  await ConvEvent.insertMany(events);
  console.log(`+ ${events.length} conversation events`);

  // ── 10. Conversation Notes ──
  await ConvNote.insertMany([
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
  console.log(`+ 2 conversation notes`);

  // ── 11. Labels ──
  const labels = await Label.insertMany([
    { tenantId: T, name: 'VIP', color: '#f59e0b' },
    { tenantId: T, name: 'Urgente', color: '#ef4444' },
    { tenantId: T, name: 'Nuevo', color: '#3b82f6' },
    { tenantId: T, name: 'Envio', color: '#8b5cf6' },
    { tenantId: T, name: 'Devolucion', color: '#f97316' },
    { tenantId: T, name: 'Mayorista', color: '#10b981' },
  ]);
  const [lVip, lUrgente, lNuevo, lEnvio, lDevolucion] = labels;
  console.log(`+ 6 labels`);

  // ── 12. Conversation Labels ──
  await ConvLabel.insertMany([
    { conversationId: conv1._id, tenantId: T, labelId: lVip._id, assignedBy: ana._id.toString() },
    { conversationId: conv2._id, tenantId: T, labelId: lUrgente._id, assignedBy: carlos._id.toString() },
    { conversationId: conv2._id, tenantId: T, labelId: lEnvio._id, assignedBy: carlos._id.toString() },
    { conversationId: conv3._id, tenantId: T, labelId: lNuevo._id, assignedBy: ana._id.toString() },
    { conversationId: conv5._id, tenantId: T, labelId: lDevolucion._id, assignedBy: sofia._id.toString() },
    { conversationId: conv6._id, tenantId: T, labelId: lEnvio._id, assignedBy: ana._id.toString() },
  ]);
  console.log(`+ 6 conversation-label assignments`);

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
