import type { FastifyReply, FastifyRequest } from "fastify";

async function healthHandler(
    _req: FastifyRequest,
    reply: FastifyReply
) {
    return reply.send({
        status: "ok",
        uptime: process.uptime(),
        timestamp: Date.now(),
    });
}

async function readinessHandler(
    req: FastifyRequest,
    reply: FastifyReply
) {
    try {
        // TODO: DB Check

        return reply.send({ status: "ready" });
    } catch (err) {
        req.log.error(err);
        return reply.code(503).send({ status: "not_ready" });
    }
}

export {
    healthHandler,
    readinessHandler,
}