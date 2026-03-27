# WhatsApp for Teams — Backend Specification

## Overview

Multi-tenant, multi-number WhatsApp agent routing system. Built with Nest.js, MongoDB (Mongoose), and Meta Cloud API.

GoHook (gohook.in) sits between Meta and this backend as a webhook proxy for logging and inspection.

```
Contacto (WhatsApp)
  → Meta Cloud API
  → GoHook (log + forward)
  → Este Backend (Nest.js)
  → MongoDB + Redis
  → WebSocket → Agent UI
  → Respuesta vía Cloud API → Contacto
```

---

## Authentication & Authorization

### Auth Flow

Agents log in with email + password. The backend issues a JWT containing tenant and agent context.

```
POST /auth/login
  Body: { email, password }
  Returns: { accessToken, agent: { _id, name, email, role } }

POST /auth/refresh
  Body: { refreshToken }
  Returns: { accessToken }
```

### JWT Payload

```json
{
  "sub": "agentId",
  "tenantId": "tenantId",
  "role": "admin | agent",
  "iat": 1234567890,
  "exp": 1234567890
}
```

### Roles

| Role    | Can do                                                              |
|---------|---------------------------------------------------------------------|
| `admin` | Manage phone numbers, agents, phone access, view all conversations  |
| `agent` | View/handle assigned conversations, change own status               |

### Nest.js Implementation

- **JwtAuthGuard** (global): validates token, injects `req.agent` with `{ _id, tenantId, role }`.
- **RolesGuard** + `@Roles('admin')` decorator: restricts endpoints by role.
- All services receive `tenantId` from `req.agent.tenantId` — never from URL params.
- Webhook endpoints (`/webhooks/*`) are excluded from auth (validated by Meta signature instead).

### Tenant Scoping

The `tenantId` is **always extracted from the JWT**, not from URL params. This:
- Prevents cross-tenant data access
- Keeps URLs clean
- Makes authorization implicit

**Exception**: `/tenants` CRUD endpoints are superadmin-only (separate auth, not part of agent JWT flow).

---

## Data Model

### Tenant

The organization/team. Everything is scoped to a tenant.

```
TENANT
------
_id            ObjectId  PK
name           string          # "Recruitech SA", "Inmobiliaria Sur"
slug           string  UNIQUE  # para URLs: recruitech-sa
createdAt      date
```

### PhoneNumber

Each WhatsApp Business line connected to the system. Supports multiple messaging providers.

```
PHONE_NUMBER
------------
_id            ObjectId  PK
tenantId       ObjectId  FK -> Tenant
provider       enum            # meta | twilio | 360dialog
wabaId         string          # WhatsApp Business Account ID (provider-specific)
phoneNumberId  string  UNIQUE  # Provider's phone number ID (from webhook payload)
displayPhone   string          # "+598 99 123 456"
label          string          # "Ventas", "Soporte", "RRHH"
webhookSecret  string          # para validar firma de webhooks
status         enum            # active | inactive
createdAt      date
```

### Agent

A team member who handles conversations.

```
AGENT
-----
_id            ObjectId  PK
tenantId       ObjectId  FK -> Tenant
name           string
email          string  UNIQUE
passwordHash   string          # bcrypt hash
role           enum            # admin | agent (default: agent)
status         enum            # available | busy | offline
activeCount    int             # current assigned open conversations (default: 0)
createdAt      date
```

### AgentPhoneAccess

Pivot table. Controls which agents can handle which phone numbers. This single table enables all three scenarios:

- 1 number → many agents (multiple agents with access to same phone)
- 1 agent → many numbers (one agent with access to multiple phones)
- N numbers → N agents (free combination)

```
AGENT_PHONE_ACCESS
------------------
agentId        ObjectId  FK -> Agent
phoneNumberId  ObjectId  FK -> PhoneNumber
```

### Contact

An external person who messages a WhatsApp number. Scoped to tenant — the same real person messaging two different tenants creates two Contact records.

```
CONTACT
-------
_id            ObjectId  PK
tenantId       ObjectId  FK -> Tenant
waId           string          # WhatsApp ID from webhook (e.g. "5491155551234")
name           string
phone          string
profilePicUrl  string | null   # from Meta webhook profile object
lastSeenAt     date            # updated on each inbound message
createdAt      date
```

### Conversation

