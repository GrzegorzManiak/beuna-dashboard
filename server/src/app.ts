import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";

import { DbPlugin } from "@plugin/db";
import { EnvPlugin } from "@plugin/env";
import { SwaggerPlugin } from "@plugin/swagger";
import { AuthPlugin } from "@plugin/auth";
import { MultipartPlugin } from "@plugin/multipart";

import { healthRoutes } from "@feature/health/health.routes";
import { sessionsRoutes } from "@feature/session/session.routes";
import { usersRoutes } from "@feature/users/users.routes";
import { propertiesRoutes } from "@feature/properties/properties.routes";
import { helpRoutes } from "@feature/help/help.routes";

function registerRoutes(app: FastifyInstance): void {
    void app.register(healthRoutes, { prefix: "/health" });
    void app.register(usersRoutes, { prefix: "/users" });
    void app.register(sessionsRoutes, { prefix: "/sessions" });
    void app.register(propertiesRoutes, { prefix: "/properties" });
    void app.register(helpRoutes, { prefix: "/help" });
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
    await app.register(MultipartPlugin);

    registerRoutes(app);

    await app.ready();
    return app;
}

export {
    buildApp,
}
