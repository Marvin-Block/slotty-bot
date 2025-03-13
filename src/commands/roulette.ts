import { PrismaClient } from '@prisma/client';
import {
  AttachmentBuilder,
  Collection,
  CommandInteraction,
  EmbedBuilder,
  MessageReaction,
  ReadonlyCollection,
  SlashCommandBuilder,
  time,
  TimestampStyles,
  User,
  userMention,
} from 'discord.js';
import { SecureRandomGenerator } from '../secure_random_number';
import { fixedOptions } from '../typeFixes';

const prisma = new PrismaClient();
const secRand = new SecureRandomGenerator();

const gold = '<:slotted_gold:1349674918228394077>';
const goldId = '1349674918228394077';
const black = '<:slotted_black:1349674917007851580>';
const blackId = '1349674917007851580';
const red = '<:slotted_red:1349674915481260072>';
const redId = '1349674915481260072';
const participants = new Collection<string, string>();

export const type = 'slash';
export const name = 'roulette';
export const data = new SlashCommandBuilder()
  .setName(name)
  .setDescription('Roulette')
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
  const options = interaction.options as fixedOptions;
  const subcommand = options.getSubcommand();
  await interaction.deferReply();

  switch (subcommand) {
    case 'add':
      return roulette(interaction);
    case 'remove':
      return roulette(interaction);
    case 'list':
      return rouletteStart(interaction);
    default:
      return;
  }
}

async function roulette(interaction: CommandInteraction) {
  let rng1 = await secRand.generateSecureRandom(1, 100);
  let rng2 = 0;
  let type = 'none';
  let typeId = 'none';
  // Red - 45% chance
  if (rng1.number > 0 && rng1.number <= 45) {
    // select random variance from 1 to 24
    await secRand.generateSecureRandom(1, 24).then((rng) => {
      rng2 = rng.number;
      type = 'Red';
      typeId = redId;
    });
  }
  // Gold - 10% chance
  if (rng1.number > 45 && rng1.number <= 55) {
    // select random variance from 1 to 5
    await secRand.generateSecureRandom(1, 5).then((rng) => {
      rng2 = rng.number;
      type = 'Gold';
      typeId = goldId;
    });
  }
  // Black - 45% chance
  if (rng1.number > 55 && rng1.number <= 100) {
    // select random variance from 1 to 24
    await secRand.generateSecureRandom(1, 24).then((rng) => {
      rng2 = rng.number;
      type = 'Black';
      typeId = blackId;
    });
  }

  if (!rng2 || !type) {
    return interaction.editReply({
      content: 'Error generating roulette',
    });
  }

  console.log(`Roulette: ${interaction.user.username} - ${type} - ${rng2}`);

  const file = `./assets/roulette/Optimized-${type}-${rng2}.gif`;
  const attachment = new AttachmentBuilder(file);
  const embed = new EmbedBuilder()
    .setTitle('Roulette')
    .setColor('#601499')
    .setDescription('## Rolling...')
    .setImage(`attachment://Optimized-${type}-${rng2}.gif`);

  await interaction.editReply({
    embeds: [embed],
    files: [attachment],
  });

  // wait 18.63 seconds + loading buffer for gif to finish playing
  await new Promise((resolve) => setTimeout(resolve, 23_000));

  const winners = participants.filter((value) => value === typeId);
  const winnerList = winners
    .map((value, key) => `${userMention(key)}`)
    .join(', ');

  if (winners.size === 0) {
    const embed2 = new EmbedBuilder()
      .setTitle('Roulette')
      .setColor('#601499')
      .setDescription(`No winners this round.. Better luck next time!`);
    interaction.editReply({
      embeds: [embed2],
      files: [],
    });
    await prisma.$disconnect();
    return;
  }

  const embed2 = new EmbedBuilder()
    .setTitle('Roulette')
    .setColor('#601499')
    .setDescription(
      `# **${type}** won! Congratulations to: \n\n ${winnerList}`
    );
  interaction.editReply({
    embeds: [embed2],
    files: [],
  });
  await prisma.$disconnect();
}

async function rouletteStart(interaction: CommandInteraction) {
  const timer = 1000 * 60 * 0.25; // 5 minutes
  const rouletteStart = new Date(Date.now() + timer);
  const embed = new EmbedBuilder()
    .setTitle('Roulette')
    .setColor('#601499')
    .setDescription(
      `To start slotty roulette, please react on the color you want to bet on\n## Voting will end ${time(
        rouletteStart,
        TimestampStyles.RelativeTime
      )}`
    );

  const message = await interaction.editReply({
    embeds: [embed],
  });

  await message.react(red);
  await message.react(gold);
  await message.react(black);

  const collector = message.createReactionCollector({
    time: timer,
    dispose: true,
  });

  collector.on('collect', async (reaction: MessageReaction, user: User) => {
    if (
      !(
        ['slotted_red', 'slotted_gold', 'slotted_black'].includes(
          reaction.emoji.name!
        ) && message.author.id !== user.id
      )
    )
      return;
    const userEntry = participants.get(user.id);
    if (!userEntry) {
      participants.set(user.id, reaction.emoji.id!);
    } else {
      await message.reactions.resolve(userEntry)?.users.remove(user.id);
      participants.delete(user.id);
      participants.set(user.id, reaction.emoji.id!);
      console.log(
        `Removed reaction: ${userEntry} and added ${reaction.emoji.id}`
      );
    }
  });
  collector.on('create', async (reaction: MessageReaction, user: User) => {
    if (message.author.id === user.id) return;
    await reaction.remove();
  });
  collector.on(
    'end',
    (
      collected: ReadonlyCollection<string, MessageReaction>,
      reason: string
    ) => {
      console.log(` Collector ended: ${reason} - ${collected.size}`);
      if (reason == 'time') {
        const embed2 = new EmbedBuilder()
          .setTitle('Roulette')
          .setColor('#601499')
          .setDescription('## Voting has ended and round will start shortly!');
        interaction.editReply({
          embeds: [embed2],
        });
        message.reactions.removeAll();
        roulette(interaction);
      }
    }
  );
  collector.on('remove', async (reaction: MessageReaction, user: User) => {
    const userEntry = participants.get(user.id);
    if (userEntry && userEntry === reaction.emoji.id) {
      participants.delete(user.id);
    }
    console.log(`Removed reaction: ${userEntry}`);
  });
}
