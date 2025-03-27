import { PrismaClient } from '@prisma/client';
import { Guild, GuildMember } from 'discord.js';
import { logger } from './logger';

const prisma = new PrismaClient();
const FIVE_MIN = 1000 * 60 * 5;

export async function run(member: GuildMember) {
  try {
    const [blacklistRecord] = await prisma.blacklist.findMany({
      where: {
        discordID: member.id,
        active: 1,
      },
    });
    if (blacklistRecord) {
      await prisma.blacklist.update({
        where: {
          id: blacklistRecord.id,
        },
        data: {
          joinAttempts: blacklistRecord.joinAttempts + 1,
        },
      });
      logger.info(`Blacklisted user ${member.user.username} found. Kicking...`);
      await member.kick();
    } else {
      logger.info(`User ${member.user.username} not blacklisted.`);
    }
    await prisma.$disconnect();
  } catch (e) {
    logger.error(e, 'Error while checking user');
    await prisma.$disconnect();
  }
}

export async function checkUsers(guild: Guild) {
  try {
    const blacklistRecords = await prisma.blacklist.findMany({
      where: {
        active: 1,
      },
    });
    for (const blacklistRecord of blacklistRecords) {
      const guildMembers = await guild.members.fetch();
      if (guildMembers.has(blacklistRecord.discordID)) {
        continue;
      }
      const member = guildMembers.get(blacklistRecord.discordID);
      if (member) {
        logger.info(
          `Blacklisted user ${member.user.username} found. Kicking...`
        );
        await member.kick();
      }
    }
  } catch (e) {
    logger.error(e, 'Error while checking users');
    await prisma.$disconnect();
  }

  const msToNextRounded5Min = FIVE_MIN - (Date.now() % FIVE_MIN);
  setTimeout(() => checkUsers(guild), msToNextRounded5Min);
}
