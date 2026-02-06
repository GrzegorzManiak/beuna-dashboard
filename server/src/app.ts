import Fastify, { type FastifyInstance } from "fastify";

import { EnvPlugin } from "./plugins/env";
import { healthRoutes } from "./features/health/health.routes";

function registerRoutes(app: FastifyInstance): void {
    void app.register(healthRoutes, { prefix: "/health" });
}

async function buildApp(): Promise<FastifyInstance> {
    const app = Fastify({ logger: true });
    await app.register(EnvPlugin);

    registerRoutes(app);

    await app.ready();
    return app;
}

export {
    buildApp,
}