The core entity. Links a contact to an agent through a specific phone number.

```
CONVERSATION
------------
_id            ObjectId  PK
tenantId       ObjectId  FK -> Tenant
phoneNumberId  ObjectId  FK -> PhoneNumber   # which number received the message
contactId      ObjectId  FK -> Contact
agentId        ObjectId  FK -> Agent | null   # null = unassigned
status         enum            # unassigned | active | resolved
lastMessageAt  date
lastInboundAt  date            # tracks Meta's 24h window for outbound messages
createdAt      date
resolvedAt     date | null
closedBy       string | null   # agentId | "system" (null while open)
```

### RefreshToken

Stores hashed refresh tokens. Separate collection allows multiple sessions per agent and selective revocation.

```
REFRESH_TOKEN
-------------
_id            ObjectId  PK
agentId        ObjectId  FK -> Agent
tokenHash      string          # SHA-256 hash of the refresh token
expiresAt      date            # TTL — auto-cleanup via MongoDB TTL index
createdAt      date
```

### Message

Individual messages within a conversation.

```
MESSAGE
-------
_id              ObjectId  PK
conversationId   ObjectId  FK -> Conversation
direction        enum            # inbound | outbound
messageType      enum            # text | image | audio | video | document | location
body             string | null   # text content (null for media-only messages)
mediaUrl         string | null   # URL of media file (from Meta CDN or stored)
mimeType         string | null   # e.g. "image/jpeg", "audio/ogg"
waMessageId      string  UNIQUE  # Meta's message ID — UNIQUE for idempotency
waStatus         enum            # sent | delivered | read | failed
timestamp        date
```

---

## Relationships

```
Tenant        1 : N  PhoneNumber
Tenant        1 : N  Agent
Tenant        1 : N  Contact
Tenant        1 : N  Conversation
PhoneNumber   N : N  Agent          (via AgentPhoneAccess)
PhoneNumber   1 : N  Conversation
Contact       1 : N  Conversation
Agent         1 : N  Conversation
Agent         1 : N  RefreshToken
Conversation  1 : N  Message
```

---

## Indexes

```
Agent:             { email: 1 }                                   UNIQUE
PhoneNumber:       { phoneNumberId: 1 }                           UNIQUE
Contact:           { tenantId: 1, waId: 1 }                       UNIQUE
Conversation:      { tenantId: 1, status: 1 }
Conversation:      { contactId: 1, phoneNumberId: 1, status: 1 }
Message:           { conversationId: 1, timestamp: 1 }
Message:           { waMessageId: 1 }                             UNIQUE  # idempotency
AgentPhoneAccess:  { agentId: 1, phoneNumberId: 1 }               UNIQUE
AgentPhoneAccess:  { phoneNumberId: 1 }
RefreshToken:      { agentId: 1 }
RefreshToken:      { tokenHash: 1 }                              UNIQUE
RefreshToken:      { expiresAt: 1 }                              TTL (expireAfterSeconds: 0)
```

---

## REST Endpoints

> **Tenant scoping**: all endpoints below (except webhooks and auth) require a valid JWT.
> The `tenantId` is extracted from the JWT — it never appears in the URL.
> Endpoints marked `@Roles('admin')` require admin role.

### Auth

```
POST   /auth/login
  Body: { email, password }
  Returns: { accessToken, refreshToken, agent }

POST   /auth/refresh
  Body: { refreshToken }
  Returns: { accessToken }

GET    /auth/me
  Returns: Agent (current logged-in agent with tenant info)
```

### Webhooks (no auth — validated by Meta signature)

