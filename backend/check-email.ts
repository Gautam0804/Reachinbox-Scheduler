import "dotenv/config";
import { PrismaClient } from "./src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!
});

const prisma = new PrismaClient({ adapter });

const email = await prisma.scheduledEmail.findUnique({
  where: { idempotencyKey: "worker-test-PASTE-YOUR-KEY-HERE" }
});

console.log(email);

await prisma.$disconnect();
