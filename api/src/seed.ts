/**
 * Seed script — creates the initial tenant, admin agent, and optionally a phone number.
 *
 * Usage:
 *   npx ts-node --esm src/seed.ts
 * Or via nest:
 *   npx nest start -- --entryFile seed
 */

import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { connect, connection, model, Schema, Types } from 'mongoose';
import appConfig from './config/app.config.js';

// ── Config ──────────────────────────────────────────────
// Edit these values before running the seed

const SEED = {
  tenant: {
    name: 'Guillermo',
    slug: 'demo-guillermo',
  },
  admin: {
    name: 'Guillermo',
    email: 'guillepastorini5@gmail.com',
    password: '123123',
  },
  // Set to null to skip phone number creation
  phoneNumber: {
    provider: 'twilio',
    providerConfig: {
      accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
      authToken: process.env.TWILIO_AUTH_TOKEN ?? '',
      fromNumber: '+14155238886', // Twilio sandbox number
    },
    wabaId: 'twilio',
    phoneNumberId: '+14155238886',
    displayPhone: '+14155238886',
    label: 'WhatsApp Sandbox',
    webhookSecret: 'twilio-webhook-secret',
  } as typeof SEED.phoneNumber | null,
};

// ── Schemas (inline, lightweight) ───────────────────────

const TenantSeedSchema = new Schema({
  name: String,
  slug: { type: String, unique: true },
  createdAt: { type: Date, default: Date.now },
});

const AgentSeedSchema = new Schema({
  tenantId: Types.ObjectId,
  name: String,
  email: { type: String, unique: true },
  passwordHash: String,
  role: { type: String, default: 'admin' },
  status: { type: String, default: 'available' },
  activeCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

const PhoneNumberSeedSchema = new Schema({
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

const AgentPhoneAccessSeedSchema = new Schema({
  agentId: Types.ObjectId,
  phoneNumberId: Types.ObjectId,
});

/** La URI trae usuario y contrasena: nunca va entera a los logs. */
function safeUri(uri: string): string {
  try {
    const url = new URL(uri);
    return `${url.protocol}//${url.hostname}${url.pathname}`;
  } catch {
    return '(uri invalida)';
  }
}

async function seed() {
  const mongoUri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/whatsapp-teams';

  console.log(`Connecting to ${safeUri(mongoUri)}...`);
  await connect(mongoUri);
  console.log('Connected.\n');

  const TenantModel = model('Tenant', TenantSeedSchema, 'tenants');
  const AgentModel = model('Agent', AgentSeedSchema, 'agents');
  const PhoneNumberModel = model('PhoneNumber', PhoneNumberSeedSchema, 'phone_numbers');
  const AccessModel = model('AgentPhoneAccess', AgentPhoneAccessSeedSchema, 'agent_phone_access');

  // 1. Tenant
  let tenant = await TenantModel.findOne({ slug: SEED.tenant.slug });
  if (tenant) {
    console.log(`✓ Tenant "${tenant.name}" already exists (${tenant._id})`);
  } else {
    tenant = await TenantModel.create(SEED.tenant);
    console.log(`+ Created tenant "${tenant.name}" (${tenant._id})`);
  }

  // 2. Admin agent
  let agent = await AgentModel.findOne({ email: SEED.admin.email });
  if (agent) {
    console.log(`✓ Agent "${agent.name}" already exists (${agent._id})`);
  } else {
    const passwordHash = await bcrypt.hash(SEED.admin.password, 10);
    agent = await AgentModel.create({
      tenantId: tenant._id,
      name: SEED.admin.name,
      email: SEED.admin.email,
      passwordHash,
      role: 'admin',
    });
    console.log(`+ Created admin agent "${agent.name}" (${agent._id})`);
    console.log(`  Email: ${SEED.admin.email}`);
    console.log(`  Password: ${SEED.admin.password}`);
  }

  // 3. Phone number (optional)
  if (SEED.phoneNumber) {
    let phone = await PhoneNumberModel.findOne({ phoneNumberId: SEED.phoneNumber.phoneNumberId });
    if (phone) {
      console.log(`✓ Phone "${phone.label}" already exists (${phone._id})`);
    } else {
      phone = await PhoneNumberModel.create({
        tenantId: tenant._id,
        ...SEED.phoneNumber,
      });
      console.log(`+ Created phone number "${phone.label}" (${phone._id})`);
    }

    // 4. Grant phone access to admin
    const accessExists = await AccessModel.findOne({
      agentId: agent._id,
      phoneNumberId: phone._id,
    });
    if (accessExists) {
      console.log(`✓ Agent already has access to "${phone.label}"`);
    } else {
      await AccessModel.create({
        agentId: agent._id,
        phoneNumberId: phone._id,
      });
      console.log(`+ Granted phone access: ${agent.name} → ${phone.label}`);
    }
  }

  console.log('\n--- Seed complete ---');
  console.log(`\nYou can now login with:`);
  console.log(`  POST /auth/login`);
  console.log(`  { "email": "${SEED.admin.email}", "password": "${SEED.admin.password}" }`);

  await connection.close();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
