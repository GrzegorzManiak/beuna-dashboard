import type { FastifyPluginAsync } from "fastify";
import {
    createSessionHandler,
    meSessionHandler,
    deleteSessionHandler,
    getSessionByIdHandler,
} from "@feature/session/session.handlers";

const sessionsRoutes: FastifyPluginAsync = async (app) => {
    app.post("/", {
        schema: {
            tags: ["sessions"],
            summary: "Create (switch) session for a selected user. Used by the user dropdown in the client.",
            body: {
                type: "object",
                properties: {
                    userId: { type: "string", format: "uuid" },
                },
                required: ["userId"],
                additionalProperties: false,
            },
            response: {
                201: {
                    type: "object",
                    properties: {
                        sessionId: { type: "string", format: "uuid" },
                    },
                    required: ["sessionId"],
                    additionalProperties: false,
                },
                404: {
                    type: "object",
                    properties: { error: { type: "string" } },
                    required: ["error"],
                    additionalProperties: false,
                },
            },
        },
    }, createSessionHandler);

    app.get("/me", {
        schema: {
            tags: ["sessions"],
            summary: "Get current session + user. Requires x-session-id header.",
            response: {
                200: {
                    type: "object",
                    properties: {
                        sessionId: { type: "string", format: "uuid" },
                        createdAt: { type: "string" },
                        lastSeen: { type: "string" },
                        user: {
                            type: "object",
                            properties: {
                                id: { type: "string", format: "uuid" },
                                email: { type: "string" },
                                name: { type: "string" },
                                role: { type: "string" },
                            },
                            required: ["id", "email", "name", "role"],
                            additionalProperties: false,
                        },
                    },
                    required: ["sessionId", "user", "createdAt", "lastSeen"],
                    additionalProperties: false,
                },
                401: {
                    type: "object",
                    properties: { error: { type: "string" } },
                    required: ["error"],
                    additionalProperties: false,
                },
            },
        },
    }, meSessionHandler);

    app.delete("/:sessionId", {
        schema: {
            tags: ["sessions", "dev"],
            summary: "Delete a session (dev utility).",
            params: {
                type: "object",
                properties: {
                    sessionId: { type: "string", format: "uuid" },
                },
                required: ["sessionId"],
                additionalProperties: false,
            },
            response: {
                204: { type: "null" },
            },
        },
    }, deleteSessionHandler);

    app.get("/:sessionId", {
        schema: {
            tags: ["sessions", "dev"],
            summary: "Get a session by ID (dev utility).",
            params: {   
                type: "object",
                properties: {
                    sessionId: { type: "string", format: "uuid" },
                },
                required: ["sessionId"],
                additionalProperties: false,
            },
            response: {
                200: {
                    type: "object",
                    properties: {
                        sessionId: { type: "string", format: "uuid" },
                        createdAt: { type: "string" },
                        lastSeen: { type: "string" },
                        user: {
                            type: "object",
                            properties: {
                                id: { type: "string", format: "uuid" },
                                email: { type: "string" },
                                name: { type: "string" },
                                role: { type: "string" },
                            },
                            required: ["id", "email", "name", "role"],
                            additionalProperties: false,
                        },
                    },
                    required: ["sessionId", "user", "createdAt", "lastSeen"],
                    additionalProperties: false,
                },
                404: {
                    type: "object",
                    properties: { error: { type: "string" } },
                    required: ["error"],
                    additionalProperties: false,
                },
            },
        },
    }, getSessionByIdHandler);
};

export {
    sessionsRoutes,
};
