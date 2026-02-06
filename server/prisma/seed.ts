import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("Seeding...");

    await prisma.session.deleteMany();
    await prisma.property.deleteMany();
    await prisma.propertyCounter.deleteMany();
    await prisma.user.deleteMany();

    const createdUsers = await prisma.user.createMany({
        data: [
            { email: "admin@buena.local", name: "Admin User", role: UserRole.ADMIN },
            { email: "manager1@buena.local", name: "Anna Manager", role: UserRole.MANAGER },
            { email: "manager2@buena.local", name: "Mark Manager", role: UserRole.MANAGER },
            { email: "accountant1@buena.local", name: "Clara Accountant", role: UserRole.ACCOUNTANT },
            { email: "accountant2@buena.local", name: "Tom Accountant", role: UserRole.ACCOUNTANT },
        ],
    });
    console.log(`Users: ${createdUsers.count}`);

    const manager1 = await prisma.user.findUnique({
        where: { email: "manager1@buena.local" },
        select: { id: true },
    });
    if (!manager1) throw new Error("Manager 1 not found after seeding");

    const accountant1 = await prisma.user.findUnique({
        where: { email: "accountant1@buena.local" },
        select: { id: true },
    });
    if (!accountant1) throw new Error("Accountant 1 not found after seeding");

    const accountant2 = await prisma.user.findUnique({
        where: { email: "accountant2@buena.local" },
        select: { id: true },
    });
    if (!accountant2) throw new Error("Accountant 2 not found after seeding");

    const createdProperties = await prisma.property.createMany({
        data: [
            {
                propertyNumber: 1,
                name: "Riverside Heights",
                managementType: "WEG",
                status: "DRAFT",
                managerId: manager1.id,
                accountantId: accountant1.id,
            },
            {
                propertyNumber: 2,
                name: "Parkview Lofts",
                managementType: "MV",
                status: "DRAFT",
                managerId: manager1.id,
                accountantId: accountant2.id,
            },
            {
                propertyNumber: 3,
                name: "Linden Court",
                managementType: "WEG",
                status: "ACTIVE",
                managerId: manager1.id,
                accountantId: accountant1.id,
            },
            {
                propertyNumber: 4,
                name: "Maple Row",
                managementType: "MV",
                status: "ACTIVE",
                managerId: manager1.id,
                accountantId: accountant2.id,
            },
            {
                propertyNumber: 5,
                name: "Harbor Point",
                managementType: "WEG",
                status: "DRAFT",
                managerId: manager1.id,
                accountantId: accountant1.id,
            },
        ],
    });
    console.log(`Properties: ${createdProperties.count}`);

    await prisma.propertyCounter.upsert({
        where: { id: 1 },
        update: { current: 5 },
        create: { id: 1, current: 5 },
    });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
