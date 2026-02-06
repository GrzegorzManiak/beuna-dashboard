import { type FastifyInstance } from "fastify";

import { PrismaClient } from "@prisma/client";
import fp from "fastify-plugin";

declare global {
    // eslint-disable-next-line no-var
    var __prisma: PrismaClient | undefined;
}

// Prevent creating many clients in dev hot reload
const prisma =
    globalThis.__prisma ??
    new PrismaClient({
        log: ["warn", "error"],
    });

if (process.env.NODE_ENV !== "production")
    globalThis.__prisma = prisma;

async function registerDb(app: FastifyInstance): Promise<void> {
    const prismaClient = new PrismaClient();

    app.decorate("db", prismaClient);

    app.addHook("onClose", async (instance) => {
        await instance.db.$disconnect();
    });
}

const DbPlugin = fp(registerDb);

export {
    DbPlugin,
    prisma,
}
