import "fastify";

declare module "fastify" {
  interface FastifyInstance {
    config: {
      NODE_ENV: "development" | "production";
      PORT: number;
      DATABASE_URL: string;
      JWT_SECRET: string;
    };
  }
}