import Fastify, { type FastifyInstance } from "fastify";

import { EnvPlugin } from "./plugins/env";
import { SwaggerPlugin } from "./plugins/swagger";

import { healthRoutes } from "./features/health/health.routes";

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