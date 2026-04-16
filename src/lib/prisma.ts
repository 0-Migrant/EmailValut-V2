import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import 'dotenv/config'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

const connectionString = `${process.env.DATABASE_URL}`

const pool = new pg.Pool({ 
  connectionString,
  ssl: {
    rejectUnauthorized: false // This allows Supabase's self-signed certificates
  }
})
const adapter = new PrismaPg(pool)

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log: ['query', 'info', 'warn', 'error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
