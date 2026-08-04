# WhatsApp for Teams — UI Specification

> **Documento histórico — no es la referencia vigente.** Describe la app como se
> planeó originalmente (Next.js 15, bottom-nav de 3 tabs) y quedó atrás respecto
> del código. Para las reglas de UI vigentes ver [`DESIGN.md`](./DESIGN.md).

## Overview

Multi-Agent and Multi-Number dashboard for the WhatsApp multi-tenant messaging system. Mobile-first design — agents should be able to handle all conversations from their mobile phone without needing a computer.

### Stack

- **Next.js 15** (App Router)
- **shadcn/ui** + **Radix UI** (components)
- **Tailwind CSS** (styling, mobile-first)
- **Socket.io-client** (real-time updates)
- **Zustand** (lightweight state management)

### Design Principles

1. **Mobile-first** — Base layout is phone-sized. Desktop is the enhanced version, not the other way around.
2. **WhatsApp-familiar** — Users already know WhatsApp. The UI should feel natural: conversation list on the left, chat on the right (or full-screen on mobile).
3. **Minimal chrome** — Maximize space for messages. Hide admin features behind menus.
4. **Real-time** — New messages, assignments, status changes appear instantly via WebSocket.
5. **Touch-friendly** — Large tap targets (min 44px), swipe gestures for common actions, no hover-dependent interactions.

---

## Layout Architecture

### Mobile (< 768px)

Single-screen navigation. Only one view visible at a time, with transitions between them.

```
┌─────────────────────┐
│  Header (app name)  │
├─────────────────────┤
│                     │
│   Active View       │
│   (full screen)     │
│                     │
│                     │
│                     │
│                     │
├─────────────────────┤
│  Bottom Nav (3 tabs)│
└─────────────────────┘

Bottom Nav Tabs:
  [Conversations]  [Contacts]  [Settings]
```

- Tapping a conversation → full-screen chat view (header changes to contact name + back button)
- Back button returns to conversation list
- Settings tab shows agent status toggle + admin panel link

### Desktop (>= 768px)

Two-panel layout, similar to WhatsApp Web.

```
┌──────────────────────────────────────────────┐
│  Header                                       │
├──────────────┬───────────────────────────────┤
│              │                               │
│  Sidebar     │   Chat Panel                  │
│  (380px)     │   (flex-1)                    │
│              │                               │
│  - Search    │   - Contact header            │
│  - Filters   │   - Messages (scrollable)     │
│  - Conv list │   - Input bar                 │
│              │                               │
│              │                               │
└──────────────┴───────────────────────────────┘
```

---

## Screens & Components

### 1. Login Screen

**Route:** `/login`

Simple centered card. No layout chrome.

```
┌───────────────────┐
│                   │
│   Logo / Title    │
│                   │
│   [Email input]   │
│   [Password input]│
│   [Login button]  │
│                   │
│   Error message   │
│                   │
└───────────────────┘
```

- Calls `POST /auth/login`
- Stores JWT in memory (Zustand) + refresh token in httpOnly cookie or localStorage
- Redirects to `/` on success
- Shows inline error on invalid credentials

### 2. Conversation List

**Route:** `/` (default view)

**Mobile:** Full screen. **Desktop:** Left sidebar panel.

```
┌─────────────────────────┐
│ Search [___________] 🔍 │
│ Filter: [All ▾]         │
├─────────────────────────┤
│ ┌─────────────────────┐ │
│ │ 🟢 Juan Pérez       │ │
│ │ Hola, necesito...   │ │
│ │           hace 2min │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ 🔴 María García     │ │
│ │ Gracias por la...   │ │
│ │           hace 1h   │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ ⚪ Carlos López     │ │
│ │ ¿Cuándo estará...   │ │
│ │           hace 3h   │ │
│ └─────────────────────┘ │
└─────────────────────────┘

Status indicators:
  🟢 = active (assigned to you)
  🔴 = unassigned (needs attention)
  ⚪ = resolved
```

**Filters dropdown:**
- All conversations
- My active
- Unassigned
- Resolved

**Data:** `GET /conversations?status=...&page=1&limit=20`

**Real-time:** Socket events `conversation.new`, `conversation.assigned`, `conversation.resolved`, `conversation.updated` update the list live.

**Sorting:** By `lastMessageAt` DESC (most recent first).

### 3. Chat View

**Route:** `/conversations/[id]`

**Mobile:** Full screen with back button. **Desktop:** Right panel.

