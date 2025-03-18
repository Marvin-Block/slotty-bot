import { PrismaClient } from '@prisma/client';
import {
  CommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { fixedOptions } from '../typeFixes';
const prisma = new PrismaClient();

export const type = 'slash';
export const name = 'federalreserve';

export const data = new SlashCommandBuilder()
  .setName('federalreserve')
  .setDescription('Federal reserve commands.')
  .setDefaultMemberPermissions(0)
  .addSubcommand((subcommand) =>
    subcommand
      .setName('print')
      .setDescription('Time to print money!')
      .addIntegerOption((option) =>
        option
          .setName('amount')
          .setDescription('The amount of money you want to print.')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(100000)
      )
  );

export async function execute(interaction: CommandInteraction) {
  const options = interaction.options as fixedOptions;
  const subcommand = options.getSubcommand();
  switch (subcommand) {
    case 'print':
      await printMoney(interaction);
      break;
  }
}

async function printMoney(interaction: CommandInteraction) {
  const options = interaction.options as fixedOptions;
  const amount = options.getInteger('amount');

  if (!amount) {
    return interaction.reply({
      content: 'An error occurred.',
      flags: MessageFlags.Ephemeral,
    });
  }
  try {
    const user = await prisma.user.findFirst({
      where: { discordID: interaction.user.id },
      include: { wallet: true, transactions: true },
    });

    if (!user || !user.wallet || !user.transactions) {
      return interaction.reply({
        content: 'An error occurred.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.update({
        where: { id: user.wallet!.id },
        data: { balance: { increment: amount } },
      });
      await tx.transactions.create({
        data: {
          amount: amount,
          type: 'credit',
          wallet: { connect: { id: wallet.id } },
          user: { connect: { discordID: interaction.user.id } },
        },
      });
    });

    prisma.$disconnect();

    return interaction.reply({
      content: `You have successfully printed ${amount} coins.`,
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
