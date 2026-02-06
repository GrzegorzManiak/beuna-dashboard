import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@db";
import type { CreateSessionBody, SessionIdParams } from "./session";

async function createSessionHandler(
    req: FastifyRequest<{ Body: CreateSessionBody }>,
    reply: FastifyReply
) {
    const { userId } = req.body;

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
    });

    if (!user)return reply.code(404)
        .send({ error: "User not found" });

    const session = await prisma.session.create({
        data: { userId: user.id },
        select: { id: true },
    });

    return reply.code(201)
        .send({ sessionId: session.id });
}

async function meSessionHandler(
    req: FastifyRequest,
    reply: FastifyReply
) {
    const header = req.headers["x-session-id"];
    const sessionId = Array.isArray(header) ? header[0] : header;

    if (!sessionId)return reply.code(401)
        .send({ error: "Missing x-session-id" });

    const session = await prisma.session.findUnique({
        where: { id: sessionId },
        select: {
            id: true,
            createdAt: true,
            lastSeen: true,
            user: {
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                },
            },
        },
    });

    if (!session) {
        return reply.code(401).send({ error: "Invalid session" });
    }

    // Update lastSeen, but don’t fail the request if it errors
    prisma.session.update({
        where: { id: session.id },
        data: { lastSeen: new Date() },
    }).catch(() => {});

    return reply.send({
        sessionId: session.id,
        user: session.user,
        createdAt: session.createdAt,
        lastSeen: session.lastSeen,
    });
}

async function deleteSessionHandler(
    req: FastifyRequest<{ Params: SessionIdParams }>,
    reply: FastifyReply
) {
    const { sessionId } = req.params;

    // If it doesn't exist, still return 204 (idempotent delete)
    await prisma.session.delete({
        where: { id: sessionId },
    }).catch(() => null);

    return reply.code(204).send();
}

async function getSessionByIdHandler(
    req: FastifyRequest<{ Params: SessionIdParams }>,
    reply: FastifyReply
) {
    const { sessionId } = req.params;

    const session = await prisma.session.findUnique({
        where: { id: sessionId },
        select: {
            id: true,
            createdAt: true,
            lastSeen: true,
            user: {
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                },
            },
        },
    });

    if (!session) return reply.code(404)
        .send({ error: "Session not found" });

    return reply.send({
        sessionId: session.id,
        user: session.user,
        createdAt: session.createdAt,
        lastSeen: session.lastSeen,
    });
}

export {
    createSessionHandler,
    meSessionHandler,
    deleteSessionHandler,
    getSessionByIdHandler,
};