```
GET  /webhooks/whatsapp
  - Meta webhook verification (hub.mode, hub.challenge, hub.verify_token)
  - Return hub.challenge

POST /webhooks/whatsapp
  - Receives webhook from GoHook (forwarded from Meta)
  - Headers: validate X-Hub-Signature-256 against phoneNumber.webhookSecret
  - Payload: Meta Cloud API webhook format
  - Actions:
    1. Parse entry[].changes[].value
    2. Handle message types: messages (inbound), statuses (delivery updates)
    3. For inbound message:
       a. Identify phoneNumberId from metadata.phone_number_id
       b. Look up PhoneNumber → get tenantId
       c. Find or create Contact by { tenantId, waId }
          - Update contact.profilePicUrl from payload profile if present
          - Update contact.lastSeenAt
       d. Find open Conversation for { contactId, phoneNumberId, status != resolved }
          - If none → create with status: "unassigned"
       e. Upsert Message by { waMessageId } with { direction: "inbound", body, messageType, mediaUrl, mimeType, timestamp }
          - Upsert prevents duplicates from Meta webhook retries
       f. Update conversation.lastMessageAt and conversation.lastInboundAt
       g. If conversation.status === "unassigned" → call AssignmentService.assign()
       h. Emit WebSocket event to relevant agents
    4. For status update:
       a. Find Message by waMessageId
       b. Update waStatus (sent → delivered → read)
       c. Emit WebSocket event to conversation room
  - Return 200 OK immediately (Meta retries on timeout)
```

### Tenants (superadmin only — separate auth)

```
POST   /tenants
  Body: { name, slug }
  Returns: Tenant

GET    /tenants/:tenantId
  Returns: Tenant
```

### Phone Numbers

```
POST   /phone-numbers                               @Roles('admin')
  Body: { provider, wabaId, phoneNumberId, displayPhone, label, webhookSecret }
  Returns: PhoneNumber

GET    /phone-numbers
  Returns: PhoneNumber[]

PATCH  /phone-numbers/:id                            @Roles('admin')
  Body: { label?, status?, webhookSecret? }
  Returns: PhoneNumber
```

### Agents

```
POST   /agents                                       @Roles('admin')
  Body: { name, email, password, role? }
  Returns: Agent (status defaults to "available", activeCount to 0)

GET    /agents
  Query: ?status=available
  Returns: Agent[]

PATCH  /agents/:id/status
  Body: { status: "available" | "busy" | "offline" }
  Auth: agent can change own status; admin can change any
  Returns: Agent
  Side effect: if going offline → calls auto-assign for each of the agent's active conversations

POST   /agents/:agentId/phone-access                 @Roles('admin')
  Body: { phoneNumberId }
  Returns: AgentPhoneAccess
  Validates: phoneNumber belongs to same tenant

DELETE /agents/:agentId/phone-access/:phoneNumberId   @Roles('admin')
  Side effect: calls auto-assign for each active conversation this agent has on this number
  Returns: 204

GET    /agents/:agentId/phone-access
  Returns: PhoneNumber[] (numbers this agent can handle)
```

### Conversations

```
GET    /conversations
  Query: ?status=unassigned|active|resolved
         &agentId=xxx
         &phoneNumberId=xxx
         &page=1&limit=20
  Sort: lastMessageAt DESC
  Auth: admin sees all; agent sees only own + unassigned
  Returns: { data: Conversation[] (populated with contact + agent name), meta: { total, page, pages } }

GET    /conversations/:id
  Returns: Conversation (populated with contact, agent, phoneNumber)

GET    /conversations/:id/messages
  Query: ?page=1&limit=50
  Sort: timestamp ASC
  Returns: { data: Message[], meta: { total, page, pages } }

POST   /conversations/:id/messages
  Body: { body, messageType? }
  Auth: must be the assigned agent
  Validates:
    - Agent is assigned to this conversation
    - If messageType is "text", body is required
    - 24h window check: now - conversation.lastInboundAt < 24h
      - If expired → return 403 with error "24h window expired, use a template"
  Actions:
    1. Send message via WhatsApp Cloud API (using phoneNumber's credentials)
    2. Create Message { direction: "outbound", messageType, body, waMessageId: response.messages[0].id }
    3. Update conversation.lastMessageAt
    4. Emit WebSocket event
  Returns: Message

PATCH  /conversations/:id/assign                     @Roles('admin')
  Body: { agentId }
  Actions:
    1. If currently assigned → decrement old agent's activeCount
    2. Set new agentId, set status: "active"
    3. Increment new agent's activeCount
    4. Emit WebSocket event to old and new agent
  Returns: Conversation

PATCH  /conversations/:id/resolve
  Auth: assigned agent or admin
  Actions:
    1. Set status: "resolved", resolvedAt: now, closedBy: req.agent._id
    2. Decrement agent's activeCount
    3. Set agentId: null (free the agent)
    4. Emit WebSocket event
  Returns: Conversation
```

---

## WebSocket Events (Socket.io)

### Connection

