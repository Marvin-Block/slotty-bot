import {
  CommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
  time,
  TimestampStyles,
  userMention,
} from "discord.js";
import { fixedOptions } from "../typeFixes";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("gambling")
    .setDescription("Gambling commands.")
    .addSubcommandGroup((group) =>
      group
        .setDescription("Gambling commands.")
        .setName("wallet")
        .addSubcommand((subcommand) =>
          subcommand
            .setName("balance")
            .setDescription("Check your wallet balance.")
        )
        .addSubcommand((subcommand) =>
          subcommand.setName("daily").setDescription("Claim your daily reward.")
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("transfer")
            .setDescription("Transfer money to another user.")
            .addUserOption((option) =>
              option
                .setName("to")
                .setDescription("The user to transfer money to.")
                .setRequired(true)
            )
            .addIntegerOption((option) =>
              option
                .setName("amount")
                .setDescription("The amount of money to transfer.")
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(1000)
            )
        )
    ),
  async execute(interaction: CommandInteraction) {
    const options = interaction.options as fixedOptions;
    const subcommandGroup = options.getSubcommandGroup();
    switch (subcommandGroup) {
      case "wallet": {
        const subcommand = options.getSubcommand();
        switch (subcommand) {
          case "balance":
            await balance(interaction);
            break;
          case "daily":
            await daily(interaction);
            break;
          case "transfer":
            await transfer(interaction);
            break;
        }
        break;
      }
    }
  },
};

async function balance(interaction: CommandInteraction) {
  const user = await prisma.user.findFirst({
    where: { discordID: interaction.user.id },
    include: { wallet: true },
  });
  if (!user || !user.wallet) {
    return interaction.reply({
      content: "An error occurred.",
      flags: MessageFlags.Ephemeral,
    });
  }
  return await interaction.reply({
    content: `Your balance is ${user.wallet.balance} coins.`,
    flags: MessageFlags.Ephemeral,
  });
}

async function daily(interaction: CommandInteraction) {
  const user = await prisma.user.upsert({
    where: { discordID: interaction.user.id },
    update: {},
    create: { discordID: interaction.user.id },
    include: { wallet: true, transactions: true },
  });
  if (!user || !user.wallet) {
    return interaction.reply({
      content: "An error occurred.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const ONE_HOUR = 3_600_000;

  const lastDaily = user.transactions.find(
    (t) =>
      t.type === "daily" && t.createdAt > new Date(Date.now() - ONE_HOUR * 20)
  );

  if (lastDaily) {
    const date = new Date(lastDaily.createdAt.getTime() + ONE_HOUR * 20);
    return interaction.reply({
      content: `You can claim your daily reward in ${time(
        date,
        TimestampStyles.RelativeTime
      )}`,
      flags: MessageFlags.Ephemeral,
    });
  }

  const wallet = await prisma.wallet.update({
    where: { id: user.wallet.id },
    data: { balance: { increment: 100 } },
  });

  await prisma.transactions.create({
    data: {
      amount: 100,
      type: "daily",
      wallet: { connect: { id: wallet.id } },
      user: { connect: { discordID: interaction.user.id } },
    },
  });

  return await interaction.reply("You claimed your daily reward of 100 coins!");
}

async function transfer(interaction: CommandInteraction) {
  const options = interaction.options as fixedOptions;
  const to = options.getUser("to");
  const amount = options.getInteger("amount");

  if (!to || !amount) {
    return interaction.reply("An error occurred.");
  }

  if (to.id === interaction.user.id) {
    return await interaction.reply("You can't transfer money to yourself.");
  }

  if (to.bot) {
    return await interaction.reply("You can't transfer money to a bot.");
  }

  const user = await prisma.user.findFirst({
    where: { discordID: interaction.user.id },
    include: { wallet: true },
  });

  const recipient = await prisma.user.findFirst({
    where: { discordID: to.id },
    include: { wallet: true },
  });

  if (!user || !user.wallet || !recipient || !recipient.wallet) {
    return interaction.reply("An error occurred.");
  }

  if (user.wallet.balance < amount) {
    return interaction.reply("You don't have enough money to transfer.");
  }

  // SENDER UPDATE
  await prisma.wallet.update({
    where: { id: user.wallet.id },
    data: { balance: { decrement: amount } },
  });

  await prisma.transactions.create({
    data: {
      amount: -amount,
      type: "transfer",
      wallet: { connect: { id: user.wallet.id } },
      user: { connect: { discordID: interaction.user.id } },
    },
  });

  // RECIPIENT UPDATE
  await prisma.wallet.update({
    where: { id: recipient.wallet.id },
    data: { balance: { increment: amount } },
  });

  await prisma.transactions.create({
    data: {
      amount,
      type: "transfer",
      wallet: { connect: { id: recipient.wallet.id } },
      user: { connect: { discordID: to.id } },
    },
  });

  return interaction.reply(
    `You transferred ${amount} coins to ${userMention(to.id)}.`
  );
}
