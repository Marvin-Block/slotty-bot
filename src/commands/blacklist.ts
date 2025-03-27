import { PrismaClient } from '@prisma/client';
import {
  CacheType,
  Collection,
  CommandInteraction,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
  userMention,
} from 'discord.js';
import { logger } from '../helper/logger';
import { paginate } from '../helper/pagination';
import { BlacklistRecord, FixedOptions } from '../typeFixes';

const prisma = new PrismaClient();

export const type = 'slash';
export const name = 'blacklist';
export const allowed_servers = [
  '1074973203249770538',
  '1300479915308613702',
  '900017491554734080',
];

export const data = new SlashCommandBuilder()
  .setName('blacklist')
  .setDescription('Blacklist a user from the server.')
  .setContexts(InteractionContextType.Guild)
  .setDefaultMemberPermissions(0)
  .addSubcommand((subcommand) =>
    subcommand
      .setName('add')
      .setDescription('Blacklist a user from the server.')
      .addStringOption((option) =>
        option
          .setName('user')
          .setDescription('The User to be blacklisted.')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('reason')
          .setDescription('The reason for blacklisting the user.')
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('remove')
      .setDescription('Remove a user from the blacklist.')
      .addStringOption((option) =>
        option
          .setName('user')
          .setDescription('The User to be removed from the blacklist.')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('reason')
          .setDescription(
            'The reason for removing the user from the blacklist.'
          )
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand.setName('list').setDescription('List all blacklisted users.')
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('show')
      .setDescription('Show a blacklisted user.')
      .addStringOption((option) =>
        option
          .setName('user')
          .setDescription('The User to show.')
          .setRequired(true)
      )
  );

export async function execute(interaction: CommandInteraction<CacheType>) {
  const options = interaction.options as FixedOptions;
  const subcommand = options.getSubcommand();

  const userid = options.getString('user');
  const reason = options.getString('reason');

  logger.info(
    `Executing command ${interaction.commandName} with subcommand ${subcommand}`
  );

  switch (subcommand) {
    case 'list':
      let users: BlacklistRecord[] | undefined = await listUsers();
      if (!users) {
        logger.error('Couldnt find any blacklisted users');
        return interaction.reply({
          content: 'An error occured',
          flags: MessageFlags.Ephemeral,
        });
      }

      const headers: Collection<string, string> = new Collection();
      headers.set('discordID', '- UserID');
      headers.set('active', '- Active');
      headers.set('reason', '- Reason');
      headers.set('updatedBy', '-# Updated By');
      headers.set('createdAt', '-# Created At');
      headers.set('updatedAt', '-# Updated At');

      const userList: Collection<string, any>[] = users.map((user) => {
        const fields: Collection<string, any> = new Collection();
        const isActiveUser = interaction.guild?.members.fetch(user.updatedBy);

        fields.set('discordID', '`' + user.discordID + '`');
        fields.set('active', user.active ? 'Yes' : 'No');
        fields.set('reason', user.reason);
        fields.set(
          'updatedBy',
          isActiveUser ? userMention(user.updatedBy) : user.updatedBy
        );
        fields.set('createdAt', formatDate(user.createdAt));
        fields.set('updatedAt', formatDate(user.updatedAt));
        return fields;
      });

      paginate({
        interaction,
        headers,
        values: userList,
        chunkSize: 5,
        title: 'Blacklisted Users',
      });

      break;
    case 'show':
      if (!userid) {
        logger.error('Interaction option userid not found');
        return interaction.reply({
          content: 'Invalid command usage',
          flags: MessageFlags.Ephemeral,
        });
      }
      let user: BlacklistRecord | undefined = await showUser(userid);

      if (!user) {
        logger.error('Couldnt find blacklisted user');
        return interaction.reply({
          content: 'An error occured',
          flags: MessageFlags.Ephemeral,
        });
      }
      const isActiveUser = await interaction.guild?.members.fetch(
        user.updatedBy
      );
      const updatedBy = isActiveUser ? `<@${user.updatedBy}>` : user.updatedBy;

      var message = '';
      message += `- UserID: \`${user.discordID}\`\n`;
      message += `- Active: ${user.active ? 'Yes' : 'No'}\n`;
      message += `- Reason: ${user.reason}\n`;
      message += `-# Updated By: ${updatedBy}\n`;
      message += `-# Created At: ${formatDate(user.createdAt)}\n`;
      message += `-# Updated At: ${formatDate(user.updatedAt)}`;

      const embed = new EmbedBuilder()
        .setTitle('Blacklisted User')
        .setColor('#601499')
        .setDescription(message);

      return await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      });
    case 'add':
    case 'remove':
      if (!userid || !reason) {
        logger.error('Interaction option userid or reason not found');
        return interaction.reply({
          content: 'Invalid command usage',
          flags: MessageFlags.Ephemeral,
        });
      }
      var result: BlacklistRecord | undefined;
      if (subcommand === 'add') {
        result = await addUser(userid, reason, interaction);
      }
      if (subcommand === 'remove') {
        result = await removeUser(userid, reason, interaction);
      }

      if (!result) {
        logger.error('Error while executing command');
        return interaction.reply({
          content: 'An error occured',
          flags: MessageFlags.Ephemeral,
        });
      }

      if (result.active === 1) {
        await interaction.guild?.members.kick(userid).catch(logger.error);
        logger.info(`Kicked user ${userid}`);
      }

      return interaction.reply({
        content: 'Command executed successfully',
        flags: MessageFlags.Ephemeral,
      });
    default:
      return;
  }
  return;
}