Agents connect via Socket.io with their JWT. The server validates the token and auto-joins the agent to rooms.

```typescript
// Client connection
const socket = io('/ws', {
  auth: { token: 'jwt-token-here' }
});

// Server: on connection
socket.join(`tenant:${tenantId}`);        // all tenant-wide events
socket.join(`agent:${agentId}`);          // personal events (assignments)
```

### Events (server → client)

| Event                    | Room                | Payload                              | When                                    |
|--------------------------|---------------------|--------------------------------------|-----------------------------------------|
| `conversation.new`       | `agent:{agentId}`   | Conversation (populated)             | New conversation assigned to agent      |
| `conversation.assigned`  | `agent:{agentId}`   | Conversation (populated)             | Existing conversation reassigned        |
| `conversation.resolved`  | `tenant:{tenantId}` | `{ conversationId }`                 | Conversation resolved                   |
| `conversation.updated`   | `tenant:{tenantId}` | Conversation (populated)             | Any conversation field changed          |
| `message.new`            | `conv:{convId}`     | Message                              | New inbound or outbound message         |
| `message.status`         | `conv:{convId}`     | `{ waMessageId, waStatus }`          | Delivery status update                  |

### Rooms (client → server)

```
socket.emit('join:conversation', { conversationId })    // join conv room to get messages
socket.emit('leave:conversation', { conversationId })   // leave conv room
```

---

## Assignment Logic (AssignmentService)

```typescript
// Atomic least-loaded assignment to prevent race conditions

async assign(conversation: Conversation): Promise<Agent | null> {
  // 1. Get agents with access to this phone number
  const accessList = await AgentPhoneAccess.find({
    phoneNumberId: conversation.phoneNumberId
  });
  const agentIds = accessList.map(a => a.agentId);

  // 2. Atomically find available agent with lowest load and increment
  //    findOneAndUpdate prevents two concurrent webhooks from assigning the same agent
  const agent = await Agent.findOneAndUpdate(
    {
      _id: { $in: agentIds },
      status: 'available',
    },
    { $inc: { activeCount: 1 } },
    {
      sort: { activeCount: 1 },  // least loaded first
      new: true,
    }
  );

  if (!agent) {
    // No available agents — conversation stays unassigned
    // Emit event so admins can see unassigned conversations in real-time
    this.gateway.emitToTenant(conversation.tenantId, 'conversation.unassigned', conversation);
    return null;
  }

  // 3. Assign conversation
  conversation.agentId = agent._id;
  conversation.status = 'active';
  await conversation.save();

  // 4. Notify agent via WebSocket
  this.gateway.emitToAgent(agent._id, 'conversation.new', conversation);

  return agent;
}
```

---

## 24-Hour Window Enforcement

Meta only allows free-form messages within 24 hours of the contact's last inbound message. After that, only pre-approved Message Templates can be sent.

```typescript
// In outbound message handler
const hoursSinceLastInbound =
  (Date.now() - conversation.lastInboundAt.getTime()) / (1000 * 60 * 60);

if (hoursSinceLastInbound >= 24) {
  throw new ForbiddenException(
    'The 24-hour messaging window has expired. Use an approved Message Template to re-engage this contact.'
  );
}
```

---

## Idempotency

Meta webhooks can deliver the same event multiple times (network retries, GoHook retries, etc.).

**Strategy**:
- `Message.waMessageId` has a **UNIQUE index**.
- Inbound message processing uses **upsert** by `waMessageId` — if the message already exists, it's a no-op.
- Status updates use `updateOne` by `waMessageId` — naturally idempotent (re-applying the same status is harmless).

```typescript
// Idempotent message creation
await Message.updateOne(
  { waMessageId },
  {
    $setOnInsert: {
      conversationId,
      direction: 'inbound',
      messageType,
      body,
      mediaUrl,
      mimeType,
      waStatus: 'delivered',
      timestamp,
    }
  },
  { upsert: true }
);
```

---

## Rate Limiting

| Endpoint               | Limit           | Notes                                    |
|------------------------|-----------------|------------------------------------------|
| `POST /auth/login`     | 5 req/min/IP    | Prevent brute force                      |
| `POST /*/messages`     | 30 req/min/agent| Respect Meta's per-number throughput     |
| All other endpoints    | 100 req/min/agent| General protection                      |

Implemented via `@nestjs/throttler` with Redis store for multi-instance support.

