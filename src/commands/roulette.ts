import { PrismaClient } from '@prisma/client';
import {
  AttachmentBuilder,
  CommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import { SecureRandomGenerator } from '../secure_random_number';
import { fixedOptions } from '../typeFixes';

const prisma = new PrismaClient();
const secRand = new SecureRandomGenerator();

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
      return roulette(interaction);
    default:
      return;
  }
}

async function roulette(interaction: CommandInteraction) {
  let rng1 = await secRand.generateSecureRandom(1, 100);
  let rng2 = 0;
  let type = 'none';
  // Red - 45% chance
  if (rng1.number > 0 && rng1.number <= 45) {
    // select random variance from 1 to 24
    await secRand.generateSecureRandom(1, 24).then((rng) => {
      rng2 = rng.number;
      type = 'Red';
    });
  }
  // Gold - 10% chance
  if (rng1.number > 45 && rng1.number <= 55) {
    // select random variance from 1 to 5
    await secRand.generateSecureRandom(1, 5).then((rng) => {
      rng2 = rng.number;
      type = 'Gold';
    });
  }
  // Black - 45% chance
  if (rng1.number > 55 && rng1.number <= 100) {
    // select random variance from 1 to 24
    await secRand.generateSecureRandom(1, 24).then((rng) => {
      rng2 = rng.number;
      type = 'Black';
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
    .setImage(`attachment://Optimized-${type}-${rng2}.gif`);

  interaction.editReply({
    embeds: [embed],
    files: [attachment],
  });
  // wait 18.63 seconds + loading buffer for gif to finish playing
  await new Promise((resolve) => setTimeout(resolve, 23_000));
  const embed2 = new EmbedBuilder()
    .setTitle('Roulette')
    .setColor('#601499')
    .setDescription(`# You got **${type}**!\n Congratulations`);
  interaction.editReply({
    embeds: [embed2],
    files: [],
  });
  await prisma.$disconnect();
}
