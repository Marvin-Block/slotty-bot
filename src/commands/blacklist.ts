import { PrismaClient } from '@prisma/client';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  CacheType,
  CommandInteraction,
  ComponentType,
  EmbedBuilder,
  MessageActionRowComponentBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { BlacklistRecord, fixedOptions } from '../typeFixes';

const prisma = new PrismaClient();

export const type = 'slash';
export const name = 'blacklist';

export const data = new SlashCommandBuilder()
  .setName('blacklist')
  .setDescription('Blacklist a user from the server.')
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
  const options = interaction.options as fixedOptions;
  const subcommand = options.getSubcommand();

  const userid = options.getString('user');
  const reason = options.getString('reason');

  switch (subcommand) {
    case 'list':
      let users: BlacklistRecord[] | undefined = await listUsers();
      if (!users) {
        return interaction.reply({
          content: 'An error occured',
          flags: MessageFlags.Ephemeral,
        });
      }
      var responseArr = [];

      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        const isActiveUser = await interaction.guild?.members.fetch(
          user.updatedBy
        );
        const updatedBy = isActiveUser
          ? `<@${user.updatedBy}>`
          : user.updatedBy;
        var message = '';
        message += `- UserID: \`${user.discordID}\`\n`;
        message += `- Active: ${user.active ? 'Yes' : 'No'}\n`;
        message += `- Reason: ${user.reason}\n`;
        message += `-# Updated By: ${updatedBy}\n`;
        message += `-# Created At: ${formatDate(user.createdAt)}\n`;
        message += `-# Updated At: ${formatDate(user.updatedAt)}`;
        responseArr.push(message);
      }

      let chunks = [];
      for (let i = 0; i < responseArr.length; i++) {
        const chunkSize = 5;
        if (i % chunkSize === 0) {
          const embed = new EmbedBuilder()
            .setTitle('Blacklisted Users')
            .setColor('#601499')
            .setDescription(
              responseArr.slice(i, i + chunkSize).join('\n────────────────\n')
            );
          chunks.push(embed);
        }
      }

      let currentPage = 0;

      let prev = new ButtonBuilder()
        .setCustomId('prev')
        .setLabel('Previous page')
        .setDisabled(true)
        .setStyle(ButtonStyle.Primary);

      let next = new ButtonBuilder()
        .setCustomId('next')
        .setLabel('Next Page')
        .setDisabled(currentPage + 1 === chunks.length)
        .setStyle(ButtonStyle.Primary);

      let page = new ButtonBuilder()
        .setCustomId('page')
        .setLabel('1 / ' + chunks.length)
        .setDisabled(true)
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder().addComponents(
        prev,
        page,
        next
      ) as ActionRowBuilder<MessageActionRowComponentBuilder>;
      const response = await interaction.reply({
        embeds: [chunks[0]],
        flags: MessageFlags.Ephemeral,
        components: [row],
        withResponse: true,
      });

      const collector =
        response.resource?.message?.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 3_600_000,
        });
      if (collector) {
        collector.on('collect', async (i) => {
          if (i.customId === 'next') {
            if (currentPage + 1 < chunks.length) {
              currentPage++;
              prev.setDisabled(false);
              page.setLabel(`${currentPage + 1} / ${chunks.length}`);
              i.update({
                embeds: [chunks[currentPage]],
                components: [row],
                withResponse: true,
              });
            } else {
              next.setDisabled(true);
              i.update({
                components: [row],
              });
            }
          }
          if (i.customId === 'prev') {
            if (currentPage - 1 >= 0) {
              currentPage--;
              next.setDisabled(false);
              page.setLabel(`${currentPage + 1} / ${chunks.length}`);
              i.update({
                embeds: [chunks[currentPage]],
                components: [row],
                withResponse: true,
              });
            } else {
              prev.setDisabled(true);
              i.update({
                components: [row],
              });
            }
          }
        });
      }
      break;
    case 'show':
      if (!userid) {
        return interaction.reply({
          content: 'Invalid command usage',
          flags: MessageFlags.Ephemeral,
        });
      }
      let user: BlacklistRecord | undefined = await showUser(userid);

      if (!user) {
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
        return interaction.reply({
          content: 'An error occured',
          flags: MessageFlags.Ephemeral,
        });
      }

      if (result.active === 1) {
        await interaction.guild?.members.kick(userid).catch(console.error);
        console.log(`Kicked user ${userid}`);
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
    console.log(
      `Blacklisted user ${result.discordID} with reason ${result.reason}`
    );
    await prisma.$disconnect();
    return result;
  } catch (e) {
    console.log(e);
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
    console.log(
      `Removed blacklisted user ${result.discordID} with reason ${result.reason}`
    );
    await prisma.$disconnect();
    return result;
  } catch (e) {
    console.log(e);
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
    console.log(
      `Showing blacklisted user ${result?.discordID} with reason ${result?.reason}`
    );
    await prisma.$disconnect();
    return result ?? undefined;
  } catch (e) {
    console.log(e);
    await prisma.$disconnect();
    return undefined;
  }
}
async function listUsers() {
  try {
    const result: BlacklistRecord[] = await prisma.blacklist.findMany({
      orderBy: { createdAt: 'desc' },
    });
    console.log(`Listing ${result.length} blacklisted users`);
    await prisma.$disconnect();
    return result;
  } catch (e) {
    console.log(e);
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