---

## Clean Architecture Guide

### Layers

4 layers. Dependencies flow inward only.

```
Presentation → Application → Domain ← Infrastructure
```

| Layer          | Responsibility                                                                                         | May depend on        |
|----------------|--------------------------------------------------------------------------------------------------------|----------------------|
| **Domain**     | Pure TypeScript. Zero imports from Nest.js, Mongoose, or any library. Entities, enums, value objects, repository interfaces, domain services. | Nothing              |
| **Application**| Use cases that orchestrate domain logic. Defines outbound ports (interfaces for external services like WhatsApp API, realtime gateway, password hashing, token generation). | Domain               |
| **Infrastructure** | Implements domain repository interfaces and application ports. Mongoose schemas/repos, Meta Cloud API client, Socket.io gateway, bcrypt, JWT. | Domain + Application |
| **Presentation** | HTTP controllers + WebSocket gateway setup. Thin — validates/parses input, calls a use case, formats response. | Application          |

---

### Folder Structure

```
src/
├── domain/
│   ├── entities/
│   │   ├── tenant.entity.ts
│   │   ├── phone-number.entity.ts
│   │   ├── agent.entity.ts
│   │   ├── agent-phone-access.entity.ts
│   │   ├── contact.entity.ts
│   │   ├── conversation.entity.ts
│   │   └── message.entity.ts
│   ├── enums/
│   │   ├── agent-role.enum.ts              # admin | agent
│   │   ├── agent-status.enum.ts            # available | busy | offline
│   │   ├── conversation-status.enum.ts     # unassigned | active | resolved
│   │   ├── message-direction.enum.ts       # inbound | outbound
│   │   ├── message-type.enum.ts            # text | image | audio | video | document | location
│   │   ├── message-wa-status.enum.ts       # sent | delivered | read | failed
│   │   ├── messaging-provider.enum.ts      # meta | twilio | 360dialog
│   │   └── phone-number-status.enum.ts     # active | inactive
│   ├── repositories/                       # Interfaces only — no implementations
│   │   ├── tenant.repository.ts
│   │   ├── phone-number.repository.ts
│   │   ├── agent.repository.ts
│   │   ├── agent-phone-access.repository.ts
│   │   ├── contact.repository.ts
│   │   ├── conversation.repository.ts
│   │   ├── message.repository.ts
│   │   └── refresh-token.repository.ts
│   ├── services/
│   │   └── assignment-rules.domain-service.ts   # Pure selection logic (no I/O)
│   │       # Receives a list of candidate agents, returns the best pick.
│   │       # Rule: least activeCount among available agents with phone access.
│   │       # The atomic DB operation lives in the repository, not here.
│   └── errors/
│       └── domain-errors.ts
│
├── application/
│   ├── use-cases/
│   │   ├── auth/
│   │   │   ├── login.use-case.ts
│   │   │   ├── refresh-token.use-case.ts
│   │   │   └── get-current-agent.use-case.ts         # GET /auth/me
│   │   ├── webhook/
│   │   │   ├── handle-inbound-message.use-case.ts
│   │   │   └── handle-status-update.use-case.ts
│   │   ├── conversation/
│   │   │   ├── list-conversations.use-case.ts
│   │   │   ├── get-conversation-detail.use-case.ts
│   │   │   ├── get-conversation-messages.use-case.ts # GET /conversations/:id/messages
│   │   │   ├── send-message.use-case.ts
│   │   │   ├── assign-conversation.use-case.ts       # Manual admin reassignment
│   │   │   ├── auto-assign-conversation.use-case.ts  # Called internally by webhook, offline, revoke
│   │   │   └── resolve-conversation.use-case.ts
│   │   ├── agent/
│   │   │   ├── create-agent.use-case.ts
│   │   │   ├── list-agents.use-case.ts
│   │   │   ├── update-agent-status.use-case.ts       # If offline → calls auto-assign per active conv
│   │   │   ├── grant-phone-access.use-case.ts
│   │   │   ├── revoke-phone-access.use-case.ts       # Calls auto-assign per active conv on that number
│   │   │   └── get-agent-phone-access.use-case.ts    # GET /agents/:agentId/phone-access
│   │   ├── phone-number/
│   │   │   ├── register-phone-number.use-case.ts     # POST /phone-numbers
│   │   │   ├── list-phone-numbers.use-case.ts        # GET /phone-numbers
│   │   │   └── update-phone-number.use-case.ts       # PATCH /phone-numbers/:id
│   │   └── tenant/
│   │       ├── create-tenant.use-case.ts
│   │       └── get-tenant.use-case.ts
│   ├── ports/                              # Outbound interfaces (implemented in infra)
│   │   ├── messaging-api.port.ts           # Send messages via any provider (Meta, Twilio, 360dialog)
│   │   ├── realtime-gateway.port.ts        # Emit events to connected agents
│   │   ├── password-hasher.port.ts         # Hash + verify passwords
│   │   └── token-provider.port.ts          # Sign + verify JWT tokens
│   ├── dtos/                               # Use case input/output contracts (framework-agnostic)
│   │   ├── auth/
│   │   │   ├── login-input.dto.ts
│   │   │   └── login-output.dto.ts
│   │   ├── webhook/
│   │   │   ├── inbound-message-input.dto.ts  # Normalized from Meta payload by controller
│   │   │   └── status-update-input.dto.ts
│   │   ├── conversation/
│   │   │   ├── conversation-filters.dto.ts
│   │   │   └── send-message-input.dto.ts
│   │   ├── agent/
│   │   │   └── create-agent-input.dto.ts
│   │   ├── phone-number/
│   │   │   ├── register-phone-number-input.dto.ts
│   │   │   └── update-phone-number-input.dto.ts
│   │   └── common/
│   │       └── pagination.dto.ts
│   └── common/
│       └── result.ts                       # Result<T, E> pattern for error handling
│
├── infrastructure/
│   ├── persistence/
│   │   ├── mongoose/
│   │   │   ├── schemas/
│   │   │   │   ├── tenant.schema.ts
│   │   │   │   ├── phone-number.schema.ts
│   │   │   │   │   ├── agent.schema.ts
│   │   │   │   ├── agent-phone-access.schema.ts
│   │   │   │   ├── contact.schema.ts
│   │   │   │   ├── conversation.schema.ts
│   │   │   │   ├── message.schema.ts
│   │   │   │   └── refresh-token.schema.ts
│   │   │   ├── repositories/
│   │   │   │   ├── mongo-tenant.repository.ts
│   │   │   │   ├── mongo-phone-number.repository.ts
│   │   │   │   ├── mongo-agent.repository.ts
│   │   │   │   │   # Implements findAvailableByIdsAndIncrementLoad()
│   │   │   │   │   # using atomic findOneAndUpdate + $inc
│   │   │   │   ├── mongo-agent-phone-access.repository.ts
│   │   │   │   ├── mongo-contact.repository.ts
│   │   │   │   ├── mongo-conversation.repository.ts
│   │   │   │   ├── mongo-message.repository.ts
│   │   │   │   └── mongo-refresh-token.repository.ts
│   │   │   └── mappers/
│   │   │       ├── tenant.mapper.ts
│   │   │       ├── phone-number.mapper.ts
│   │   │       ├── agent.mapper.ts
│   │   │       ├── agent-phone-access.mapper.ts
│   │   │       ├── contact.mapper.ts
│   │   │       ├── conversation.mapper.ts
│   │   │       ├── message.mapper.ts
│   │   │       └── refresh-token.mapper.ts
│   │   └── persistence.module.ts
│   ├── whatsapp/
│   │   ├── meta-cloud-api.service.ts       # Implements WhatsAppApiPort
│   │   └── whatsapp.module.ts
│   ├── websocket/
│   │   ├── socketio-gateway.service.ts     # Implements RealtimeGatewayPort
│   │   └── websocket.module.ts
│   ├── auth/
│   │   ├── bcrypt-hasher.service.ts        # Implements PasswordHasherPort
│   │   ├── jwt-token.service.ts            # Implements TokenProviderPort
│   │   └── auth-infra.module.ts
│   └── infrastructure.module.ts
│
├── presentation/
│   ├── controllers/
│   │   ├── webhook.controller.ts           # Parses Meta payload → normalized data → use case
│   │   ├── auth.controller.ts
│   │   ├── tenant.controller.ts
│   │   ├── phone-number.controller.ts
│   │   ├── agent.controller.ts
│   │   └── conversation.controller.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts               # Validates JWT, injects req.agent
│   │   ├── roles.guard.ts                  # @Roles('admin') enforcement
│   │   └── webhook-signature.guard.ts      # X-Hub-Signature-256 validation
│   ├── decorators/
│   │   ├── roles.decorator.ts
│   │   └── current-agent.decorator.ts      # Extract agent from req
│   ├── pipes/
│   │   └── zod-validation.pipe.ts
│   ├── request-dtos/                       # HTTP-specific input validation (Zod schemas)
│   │   ├── login-request.dto.ts
│   │   ├── refresh-token-request.dto.ts
│   │   ├── create-agent-request.dto.ts
│   │   ├── update-status-request.dto.ts
│   │   ├── grant-phone-access-request.dto.ts
│   │   ├── register-phone-number-request.dto.ts
│   │   ├── update-phone-number-request.dto.ts
│   │   ├── create-tenant-request.dto.ts
│   │   ├── send-message-request.dto.ts
│   │   ├── assign-conversation-request.dto.ts
│   │   └── conversation-query-params.dto.ts
│   └── presentation.module.ts
│
├── config/
│   ├── env.validation.ts
│   └── app.config.ts
│
└── app.module.ts
```

