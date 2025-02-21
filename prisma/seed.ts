import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const delay = await prisma.settings.upsert({
    where: { name: "delay" },
    update: {},
    create: {
      name: "delay",
      value: "500",
    },
  });
  const vdfIterations = await prisma.settings.upsert({
    where: { name: "vdfIterations" },
    update: {},
    create: {
      name: "vdfIterations",
      value: "5000",
    },
  });
  const cooldown = await prisma.settings.upsert({
    where: { name: "cooldown" },
    update: {},
    create: {
      name: "cooldown",
      value: "1000",
    },
  });

  const cooldownEnabled = await prisma.settings.upsert({
    where: { name: "cooldownEnabled" },
    update: {},
    create: {
      name: "cooldownEnabled",
      value: "false",
    },
  });

  console.log({ delay, vdfIterations, cooldown, cooldownEnabled });
}
main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
