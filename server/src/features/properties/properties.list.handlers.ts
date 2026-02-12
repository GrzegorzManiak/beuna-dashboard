import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@db";

async function listPropertiesHandler(
    req: FastifyRequest,
    reply: FastifyReply
) {
    const user = req.user;
    if (!user) return reply.code(401).send({ error: "Unauthorized" });

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
            addressStreet: true,
            addressCity: true,
            createdAt: true,
        },
        orderBy: { propertyNumber: "asc" },
    });

    const propertyIds = properties.map((property) => property.id);
    const sections = propertyIds.length > 0
        ? await prisma.propertySection.findMany({
            where: {
                propertyId: { in: propertyIds },
                sectionType: "core.building",
            },
            select: {
                propertyId: true,
                items: true,
            },
        })
        : [];

    const unitSections = propertyIds.length > 0
        ? await prisma.propertySection.findMany({
            where: {
                propertyId: { in: propertyIds },
                sectionType: "units.unit_block",
            },
            select: {
                propertyId: true,
                items: true,
            },
        })
        : [];

    const buildingCountByPropertyId = new Map<string, number>();
    for (const section of sections) {
        const countForSection = Array.isArray(section.items) && section.items.length > 0
            ? section.items.length
            : 1;
        const previous = buildingCountByPropertyId.get(section.propertyId) ?? 0;
        buildingCountByPropertyId.set(section.propertyId, previous + countForSection);
    }

    const unitCountByPropertyId = new Map<string, number>();
    for (const section of unitSections) {
        const countForSection = Array.isArray(section.items) && section.items.length > 0
            ? section.items.length
            : 1;
        const previous = unitCountByPropertyId.get(section.propertyId) ?? 0;
        unitCountByPropertyId.set(section.propertyId, previous + countForSection);
    }

    const result = properties.map((p) => ({
        id: p.id,
        propertyNumber: p.propertyNumber,
        name: p.name,
        managementType: p.managementType,
        status: p.status,
        relation: p.managerId === user.id ? "MANAGER" : "ACCOUNTANT",
        buildingCount: buildingCountByPropertyId.get(p.id) ?? 0,
        unitCount: unitCountByPropertyId.get(p.id) ?? 0,
        addressStreet: p.addressStreet ?? null,
        addressCity: p.addressCity ?? null,
        createdAt: p.createdAt.toISOString(),
    }));

    return reply.send({ properties: result });
}

export { listPropertiesHandler };