---

### Key Design Decisions

#### Assignment: Domain Rule vs Atomic Execution

The assignment logic is split across two layers:

- **Domain** (`assignment-rules.domain-service.ts`): Contains the pure selection rule — given a list of candidate agents, pick the one with the lowest `activeCount`. No I/O, fully testable.
- **Repository** (`AgentRepository.findAvailableByIdsAndIncrementLoad`): Encapsulates the atomic `findOneAndUpdate` + `$inc`. The use case doesn't know it's atomic — it just gets an agent or null.
- **Use case** (`auto-assign-conversation.use-case.ts`): Orchestrates the flow — get phone access list → call repo → update conversation → emit event.

```typescript
// domain/repositories/agent.repository.ts
interface AgentRepository {
  findAvailableByIdsAndIncrementLoad(agentIds: string[]): Promise<Agent | null>;
  // ... other methods
}
```

#### Cascading Reassignment

Two use cases trigger cascading reassignment of conversations:

- **`update-agent-status`**: When an agent goes offline, the use case fetches all their active conversations and calls `auto-assign-conversation` for each one. Conversations that can't be reassigned (no available agents) become `unassigned`.
- **`revoke-phone-access`**: When phone access is revoked, the use case fetches the agent's active conversations on that specific number and calls `auto-assign-conversation` for each.

