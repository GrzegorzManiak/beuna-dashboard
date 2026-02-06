import type { FastifyPluginAsync } from "fastify";
import { listUsersHandler, getUserHandler } from "@feature/users/users.handlers";

const usersRoutes: FastifyPluginAsync = async (app) => {
    app.get("/", {
        schema: {
            tags: ["users"],
            summary: "List users (used for the user dropdown). Optionally filter by role.",
            querystring: {
                type: "object",
                properties: {
                    role: { type: "string", enum: ["ADMIN", "MANAGER", "ACCOUNTANT"] },
                },
                additionalProperties: false,
            },
            response: {
                200: {
                    type: "object",
                    properties: {
                        users: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    id: { type: "string", format: "uuid" },
                                    email: { type: "string" },
                                    name: { type: "string" },
                                    role: { type: "string", enum: ["ADMIN", "MANAGER", "ACCOUNTANT"] },
                                    createdAt: { type: "string" },
                                    updatedAt: { type: "string" },
                                },
                                required: ["id", "email", "name", "role", "createdAt", "updatedAt"],
                                additionalProperties: false,
                            },
                        },
                    },
                    required: ["users"],
                    additionalProperties: false,
                },
            },
        },
    }, listUsersHandler);

    app.get("/:userId", {
        schema: {
            tags: ["users"],
            summary: "Get a single user by id.",
            params: {
                type: "object",
                properties: {
                    userId: { type: "string", format: "uuid" },
                },
                required: ["userId"],
                additionalProperties: false,
            },
            response: {
                200: {
                    type: "object",
                    properties: {
                        user: {
                            type: "object",
                            properties: {
                                id: { type: "string", format: "uuid" },
                                email: { type: "string" },
                                name: { type: "string" },
                                role: { type: "string", enum: ["ADMIN", "MANAGER", "ACCOUNTANT"] },
                                createdAt: { type: "string" },
                                updatedAt: { type: "string" },
                            },
                            required: ["id", "email", "name", "role", "createdAt", "updatedAt"],
                            additionalProperties: false,
                        },
                    },
                    required: ["user"],
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
    }, getUserHandler);
};

export {
    usersRoutes,
};
