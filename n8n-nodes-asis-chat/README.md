# n8n-nodes-asis-chat

Run WhatsApp for a business from n8n through [asis.chat](https://asis.chat), over Meta's **official WhatsApp Cloud API**.

This is not a QR-code bridge. There is no `whatsapp-web.js`, no Baileys, no session to keep alive and no risk of losing the number: asis.chat holds a real WhatsApp Business account and this package talks to its public API.

## Why this instead of the WhatsApp node in n8n

| | WhatsApp Business Cloud node | This node |
|---|---|---|
| Numbers per Meta app | one active trigger per Facebook App | as many as your account has |
| 24-hour customer service window | you handle it | handled underneath, with template fallback |
| Interactive component limits | rejected by Meta at send time | validated before anything is sent |
| Shared inbox and human handover | not available | part of the platform |

If you serve several clients from one n8n instance, the single-webhook-per-app limit is the wall you hit first. asis.chat is multi-tenant by design.

## Install

In n8n: **Settings → Community nodes → Install** and enter `n8n-nodes-asis-chat`.

## Credentials

Create an API key under **Developers** in asis.chat. Keys carry separate permissions for reading messages, sending messages, reading automations and editing them — the key you paste here decides which operations work.

| Field | Value |
|---|---|
| API Key | the `ak_…` key |
| Base URL | `https://api.asis.chat/api` (only change it if you self-host) |

## Nodes

**asis.chat** — send a WhatsApp message (free text or an approved template), list and read conversations, reply in a conversation, search and create contacts, list approved templates. It is also exposed as an AI Agent tool, so an agent in n8n can use it directly.

**asis.chat Trigger** — starts a workflow when something happens in your WhatsApp. Copy the production URL, paste it as a webhook endpoint under Developers in asis.chat, and paste the `whsec_…` secret back into the node: deliveries are verified with HMAC-SHA256 before the workflow runs, and replays outside a five-minute window are rejected.

## The 24-hour window, in one paragraph

WhatsApp only lets a business send free-form text to someone who wrote in the last 24 hours. Outside that window, only an approved template goes through. Pick **Approved Template** in the *Send As* field and the message is delivered at any time; pick **Free Text** and it needs the window open.

## Licence

[MIT](LICENSE.md)