```
┌─────────────────────────────┐
│ ← Juan Pérez    📱 Ventas   │
│    +5491155551234            │
├─────────────────────────────┤
│                             │
│          10:30 AM           │
│   ┌──────────────────┐     │
│   │ Hola, necesito   │     │
│   │ información...   │     │
│   └──────────────────┘     │
│                             │
│        ┌──────────────────┐ │
│        │ Hola Juan! En   │ │
│        │ qué puedo...    │ │
│        └──────────────────┘ │
│                    ✓✓ 10:32 │
│                             │
├─────────────────────────────┤
│ [Message input___] [Send ➤]│
└─────────────────────────────┘

Message bubbles:
  Left (gray)  = inbound (from contact)
  Right (green) = outbound (from agent)

Status ticks:
  ✓  = sent
  ✓✓ = delivered
  ✓✓ (blue) = read
```

**Header info:**
- Contact name + phone number
- Phone number label (which business line)
- Resolve button (marks conversation as resolved)

**Messages:** `GET /conversations/:id/messages?page=1&limit=50`
- Scroll up to load older messages (pagination)
- New messages arrive via Socket event `message.new`
- Status updates via `message.status`

**Input bar:**
- Text input with send button
- `POST /conversations/:id/messages` with `{ body: "..." }`
- Disabled with message when 24h window is expired
- Send on Enter (desktop), Send button (mobile)

### 4. Agent Status Toggle

Available in the header (desktop) or Settings tab (mobile).

```
┌─────────────────────────┐
│ Status: [🟢 Available ▾]│
│                         │
│   🟢 Available          │
│   🟡 Busy               │
│   🔴 Offline            │
└─────────────────────────┘
```

- `PATCH /agents/:id/status`
- When going offline, backend auto-reassigns conversations
- Visual indicator in header shows current status

### 5. Admin Panel

**Route:** `/admin`

Only visible to agents with role `admin`. Accessed via Settings tab (mobile) or sidebar menu (desktop).

#### 5a. Agents Management

```
┌─────────────────────────────┐
│ Agents                [+Add]│
├─────────────────────────────┤
│ Guillermo (admin)     🟢    │
│ guillepastorini5@...        │
│ Active conversations: 3     │
├─────────────────────────────┤
│ Ana López (agent)     🟡    │
│ ana@demo.com                │
│ Active conversations: 5     │
└─────────────────────────────┘
```

- `GET /agents`
- Create agent: modal/sheet with form → `POST /agents`
- Shows status and active count per agent

#### 5b. Phone Numbers

```
┌────────────────────────────────┐
│ Phone Numbers           [+Add]│
├────────────────────────────────┤
│ 📱 WhatsApp Sandbox           │
│ +14155238886                   │
│ Provider: Twilio    Status: 🟢│
├────────────────────────────────┤
│ 📱 Ventas                      │
│ +5491122334455                 │
│ Provider: Meta      Status: 🟢│
└────────────────────────────────┘
```

- `GET /phone-numbers`
- Register new: modal with provider selection, credentials, etc.
- Shows provider and status

#### 5c. Phone Access (per agent)

```
┌────────────────────────────────┐
│ Phone Access: Guillermo       │
├────────────────────────────────┤
│ ✅ WhatsApp Sandbox            │
│ ✅ Ventas                      │
│ ☐  Soporte                    │
└────────────────────────────────┘
```

- `GET /agents/:id/phone-access`
- Toggle on: `POST /agents/:id/phone-access`
- Toggle off: `DELETE /agents/:id/phone-access/:phoneId`

---

## Real-Time (Socket.io)

### Connection

On login, connect to WebSocket with JWT:

```typescript
const socket = io('http://localhost:3000/ws', {
  auth: { token: accessToken }
});
```

### Events to Handle

| Event | Action |
|---|---|
| `conversation.new` | Add to conversation list, show notification |
| `conversation.assigned` | Update conversation in list |
| `conversation.resolved` | Move to resolved, remove from active list |
| `conversation.updated` | Refresh conversation data |
| `conversation.unassigned` | Show in unassigned list (admin) |
| `message.new` | Append to chat view if conversation is open, update preview in list |
| `message.status` | Update tick marks (sent → delivered → read) |

### Rooms

When opening a chat, join the conversation room:
```typescript
socket.emit('join:conversation', { conversationId });
// On leaving:
socket.emit('leave:conversation', { conversationId });
```

---

## State Management (Zustand)

### Stores

```
authStore
  - agent: { id, name, email, role, tenantId }
  - accessToken: string
  - login(), logout(), refresh()

conversationStore
  - conversations: Map<id, Conversation>
  - activeConversationId: string | null
  - filters: { status, page }
  - fetchConversations(), setActive(), updateConversation()

messageStore
  - messages: Map<conversationId, Message[]>
  - fetchMessages(), appendMessage(), updateStatus()

socketStore
  - connected: boolean
  - socket: Socket instance
  - connect(), disconnect()
```

