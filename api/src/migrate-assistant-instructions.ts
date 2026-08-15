import 'dotenv/config';
import { connect, connection, model } from 'mongoose';

import { TenantSchema } from './infrastructure/persistence/mongoose/schemas/tenant.schema.js';
import { assistantInstructionStarterFor } from './application/use-cases/ai/prompts/assistant-instruction-starters.js';
import type { BusinessVertical } from './domain/value-objects/business-profile.js';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/whatsapp-teams';

  await connect(uri);
  const Tenant = model('TenantModel', TenantSchema, 'tenants');

  const tenants = await Tenant.find({ businessProfile: { $ne: null } }).lean();

  let migrated = 0;
  let skipped = 0;

  for (const tenant of tenants) {
    const profile = (tenant as any).businessProfile as Record<string, unknown> | null;
    if (!profile) continue;

    const current = typeof profile.assistantInstructions === 'string' ? profile.assistantInstructions : '';
    if (current.trim()) {
      skipped += 1;
      continue;
    }

    const vertical = (profile.vertical as BusinessVertical) ?? 'generic';
    const starter = assistantInstructionStarterFor(vertical);

    console.log(`${dryRun ? '[dry-run] ' : ''}${tenant.name ?? tenant._id} (${vertical}) <- ${starter.length} caracteres`);

    if (!dryRun) {
      await Tenant.updateOne(
        { _id: tenant._id },
        { $set: { 'businessProfile.assistantInstructions': starter } },
      );
    }
    migrated += 1;
  }

  console.log(`\n${dryRun ? 'Se migrarían' : 'Migradas'}: ${migrated}. Ya tenían instrucciones propias: ${skipped}.`);
  await connection.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
