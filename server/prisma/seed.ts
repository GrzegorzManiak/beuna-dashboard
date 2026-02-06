import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("Seeding...");

    await prisma.session.deleteMany();
    await prisma.property.deleteMany();
    await prisma.user.deleteMany();

    const created = await prisma.user.createMany({
        data: [
            { email: "admin@buena.local", name: "Admin User", role: UserRole.ADMIN },
            { email: "manager1@buena.local", name: "Anna Manager", role: UserRole.MANAGER },
            { email: "manager2@buena.local", name: "Mark Manager", role: UserRole.MANAGER },
            { email: "accountant1@buena.local", name: "Clara Accountant", role: UserRole.ACCOUNTANT },
            { email: "accountant2@buena.local", name: "Tom Accountant", role: UserRole.ACCOUNTANT },
        ],
    });

    console.log(`Users: ${created.count}`);

    // Simple quick test
    const admin = await prisma.user.findUnique({ where: { email: "admin@buena.local" } });
    if (!admin) throw new Error("Admin not found after seeding");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
