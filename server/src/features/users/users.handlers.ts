import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@db";
import type { UserIdParams, UsersQuery } from "./users";

async function listUsersHandler(
    req: FastifyRequest<{ Querystring: UsersQuery }>,
    reply: FastifyReply
) {
    const { role } = req.query;

    const users = await prisma.user.findMany({
        where: role ? { role } : undefined,
        orderBy: [{ role: "asc" }, { name: "asc" }],
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
            updatedAt: true,
        },
    });

    return reply.send({ users });
}

async function getUserHandler(
    req: FastifyRequest<{ Params: UserIdParams }>,
    reply: FastifyReply
) {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
            updatedAt: true,
        },
    });

    if (!user) return reply.code(404)
        .send({ error: "User not found" });

    return reply.send({ user });
}

export {
    listUsersHandler,
    getUserHandler,
};
