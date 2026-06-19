<div align="center">

# 💬 WhatsApp for Teams

### A self-hosted team inbox for WhatsApp — with an AI agent per workspace

[![NestJS](https://img.shields.io/badge/NestJS-E0234E?logo=nestjs&logoColor=white)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](#)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?logo=mongodb&logoColor=white)](#)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](#)
[![Terraform](https://img.shields.io/badge/Terraform-7B42BC?logo=terraform&logoColor=white)](#)
[![AWS](https://img.shields.io/badge/AWS-232F3E?logo=amazonaws&logoColor=white)](#)

*Think "self-hosted Intercom for WhatsApp": a shared inbox where human agents and AI agents handle customer conversations side by side.*

</div>

---

## ✨ Features

- 🏢 **Multi-tenant** — isolated workspaces, agents, phone numbers and conversations per tenant.
- 📥 **Shared team inbox** — assign chats to agents, track availability and active load.
- 🤖 **AI agent per tenant, defined as data** — an agent is a JSON config (persona + tools), not hardcoded logic.
- 🛠️ **Tool-calls that do real work** — the LLM's tool calls map to **directive handlers** that execute genuine use cases (create an order, update a contact, escalate).
- 🙋 **Human handoff, three ways** — triggered by the AI, by a domain service, or by configurable rules.
- 🔌 **Provider-agnostic** — clean hexagonal architecture so the messaging provider (Twilio / Meta Cloud API) is swappable.
- ☁️ **Infra included** — Terraform + Docker Compose + CI/CD, ready to deploy on AWS.

## 🛠️ Tech stack

| Layer | Technologies |
|-------|--------------|
| **Backend** | NestJS · MongoDB + Mongoose · WebSockets (Socket.IO) · JWT · Swagger · Throttler · AWS SES · Helmet |
| **Frontend** | React · TypeScript |
| **Infra** | Terraform · Docker Compose · GitHub Actions · AWS (SES, CloudWatch) |

## 🏗️ Architecture

Hexagonal / ports-and-adapters: domain use cases at the core, messaging providers and persistence as swappable adapters. AI agents plug in as configurable strategies whose tool calls resolve to domain directives.

## 🚀 Quick start

```bash
cd api
cp .env.example .env        # set MONGODB_URI, JWT secrets, provider + AWS keys
npm install
npm run start:dev           # API
npm run seed                # optional: seed a demo tenant

cd ../ui
npm install && npm start    # web client
```

See [`DEPLOY.md`](./DEPLOY.md) for the full cloud deployment guide.

## 📁 Project structure

```
whatsapp-for-teams/
├── api/        # NestJS backend (hexagonal) — inbox, agents, billing
├── ui/         # React team console
├── webhooks/   # inbound provider webhooks
└── infra/      # Terraform + Docker Compose
```

---

<div align="center">
<sub>Built by <a href="https://github.com/GuillermoPastoriniRivas">Guillermo Pastorini</a></sub>
</div>
