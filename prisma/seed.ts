import { PrismaClient } from '@prisma/client';
import { logger } from '../src/helper/logger';
const prisma = new PrismaClient();
async function main() {
  const delay = await prisma.settings.upsert({
    where: { name: 'delay' },
    update: {},
    create: {
      name: 'delay',
      value: '750',
    },
  });
  const vdfIterations = await prisma.settings.upsert({
    where: { name: 'vdfIterations' },
    update: {},
    create: {
      name: 'vdfIterations',
      value: '5000',
    },
  });
  const cooldown = await prisma.settings.upsert({
    where: { name: 'cooldown' },
    update: {},
    create: {
      name: 'cooldown',
      value: '1000',
    },
  });

  const cooldownEnabled = await prisma.settings.upsert({
    where: { name: 'cooldownEnabled' },
    update: {},
    create: {
      name: 'cooldownEnabled',
      value: 'false',
    },
  });

  logger.info({ delay, vdfIterations, cooldown, cooldownEnabled });
}
main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    logger.error(e, 'Error while seeding database');
    await prisma.$disconnect();
    process.exit(1);
  });
