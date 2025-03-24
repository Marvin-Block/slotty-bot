import { PrismaClient } from '@prisma/client';
import {
  CommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { FixedOptions } from '../typeFixes';

const prisma = new PrismaClient();

export const type = 'slash';
export const name = 'license';
export const allowed_servers = ['1074973203249770538', '1300479915308613702'];

export const data = new SlashCommandBuilder()
  .setName('license')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('link')
      .setDescription('Links your slotted key to your discord account')
      .addStringOption((option) =>
        option
          .setName('key')
          .setDescription('The key you want to link to your discord account')
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand.setName('list').setDescription('Lists all your linked keys')
  );

export async function execute(interaction: CommandInteraction) {
  const options = interaction.options as FixedOptions;
  const subcommand = options.getSubcommand();
  switch (subcommand) {
    case 'link':
      linkLicense(interaction, options);
      break;
    case 'list':
      listLicenses(interaction);
      break;

    default:
      break;
  }
}

async function linkLicense(
  interaction: CommandInteraction,
  options: FixedOptions
) {
  // TODO: add check on backend to see if key is valid before linking
  try {
    const key = options.getString('key');
    if (!key) {
      await prisma.$disconnect();
      console.log('No key provided');
      return interaction.reply({
        content: 'No key provided',
        flags: MessageFlags.Ephemeral,
      });
    }
    const user = await prisma.user.findFirst({
      where: { discordID: interaction.user.id },
    });
    if (!user) {
      const result = await prisma.user.create({
        data: { discordID: interaction.user.id, keys: { create: { key } } },
      });
      console.log(`Created user ${result.discordID} with key ${key}`);
    } else {
      const result = await prisma.user.update({
        where: { discordID: interaction.user.id },
        data: { keys: { create: { key } } },
      });
      console.log(`Updated user ${result.discordID} with key ${key}`);
    }
    await prisma.$disconnect();
    return interaction.reply({
      content: 'Successfully linked',
      flags: MessageFlags.Ephemeral,
    });
  } catch (e) {
    console.error(e);
    await prisma.$disconnect();
    return interaction.reply({
      content: 'An error occured, please contact the support',
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function listLicenses(interaction: CommandInteraction) {
  return interaction.reply({
    content: 'Listing your licenses...',
    ephemeral: true,
  });
}
