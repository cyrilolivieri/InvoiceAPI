#!/usr/bin/env node
/**
 * Seed script — creates a demo user + API key for local development.
 * Run with: node --loader ts-node/esm scripts/seed.ts
 * Or: npx tsx scripts/seed.ts
 */

import { db } from '../src/models/db.js';
import { users, apiKeys } from '../src/models/schema.js';
import { generateApiKey, hashApiKey, getKeyPrefix } from '../src/utils/crypto.js';

async function seed() {
  console.log('🌱 Seeding database...');

  // Check if demo user exists
  const existing = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.email, 'demo@invoiceapi.ch'),
  });

  if (existing) {
    console.log('Demo user already exists:', existing.id);
    return;
  }

  // Create demo user
  const [user] = await db
    .insert(users)
    .values({
      email: 'demo@invoiceapi.ch',
      name: 'Demo User',
      plan: 'pro',
    })
    .returning({ id: users.id });

  console.log('✅ User created:', user.id);

  // Create API key
  const rawKey = generateApiKey('sk_test');
  const [key] = await db
    .insert(apiKeys)
    .values({
      userId: user.id,
      keyHash: hashApiKey(rawKey),
      keyPrefix: getKeyPrefix(rawKey),
      name: 'Demo API Key',
      scope: 'full',
      isActive: true,
    })
    .returning({ id: apiKeys.id });

  console.log('✅ API Key created:', key.id);
  console.log('\n📋 Credentials for testing:');
  console.log('   Email:    demo@invoiceapi.ch');
  console.log('   Plan:     pro (1000 invoices/month)');
  console.log('   API Key:  ', rawKey);
  console.log('\n⚠️  Save this key — it cannot be recovered!');
}

seed()
  .then(() => {
    console.log('\n✅ Seed complete');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  });