Both reuse the same `auto-assign-conversation` use case — no duplicated logic.

#### DTOs: Presentation vs Application

Two separate DTO layers to avoid coupling:

- **`presentation/request-dtos/`**: HTTP-specific. Validated with Zod. Tied to request shape (e.g., Meta webhook format).
- **`application/dtos/`**: Framework-agnostic use case contracts. The controller translates from one to the other.

Example: `webhook.controller.ts` receives the raw Meta payload, parses it, and passes normalized data to `HandleInboundMessageUseCase` — the use case never sees Meta's JSON structure.

#### Ports and Injection

All outbound dependencies are defined as interfaces (ports) in the application layer and implemented in infrastructure. Nest.js DI wires them:

```typescript
// In infrastructure.module.ts or each sub-module
{
  provide: 'MessagingApiPort',
  useClass: MessagingApiStrategyService,
  // Routes to MetaCloudApiService, TwilioWhatsAppService, or Dialog360Service
  // based on params.provider
},
{
  provide: 'RealtimeGatewayPort',
  useClass: SocketIoGatewayService,
},
{
  provide: 'PasswordHasherPort',
  useClass: BcryptHasherService,
},
{
  provide: 'TokenProviderPort',
  useClass: JwtTokenService,
},
```

Use cases inject these via `@Inject('MessagingApiPort')`.

#### WebSocket Rooms

The `RealtimeGatewayPort` interface abstracts the room/event model:

```typescript
interface RealtimeGatewayPort {
  emitToAgent(agentId: string, event: string, payload: any): void;
  emitToTenant(tenantId: string, event: string, payload: any): void;
  emitToConversation(conversationId: string, event: string, payload: any): void;
}
```

The Socket.io implementation maps these to rooms (`agent:{id}`, `tenant:{id}`, `conv:{id}`).
