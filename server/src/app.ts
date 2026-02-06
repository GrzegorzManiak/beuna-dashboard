import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";

import { DbPlugin } from "@plugin/db";
import { EnvPlugin } from "@plugin/env";
import { SwaggerPlugin } from "@plugin/swagger";
import { AuthPlugin } from "@plugin/auth";

import { healthRoutes } from "@feature/health/health.routes";
import { sessionsRoutes } from "@feature/session/session.routes";

function registerRoutes(app: FastifyInstance): void {
    void app.register(healthRoutes, { prefix: "/health" });
    void app.register(sessionsRoutes, { prefix: "/sessions" });
}

async function buildApp(): Promise<FastifyInstance> {
    const app = Fastify({ logger: true });

    await app.register(cors, {
        origin: true,
        credentials: true,
        allowedHeaders: ["Content-Type", "x-session-id"],
        exposedHeaders: ["x-session-id"],
    });

    await app.register(AuthPlugin, {
        allowDevFallback: true,
        devFallbackUserEmail: "admin@buena.local",
    });

    await app.register(EnvPlugin);
    await app.register(DbPlugin);
    await app.register(SwaggerPlugin);

    registerRoutes(app);

    await app.ready();
    return app;
}

export {
    buildApp,
}