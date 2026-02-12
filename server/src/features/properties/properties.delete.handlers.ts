import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@db";
import type { PropertyIdParams } from "./properties";

async function deletePropertyHandler(
    req: FastifyRequest<{ Params: PropertyIdParams }>,
    reply: FastifyReply,
) {
    const user = req.user;
    if (!user) return reply.code(401).send({ error: "Unauthorized" });

    const { propertyId } = req.params;

    const property = await prisma.property.findUnique({
        where: { id: propertyId },
        select: { id: true },
    });
    if (!property) return reply.code(404).send({ error: "Property not found." });

    // Delete sections first (cascade isn't automatic with Prisma unless set in schema)
    await prisma.propertySection.deleteMany({ where: { propertyId } });
    await prisma.property.delete({ where: { id: propertyId } });

    return reply.code(204).send();
}

export { deletePropertyHandler };
