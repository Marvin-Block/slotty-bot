import { PrismaClient } from '@prisma/client';
import {
  channelMention,
  Collection,
  CommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
  time,
  TimestampStyles,
} from 'discord.js';
import { formatDate, paginate } from '../helper/pagination';
import { fixedOptions } from '../typeFixes';

const prisma = new PrismaClient();

export const type = 'slash';
export const name = 'reminder';
export const data = new SlashCommandBuilder()
  .setName(name)
  .setDescription('Set a reminder for yourself')
  .addSubcommandGroup((group) =>
    group
      .setName('add')
      .setDescription('Add a reminder')
      .addSubcommand((subcommand) =>
        subcommand
          .setName('message')
          .setDescription('Set a message reminder')
          .addStringOption((option) =>
            option
              .setName('message')
              .setDescription('The message to remind you of')
              .setRequired(true)
              .setMaxLength(1500)
          )
          .addStringOption((option) =>
            option
              .setName('denomination')
              .setDescription('The denomination of time')
              .setRequired(true)
              .addChoices(
                { name: 'Minutes', value: 'minutes' },
                { name: 'Hours', value: 'hours' }
              )
          )
          .addIntegerOption((option) =>
            option
              .setName('time')
              .setDescription('How much time until you are reminded.')
              .setRequired(true)
              .setMinValue(1)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('channel')
          .setDescription('Set a channel reminder')
          .addChannelOption((option) =>
            option
              .setName('channel')
              .setDescription('The message to remind you of')
              .setRequired(true)
          )
          .addStringOption((option) =>
            option
              .setName('denomination')
              .setDescription('The denomination of time')
              .setRequired(true)
              .addChoices(
                { name: 'Minutes', value: 'minutes' },
                { name: 'Hours', value: 'hours' }
              )
          )
          .addIntegerOption((option) =>
            option
              .setName('time')
              .setDescription('How much time until you are reminded.')
              .setRequired(true)
              .setMinValue(1)
          )
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('remove')
      .setDescription('Remove a reminder')
      .addIntegerOption((option) =>
        option
          .setName('id')
          .setDescription('The id of the reminder')
          .setRequired(true)
          .setMinValue(1)
      )
  )
  .addSubcommand((sub) =>
    sub.setName('list').setDescription('List all reminders')
  );

export async function execute(interaction: CommandInteraction) {
  const options = interaction.options as fixedOptions;
  const subcommandGroup = options.getSubcommandGroup();
  const subcommand = options.getSubcommand();
  if (subcommandGroup === 'add') {
    if (subcommand === 'message') {
      return addMessageReminder(interaction);
    } else if (subcommand === 'channel') {
      return addChannelReminder(interaction);
    }
  }
  if (subcommand === 'remove') {
    return removeReminder(interaction);
  }
  if (subcommand === 'list') {
    return listReminder(interaction);
  }
  return;
}

async function addMessageReminder(interaction: CommandInteraction) {
  const options = interaction.options as fixedOptions;
  const message = options.getString('message', true);
  const interactionTime = options.getInteger('time', true);
  const denomination = options.getString('denomination', true);
  const timeDate =
    denomination === 'minutes'
      ? new Date(Date.now() + interactionTime * 60 * 1000)
      : new Date(Date.now() + interactionTime * 60 * 60 * 1000);

  try {
    const reminder = await prisma.reminder.create({
      data: {
        user: {
          connect: {
            discordID: interaction.user.id,
          },
        },
        message: options.getString('message', true),
        type: 'message',
        time: timeDate,
      },
    });
    console.log(reminder);
    prisma.$disconnect();
    return interaction.reply({
      content: `You will be reminded of "${message}" ${time(
        timeDate,
        TimestampStyles.RelativeTime
      )}`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error(error);
    prisma.$disconnect();
    return interaction.reply({
      content: 'An error occurred.',
      flags: MessageFlags.Ephemeral,
    });
  }
}
async function addChannelReminder(interaction: CommandInteraction) {
  const options = interaction.options as fixedOptions;
  const channel = options.getChannel('channel', true);
  const interactionTime = options.getInteger('time', true);
  const denomination = options.getString('denomination', true);
  const timeDate =
    denomination === 'minutes'
      ? new Date(Date.now() + interactionTime * 60 * 1000)
      : new Date(Date.now() + interactionTime * 60 * 60 * 1000);

  try {
    const reminder = await prisma.reminder.create({
      data: {
        user: {
          connect: {
            discordID: interaction.user.id,
          },
        },
        channelID: channel.id,
        type: 'channel',
        time: timeDate,
      },
    });
    console.log(reminder);
    prisma.$disconnect();
    return interaction.reply({
      content: `You will be reminded in ${channel} ${time(
        timeDate,
        TimestampStyles.RelativeTime
      )}`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error(error);
    prisma.$disconnect();
    return interaction.reply({
      content: 'An error occurred.',
      flags: MessageFlags.Ephemeral,
    });
  }
}
async function removeReminder(interaction: CommandInteraction) {
  const options = interaction.options as fixedOptions;
  const reminderID = options.getInteger('id', true);

  try {
    const reminder = await prisma.reminder.findFirst({
      where: {
        id: reminderID,
        user: {
          discordID: interaction.user.id,
        },
      },
    });
    if (!reminder) {
      return interaction.reply({
        content: 'Reminder not found.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await prisma.reminder.delete({
      where: {
        id: reminder.id,
      },
    });
    prisma.$disconnect();
    const content =
      reminder.type === 'message'
        ? `Removed reminder "${reminder.message}"`
        : `Removed reminder in ${channelMention(reminder.channelID!)}`;
    return interaction.reply({
      content: content,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error(error);
    prisma.$disconnect();
    return interaction.reply({
      content: 'An error occurred.',
      flags: MessageFlags.Ephemeral,
    });
  }
}
async function listReminder(interaction: CommandInteraction) {
  try {
    const reminders = await prisma.reminder.findMany({
      where: {
        user: {
          discordID: interaction.user.id,
        },
      },
    });
    if (reminders.length === 0) {
      return interaction.reply({
        content: 'You have no reminders.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const headers: Collection<string, string> = new Collection();
    headers.set('id', '- ID');
    headers.set('type', '- Type');
    headers.set('message', '- Message');
    headers.set('channelID', '- ChannelID');
    headers.set('time', '- Time');
    headers.set('createdAt', '-# CreatedAt');

    var reminderList: Collection<string, any>[] = reminders.map((reminder) => {
      const fields: Collection<string, any> = new Collection();
      fields.set('id', reminder.id);
      fields.set('type', reminder.type);
      fields.set('message', reminder.message);
      fields.set(
        'channelID',
        reminder.channelID ? channelMention(reminder.channelID) : null
      );
      fields.set(
        'time',
        reminder.time ? time(reminder.time, TimestampStyles.RelativeTime) : null
      );
      fields.set('createdAt', formatDate(reminder.createdAt));
      return fields;
    });

    paginate({
      interaction,
      headers,
      values: reminderList,
      chunkSize: 5,
      title: 'Your Reminders',
    });

    prisma.$disconnect();
    return;
  } catch (error) {
    console.error(error);
    prisma.$disconnect();
    return interaction.reply({
      content: 'An error occurred.',
      flags: MessageFlags.Ephemeral,
    });
  }
}
