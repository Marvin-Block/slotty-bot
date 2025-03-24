import { PrismaClient } from '@prisma/client';
import {
  channelMention,
  Collection,
  CommandInteraction,
  Guild,
  MessageFlags,
  SlashCommandBuilder,
  TextChannel,
  time,
  TimestampStyles,
  userMention,
} from 'discord.js';
import { formatDate, paginate } from '../helper/pagination';
import { FixedOptions } from '../typeFixes';

const prisma = new PrismaClient();

export const type = 'slash';
export const name = 'reminder';
export const allowed_servers = [
  '1074973203249770538',
  '1300479915308613702',
  '900017491554734080',
];

export const data = new SlashCommandBuilder()
  .setName(name)
  .setDescription('Set a reminder for yourself')
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Adds a reminder')
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
      .addStringOption((option) =>
        option
          .setName('message')
          .setDescription('The message to remind you of')
          .setRequired(true)
          .setMaxLength(1500)
      )
      .addChannelOption((option) =>
        option
          .setName('channel')
          .setDescription('The channel to remind you in')
          .setRequired(false)
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
  const options = interaction.options as FixedOptions;
  const subcommand = options.getSubcommand();

  switch (subcommand) {
    case 'add':
      return addReminder(interaction);
    case 'remove':
      return removeReminder(interaction);
    case 'list':
      return listReminder(interaction);
    default:
      return;
  }
}

async function addReminder(interaction: CommandInteraction) {
  const options = interaction.options as FixedOptions;
  const message = options.getString('message', true);
  const channel = options.getChannel('channel');
  const interactionTime = options.getInteger('time', true);
  const denomination = options.getString('denomination', true);
  const timeDate =
    denomination === 'minutes'
      ? new Date(Date.now() + interactionTime * 60 * 1000)
      : new Date(Date.now() + interactionTime * 60 * 60 * 1000);

  try {
    await prisma.reminder.create({
      data: {
        user: {
          connect: {
            discordID: interaction.user.id,
          },
        },
        message: options.getString('message', true),
        time: timeDate,
        channelID: channel?.id ?? null,
      },
    });

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
async function removeReminder(interaction: CommandInteraction) {
  const options = interaction.options as FixedOptions;
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
    let content = 'Your reminder ';
    if (reminder.message) {
      content += `'${reminder.message}' `;
    }
    if (reminder.channelID) {
      content += `${channelMention(reminder.channelID)} `;
    }
    content += 'has been removed.';

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
    headers.set('message', '- Message');
    headers.set('channelID', '- ChannelID');
    headers.set('time', '- Time');
    headers.set('createdAt', '-# CreatedAt');

    var reminderList: Collection<string, any>[] = reminders.map((reminder) => {
      const fields: Collection<string, any> = new Collection();
      fields.set('id', reminder.id);
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
export async function handleReminder(guild: Guild) {
  try {
    const client = guild.client;
    const reminders = await prisma.reminder.findMany({
      where: {
        time: {
          lte: new Date(),
        },
      },
      include: {
        user: true,
      },
    });
    if (reminders.length === 0) {
      return;
    }
    for (const reminder of reminders) {
      const user = await client.users.fetch(reminder.user.discordID);
      let channel;
      if (reminder.channelID) {
        channel = (await client.channels.fetch(
          reminder.channelID!
        )) as TextChannel;
      }
      if (!user) {
        continue;
      }
      let message = `${userMention(reminder.user.discordID)}\n`;
      if (reminder.message) {
        message += `Reminder: ${reminder.message}\n`;
      }
      if (channel) {
        message += `In ${channelMention(channel.id)}\n`;
      }
      message += `from ${time(
        reminder.createdAt,
        TimestampStyles.RelativeTime
      )}\n-# set at ${formatDate(reminder.createdAt)}`;
      await user.send({
        content: message,
      });
      await prisma.reminder.delete({
        where: {
          id: reminder.id,
        },
      });
    }
    prisma.$disconnect();
  } catch (error) {
    console.error(error);
    prisma.$disconnect();
    return;
  } finally {
    const interval = 1000 * 30;
    const msToNextRoundedMin = interval - (Date.now() % interval);
    setTimeout(() => handleReminder(guild), msToNextRoundedMin);
  }
}
