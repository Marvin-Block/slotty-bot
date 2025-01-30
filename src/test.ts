import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const usersWithPosts = await prisma.user.findMany({
    include: {
      keys: true,
    },
  })
  const keys = await prisma.key.findMany({});

  keys.forEach(key => {;
    const timeString = key.createdAt.getTime().toString().slice(0, 10);

    console.log(`<t:${timeString}:R>`);
  });

  // console.dir(usersWithPosts, { depth: null })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })

  1738258730|315