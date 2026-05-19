import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Client initialization only: this module never runs migrations or schema push commands.
const prismaClientSingleton = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prismaClientSingleton;
}

export const prisma = prismaClientSingleton;

export const disconnectPrisma = async (): Promise<void> => {
  await prisma.$disconnect();
};

const DB_HEALTHCHECK_QUERY = "SELECT 1";

// Health check must remain table-agnostic; never query business tables here.
export const checkDatabaseConnection = async (): Promise<void> => {
  await prisma.$queryRawUnsafe(DB_HEALTHCHECK_QUERY);
};
