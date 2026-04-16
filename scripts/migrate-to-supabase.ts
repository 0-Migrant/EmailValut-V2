import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new pg.Pool({ 
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ['error', 'warn'],
});

const DATA_PATH = path.join(process.cwd(), 'data.json');

async function main() {
  console.log('🚀 Starting migration of data.json to Supabase...');

  if (!fs.existsSync(DATA_PATH)) {
    console.log('❌ data.json not found. Nothing to migrate.');
    return;
  }

  try {
    const rawData = fs.readFileSync(DATA_PATH, 'utf-8');
    const jsonData = JSON.parse(rawData);

    // Initial check to see if database is reachable
    await prisma.$connect();
    console.log('✅ Connected to Supabase.');

    await prisma.vault.upsert({
      where: { id: 1 },
      update: { data: jsonData },
      create: { id: 1, data: jsonData },
    });

    console.log('✅ Success! Your local data has been uploaded to Supabase.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
