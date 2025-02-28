import { PrismaClient } from '@prisma/client';
import {
  CacheType,
  CommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';

const prisma = new PrismaClient();

interface BlacklistRecord {
  createdAt: Date;
  id: number;
  discordID: string;
  reason: string;
  active: number;
  updatedBy: string;
  updatedAt: Date;
}

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
  const optionsData = interaction.options.data;
  const entry = optionsData[0];
  const type = entry.name;
  const userid = entry.options?.find((x) => x.name === 'user')?.value as string;
  const reason = entry.options?.find((x) => x.name === 'reason')
    ?.value as string;

  switch (type) {
    case 'list':
      let users: BlacklistRecord[] | undefined = await listUsers();
      if (!users) {
        return interaction.reply({
          content: 'An error occured',
          flags: MessageFlags.Ephemeral,
        });
      }
      let response = 'Blacklisted Users:\n';
      users.forEach((user) => {
        response += `User: ${user.discordID} Reason: ${user.reason} - Active: ${user.active}\n`;
      });

      // TODO: Add a better way to display the user
      return await interaction.reply({
        content: response,
        flags: MessageFlags.Ephemeral,
      });
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

      // TODO: Add a better way to display the user
      return await interaction.reply({
        content: `User: ${user.discordID} Reason: ${user.reason} - Active: ${user.active}`,
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
      if (type === 'add') {
        result = await addUser(userid, reason, interaction);
      }
      if (type === 'remove') {
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
    const result: BlacklistRecord[] = await prisma.blacklist.findMany();
    console.log(`Listing ${result.length} blacklisted users`);
    await prisma.$disconnect();
    return result;
  } catch (e) {
    console.log(e);
    await prisma.$disconnect();
    return undefined;
  }
}
