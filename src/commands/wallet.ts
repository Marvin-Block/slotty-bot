import { PrismaClient } from "@prisma/client";
import {
  CommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
  time,
  TimestampStyles,
  userMention,
} from "discord.js";
import { FixedOptions } from "../typeFixes";
const prisma = new PrismaClient();

export const type = "slash";
export const name = "gambling";
export const allowed_servers = ["1074973203249770538", "1300479915308613702"];
const daily_amount = 5;

export const data = new SlashCommandBuilder()
  .setName("wallet")
  .setDescription("Wallet commands.")
  .addSubcommand((subcommand) =>
    subcommand.setName("balance").setDescription("Check your wallet balance.")
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
          .setMaxValue(100000)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("buycoins")
      .setDescription("Buy slotted coins.")
      .addIntegerOption((option) =>
        option
          .setName("amount")
          .setDescription("The amount of slotted coins you want to buy.")
          .setRequired(true)
          .setMinValue(100)
          .setMaxValue(100000)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("sellcoins")
      .setDescription("Sell slotted coins.")
      .addIntegerOption((option) =>
        option
          .setName("amount")
          .setDescription("The amount of slotted coins you want to buy.")
          .setRequired(true)
          .setMinValue(100)
          .setMaxValue(100000)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("basebet")
      .setDescription("Set the amount you want to bet with.")
      .addIntegerOption((option) =>
        option
          .setName("amount")
          .setDescription("The amount of money to set as standard.")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(100000)
      )
  );

export async function execute(interaction: CommandInteraction) {
  const options = interaction.options as FixedOptions;
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
    case "basebet":
      await setBaseBet(interaction);
      break;
  }
}

async function balance(interaction: CommandInteraction) {
  try {
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
      content: `Your balance is ${user.wallet.balance} coins.\nYour base bet is ${user.wallet.baseBet} coins.`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error(error);
    prisma.$disconnect();
    return interaction.reply("An error occurred.");
  }
}

async function daily(interaction: CommandInteraction) {
  try {
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

    await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.update({
        where: { id: user.wallet!.id },
        data: { balance: { increment: daily_amount } },
      });

      await tx.transactions.create({
        data: {
          amount: daily_amount,
          type: "daily",
          wallet: { connect: { id: wallet.id } },
          user: { connect: { discordID: interaction.user.id } },
        },
      });
    });
    prisma.$disconnect();

    return await interaction.reply({
      content: `You claimed your daily reward of ${daily_amount} coins!`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error(error);
    prisma.$disconnect();
    return interaction.reply("An error occurred.");
  }
}

async function transfer(interaction: CommandInteraction) {
  const options = interaction.options as FixedOptions;
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

  try {
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

    await prisma.$transaction(async (tx) => {
      const senderWallet = await tx.wallet.update({
        where: { id: user.wallet!.id },
        data: { balance: { decrement: amount } },
      });

      await tx.transactions.create({
        data: {
          amount: amount,
          type: "sent transfer",
          wallet: { connect: { id: senderWallet.id } },
          user: { connect: { discordID: interaction.user.id } },
        },
      });

      const receiverWallet = await tx.wallet.update({
        where: { id: recipient.wallet!.id },
        data: { balance: { increment: amount } },
      });

      await tx.transactions.create({
        data: {
          amount,
          type: "received transfer",
          wallet: { connect: { id: receiverWallet.id } },
          user: { connect: { discordID: to.id } },
        },
      });
    });

    prisma.$disconnect();

    return interaction.reply(
      `You transferred ${amount} coins to ${userMention(to.id)}.`
    );
  } catch (error) {
    console.error(error);
    prisma.$disconnect();
    return interaction.reply("An error occurred.");
  }
}

async function setBaseBet(interaction: CommandInteraction) {
  const options = interaction.options as FixedOptions;
  const amount = options.getInteger("amount");

  if (!amount) {
    return interaction.reply({
      content: "An error occurred.",
      flags: MessageFlags.Ephemeral,
    });
  }
  try {
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

    if (user.wallet.balance < amount) {
      return interaction.reply({
        content: "You dont have enough money to set this as your base bet.",
        flags: MessageFlags.Ephemeral,
      });
    }

    await prisma.wallet.update({
      where: { id: user.wallet.id },
      data: { baseBet: amount },
    });

    prisma.$disconnect();

    return interaction.reply({
      content: `You set your base bet to ${amount} coins.`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error(error);
    prisma.$disconnect();
    return interaction.reply({
      content: "An error occurred.",
      flags: MessageFlags.Ephemeral,
    });
  }
}
