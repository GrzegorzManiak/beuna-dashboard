import Fastify, { type FastifyInstance } from "fastify";

import { EnvPlugin } from "@plugin/env";
import { SwaggerPlugin } from "@plugin/swagger";

import { healthRoutes } from "@feature/health/health.routes";

function registerRoutes(app: FastifyInstance): void {
    void app.register(healthRoutes, { prefix: "/health" });
}

async function buildApp(): Promise<FastifyInstance> {
    const app = Fastify({ logger: true });
    
    await app.register(EnvPlugin);
    await app.register(SwaggerPlugin);

    registerRoutes(app);

    await app.ready();
    return app;
}

export {
    buildApp,
}