import type { FastifyPluginAsync } from "fastify";
import { healthHandler, readinessHandler } from "@feature/health/health.handlers";

const healthRoutes: FastifyPluginAsync = async (app) => {
    app.get("/", {
        schema: {
            tags: ["health"],
            summary: "Provide basic health information about the server, just if the server is up and running, not checking dependencies.",
            response: {
                200: {
                    type: "object",
                    properties: {
                        status: { type: "string" },
                        uptime: { type: "number" },
                        timestamp: { type: "number" },
                    },
                    required: ["status", "uptime", "timestamp"],
                },
            },
        },
    }, healthHandler);

    app.get("/ready", {
        schema: {
            tags: ["health"],
            summary: "Readiness check, checking if the server is ready to handle requests, including dependencies like database connection.",
            response: {
                200: {
                    type: "object",
                    properties: { status: { type: "string" } },
                    required: ["status"],
                },
                503: {
                    type: "object",
                    properties: { status: { type: "string" } },
                    required: ["status"],
                },
            },
        },
    }, readinessHandler);
};

export {
    healthRoutes,
}