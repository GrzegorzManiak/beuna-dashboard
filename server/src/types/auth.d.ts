import "fastify";

declare module "fastify" {
    interface FastifyContextConfig {
        authRequired?: boolean;
    }

    interface FastifyRequest {
        user?: {
            id: string;
            email: string;
            name: string;
            role: string;
        };
        sessionId?: string;
    }
}