---

## Folder Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout (auth check, socket init)
│   ├── page.tsx                # Redirect to /conversations or /login
│   ├── login/
│   │   └── page.tsx
│   ├── conversations/
│   │   ├── layout.tsx          # Two-panel layout (desktop) / single view (mobile)
│   │   ├── page.tsx            # Conversation list
│   │   └── [id]/
│   │       └── page.tsx        # Chat view
│   └── admin/
│       ├── layout.tsx
│       ├── agents/
│       │   └── page.tsx
│       ├── phone-numbers/
│       │   └── page.tsx
│       └── page.tsx            # Admin dashboard / overview
│
├── components/
│   ├── ui/                     # shadcn/ui components (auto-generated)
│   ├── layout/
│   │   ├── app-shell.tsx       # Main layout wrapper
│   │   ├── mobile-nav.tsx      # Bottom navigation (mobile)
│   │   └── sidebar.tsx         # Left panel (desktop)
│   ├── conversations/
│   │   ├── conversation-list.tsx
│   │   ├── conversation-item.tsx
│   │   ├── conversation-filters.tsx
│   │   └── conversation-search.tsx
│   ├── chat/
│   │   ├── chat-panel.tsx
│   │   ├── chat-header.tsx
│   │   ├── message-list.tsx
│   │   ├── message-bubble.tsx
│   │   ├── message-input.tsx
│   │   └── message-status.tsx
│   ├── agent/
│   │   ├── agent-status-toggle.tsx
│   │   └── agent-list.tsx
│   └── admin/
│       ├── create-agent-form.tsx
│       ├── phone-number-list.tsx
│       ├── register-phone-form.tsx
│       └── phone-access-toggle.tsx
│
├── lib/
│   ├── api.ts                  # Fetch wrapper with auth headers
│   ├── socket.ts               # Socket.io client setup
│   └── utils.ts                # Helpers (date formatting, etc.)
│
├── stores/
│   ├── auth.store.ts
│   ├── conversation.store.ts
│   ├── message.store.ts
│   └── socket.store.ts
│
└── types/
    └── index.ts                # Shared TypeScript types matching API entities
```

---

## API Integration Summary

| Screen | Endpoints Used |
|---|---|
| Login | `POST /auth/login`, `POST /auth/refresh` |
| Conversation List | `GET /conversations`, WebSocket events |
| Chat View | `GET /conversations/:id`, `GET /conversations/:id/messages`, `POST /conversations/:id/messages` |
| Resolve | `PATCH /conversations/:id/resolve` |
| Agent Status | `PATCH /agents/:id/status` |
| Admin: Agents | `GET /agents`, `POST /agents` |
| Admin: Phones | `GET /phone-numbers`, `POST /phone-numbers`, `PATCH /phone-numbers/:id` |
| Admin: Access | `GET /agents/:id/phone-access`, `POST /agents/:id/phone-access`, `DELETE /agents/:id/phone-access/:phoneId` |

---

## Notifications

- **Browser notifications** for new messages when the tab is not focused (via Notification API)
- **Sound** — subtle notification sound for new inbound messages
- **Badge count** — unread/unassigned count in the bottom nav tab and browser tab title

---

## Color Palette (Draft)

Following WhatsApp's familiar scheme adapted for a professional tool:

| Element | Color |
|---|---|
| Primary (actions, links) | `#25D366` (WhatsApp green) |
| Inbound message bubble | `#F0F0F0` (light gray) |
| Outbound message bubble | `#DCF8C6` (light green) |
| Background | `#FFFFFF` (white) |
| Sidebar/header background | `#F8F9FA` (off-white) |
| Text primary | `#111B21` |
| Text secondary | `#667781` |
| Unassigned badge | `#FF3B30` (red) |
| Agent available | `#25D366` |
| Agent busy | `#FFB800` |
| Agent offline | `#8696A0` |

---

## Implementation Order

Phase 1 — Core (MVP for demo):
1. Project setup (Next.js + shadcn/ui + Tailwind)
2. Login screen + auth store
3. App shell layout (mobile nav + desktop sidebar)
4. Conversation list with real data
5. Chat view with message sending
6. Socket.io integration (live messages)
7. Agent status toggle

Phase 2 — Admin:
8. Admin panel layout
9. Agents management (list + create)
10. Phone numbers management
11. Phone access toggles

Phase 3 — Polish:
12. Notifications (browser + sound)
13. Search & filters
14. Resolve conversation flow
15. Manual assignment (admin)
16. Responsive polish & animations
