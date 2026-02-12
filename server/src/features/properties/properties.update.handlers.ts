import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@db";
import type { PropertyIdParams, UpdatePropertyBody } from "./properties";

async function updatePropertyHandler(
    req: FastifyRequest<{ Params: PropertyIdParams; Body: UpdatePropertyBody }>,
    reply: FastifyReply
) {
    const { propertyId } = req.params;
    const {
        name,
        managementType,
        addressStreet,
        addressPostalCode,
        addressCity,
        managerId,
        accountantId,
        status,
    } = req.body;

    const data: UpdatePropertyBody = {
        name,
        managementType,
        addressStreet,
        addressPostalCode,
        addressCity,
        managerId,
        accountantId,
        status,
    };

    const hasUpdates = Object.values(data)
        .some((value) => value !== undefined);

    if (!hasUpdates) return reply.code(400)
        .send({ error: "No fields to update" });

    const existing = await prisma.property.findUnique({
        where: { id: propertyId },
        select: { id: true },
    });

    if (!existing) return reply.code(404)
        .send({ error: "Property not found" });

    const property = await prisma.property.update({
        where: { id: propertyId },
        data,
        select: {
            id: true,
            propertyNumber: true,
            name: true,
            managementType: true,
            status: true,
            managerId: true,
            accountantId: true,
            addressStreet: true,
            addressPostalCode: true,
            addressCity: true,
        },
    });

    return reply.send({ property });
}

export { updatePropertyHandler };
