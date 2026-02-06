import { type FastifyInstance } from "fastify";

import { PrismaClient } from "@prisma/client";
import fp from "fastify-plugin";

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
}
