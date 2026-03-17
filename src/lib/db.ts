import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

function createPrismaClient() {
    // Production: connect to Turso via libSQL adapter
    if (process.env.TURSO_DATABASE_URL) {
        const libsql = createClient({
            url: process.env.TURSO_DATABASE_URL,
            authToken: process.env.TURSO_AUTH_TOKEN,
        });
        const adapter = new PrismaLibSql(libsql);
        return new PrismaClient({ adapter });
    }
    // Development: use local SQLite file as before
    return new PrismaClient();
}

declare const globalThis: {
    prismaGlobal: ReturnType<typeof createPrismaClient>;
} & typeof global;

const prisma = globalThis.prismaGlobal ?? createPrismaClient();

export default prisma;

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma;
