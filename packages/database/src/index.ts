import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

// Use a global to prevent multiple instances in dev hot-reload scenarios.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error(
      '[database] DATABASE_URL is not set. Make sure dotenv/config is loaded before this module.',
    )
  }
  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

export const db: PrismaClient =
  globalForPrisma.prisma ?? (globalForPrisma.prisma = createClient())

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

export * from '@prisma/client'
