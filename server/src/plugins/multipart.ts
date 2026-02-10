import { type FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import multipart from "@fastify/multipart";

const MultipartPlugin = fp(async (app: FastifyInstance) => {
    await app.register(multipart);
});

export {
    MultipartPlugin,
};