async function addUser(
  userid: string,
  reason: string,
  interaction: CommandInteraction<CacheType>
) {
  try {
    const result: BlacklistRecord = await prisma.blacklist.upsert({
      where: {
        discordID: userid,
      },
      update: {
        reason: reason,
        active: 1,
        updatedBy: interaction.user.id,
      },
      create: {
        discordID: userid,
        reason: reason,
        updatedBy: interaction.user.id,
        active: 1,
      },
    });
    logger.info(`Adding user ${userid} to blacklist with reason ${reason}`);
    await prisma.$disconnect();
    return result;
  } catch (e) {
    logger.error(e, 'Error while adding user to blacklist');
    await prisma.$disconnect();
    return undefined;
  }
}
async function removeUser(
  userid: string,
  reason: string,
  interaction: CommandInteraction<CacheType>
) {
  try {
    const result: BlacklistRecord = await prisma.blacklist.update({
      where: {
        discordID: userid,
      },
      data: {
        reason: reason,
        active: 0,
        updatedBy: interaction.user.id,
      },
    });
    logger.info(
      `Removed blacklisted user ${result.discordID} with reason ${result.reason}`
    );
    await prisma.$disconnect();
    return result;
  } catch (e) {
    logger.error(e, 'Error while removing user from blacklist');
    await prisma.$disconnect();
    return undefined;
  }
}
async function showUser(userid: string) {
  try {
    const result = await prisma.blacklist.findUnique({
      where: {
        discordID: userid,
      },
    });
    logger.info(
      `Showing blacklisted user ${result?.discordID} with reason ${result?.reason}`
    );
    await prisma.$disconnect();
    return result ?? undefined;
  } catch (e) {
    logger.error(e, 'Error while showing user');
    await prisma.$disconnect();
    return undefined;
  }
}
async function listUsers() {
  try {
    const result: BlacklistRecord[] = await prisma.blacklist.findMany({
      orderBy: { createdAt: 'desc' },
    });
    logger.info(`Listing ${result.length} blacklisted users`);
    await prisma.$disconnect();
    return result;
  } catch (e) {
    logger.error(e, 'Error while listing blacklisted users');
    await prisma.$disconnect();
    return undefined;
  }
}
function formatDate(date: Date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
