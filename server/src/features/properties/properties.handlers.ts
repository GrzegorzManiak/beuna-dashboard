import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@db";
import type {
    CreatePropertyBody,
    UpdatePropertyBody,
    PropertyIdParams,
} from "./properties";

async function listPropertiesHandler(
    req: FastifyRequest,
    reply: FastifyReply
) {
    const user = req.user!;

    const properties = await prisma.property.findMany({
        where: {
            OR: [
                { managerId: user.id },
                { accountantId: user.id },
            ],
        },
        select: {
            id: true,
            propertyNumber: true,
            name: true,
            managementType: true,
            status: true,
            managerId: true,
            accountantId: true,
        },
        orderBy: { propertyNumber: "asc" },
    });

    const result = properties.map((p) => ({
        id: p.id,
        propertyNumber: p.propertyNumber,
        name: p.name,
        managementType: p.managementType,
        status: p.status,
        relation: p.managerId === user.id ? "MANAGER" : "ACCOUNTANT",
    }));

    return reply.send({ properties: result });
}

async function createPropertyHandler(
    req: FastifyRequest<{ Body: CreatePropertyBody }>,
    reply: FastifyReply
) {
    const { name, managementType, managerId, accountantId } = req.body;

    const property = await prisma.$transaction(async (tx) => {
        const counter = await tx.propertyCounter.upsert({
            where: { id: 1 },
            update: { current: { increment: 1 } },
            create: { id: 1, current: 1 },
            select: { current: true },
        });

        return tx.property.create({
            data: {
                propertyNumber: counter.current,
                name,
                managementType,
                status: "DRAFT",
                managerId,
                accountantId,
            },
            select: {
                id: true,
                propertyNumber: true,
                name: true,
                managementType: true,
                status: true,
                managerId: true,
                accountantId: true,
            },
        });
    });

    return reply.code(201).send({ property });
}

async function getPropertyHandler(
    req: FastifyRequest<{ Params: PropertyIdParams }>,
    reply: FastifyReply
) {
    const { propertyId } = req.params;

    const property = await prisma.property.findUnique({
        where: { id: propertyId },
        select: {
            id: true,
            propertyNumber: true,
            name: true,
            managementType: true,
            status: true,
            managerId: true,
            accountantId: true,
        },
    });

    if (!property) return reply.code(404)
        .send({ error: "Property not found" });

    return reply.send({ property });
}

async function updatePropertyHandler(
    req: FastifyRequest<{ Params: PropertyIdParams; Body: UpdatePropertyBody }>,
    reply: FastifyReply
) {
    const { propertyId } = req.params;
    const { name, managementType, managerId, accountantId, status } = req.body;

    const data: UpdatePropertyBody = {
        name,
        managementType,
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
        },
    });

    return reply.send({ property });
}

export {
    listPropertiesHandler,
    createPropertyHandler,
    getPropertyHandler,
    updatePropertyHandler,
};
