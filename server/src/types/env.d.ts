import "fastify";

declare module "fastify" {
    interface FastifyInstance {
        config: {
            NODE_ENV: "development" | "production" | "test";
            PORT: number;
            DATABASE_URL: string;
            OPENROUTER_API_KEY: string;
            OPENROUTER_BASE_URL?: string;
            OPENROUTER_MODEL: string;
        };
    }
}
