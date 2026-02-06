import fp from "fastify-plugin";
import fastifyEnv from "@fastify/env";

const DEFAULT_NODE_ENV = "development";
const DEFAULT_PORT = 3000;

const EnvPlugin = fp(async (app) => {
    const schema = {
        type: "object",
        required: ["PORT", "DATABASE_URL", "JWT_SECRET"],
        properties: {
            NODE_ENV: {
                type: "string",
                enum: ["development", "production"],
                default: DEFAULT_NODE_ENV,
            },
            PORT: {
                type: "number",
                default: DEFAULT_PORT,
            },
            DATABASE_URL: {
                type: "string",
            },
            JWT_SECRET: {
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