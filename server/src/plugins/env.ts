import { type FastifyInstance } from "fastify";

import fp from "fastify-plugin";
import fastifyEnv from "@fastify/env";

const DEFAULT_NODE_ENV = "development";
const DEFAULT_PORT = 3000;

const EnvPlugin = fp(async (app: FastifyInstance) => {
    const schema = {
        type: "object",
        required: ["PORT", "DATABASE_URL", "OPENROUTER_API_KEY", "OPENROUTER_MODEL"],
        properties: {
            NODE_ENV: {
                type: "string",
                enum: ["development", "production", "test"],
                default: DEFAULT_NODE_ENV,
            },
            PORT: {
                type: "number",
                default: DEFAULT_PORT,
            },
            DATABASE_URL: {
                type: "string",
            },
            OPENROUTER_API_KEY: {
                type: "string",
            },
            OPENROUTER_BASE_URL: {
                type: "string",
            },
            OPENROUTER_MODEL: {
                type: "string",
            },
        },
    };

    await app.register(fastifyEnv, {
        schema,
        dotenv: true
    });
});

export {
    EnvPlugin,
}
