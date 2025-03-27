import { PrismaClient } from '@prisma/client';
import { Guild, GuildMember } from 'discord.js';
import { logger } from './logger';

const prisma = new PrismaClient();

export async function addOnJoin(member: GuildMember) {
  try {
    await prisma.user.create({
      data: {
        discordID: member.id,
        wallet: {
          create: {
            balance: 0,
          },
        },
      },
    });
    await prisma.$disconnect();
  } catch (e) {
    logger.error(e, 'Error while creating user entry');
    await prisma.$disconnect();
  }
}

export async function checkUsers(guild: Guild) {
  try {
    const users = await prisma.user.findMany({ include: { wallet: true } });
    const guildMembers = await guild.members.fetch();
    guildMembers.forEach(async (member) => {
      const user = users.find((u) => u.discordID === member.id);
      if (!user) {
        await addOnJoin(member);
      }
      if (user && !user.wallet) {
        await prisma.wallet.create({
          data: {
            balance: 0,
            userID: user.id,
          },
        });
      }
    });
    await prisma.$disconnect();
  } catch (e) {
    logger.error(e, 'Error while checking users');
    await prisma.$disconnect();
  }
}
