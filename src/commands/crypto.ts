import { PrismaClient } from "@prisma/client";
import {
  codeBlock,
  CommandInteraction,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
  time,
  TimestampStyles,
} from "discord.js";
import { config } from "../config.js";
import { logger } from "../helper/logger";
import { FixedOptions } from "../typeFixes";
const options = { method: "GET", headers: { accept: "text/plain" } };
const prisma = new PrismaClient();
export const type = "slash";
export const name = "crypto";
export const allowed_servers = ["1074973203249770538", "1300479915308613702", "900017491554734080"];

export const data = new SlashCommandBuilder()
  .setName("crypto")
  .setContexts(InteractionContextType.Guild)
  .setDefaultMemberPermissions(0)
  .addStringOption((option) =>
    option
      .setName("time")
      .setDescription("Subscription time")
      .setRequired(true)
      .addChoices(
        { name: "1 Week", value: config.WEEK_PRICE },
        { name: "1 Month", value: config.BASE_PRICE },
        { name: "3 Months", value: config.THREE_MONTH_PRICE }
      )
  )
  .addUserOption((option) =>
    option.setName("user").setDescription("User to send the crypto info to").setRequired(true)
  )
  .setDescription("Replies with crypto wallet & prices");

export async function execute(interaction: CommandInteraction) {
  const interactionOptions = interaction.options as FixedOptions;
  const value = interactionOptions.getString("time");
  const user = interactionOptions.getUser("user");

  if (value == undefined) {
    return interaction.reply({
      content: `An error occurred, please contact the support.\n${codeBlock(
        "ps",
        `[ERROR]: "Interaction option 'time' not found"`
      )}`,
      flags: MessageFlags.Ephemeral,
    });
  }

  if (!user) {
    return interaction.reply({
      content: `An error occurred, please contact the support.\n${codeBlock(
        "ps",
        `[ERROR]: "Interaction option 'user' not found"`
      )}`,
      flags: MessageFlags.Ephemeral,
    });
  }

  var btcPrice = -1;
  var ltcPrice = -1;
  var btcAmount = -1;
  var ltcAmount = -1;

  const dbUser = await prisma.user.findUnique({
    where: { discordID: user.id },
  });

  if (!dbUser) {
    return interaction.reply({
      content: `An error occurred, please contact the support.\n${codeBlock(
        "ps",
        `[ERROR]: "User not found in database"`
      )}`,
      flags: MessageFlags.Ephemeral,
    });
  }

  const member = await interaction.guild?.members.fetch(user.id).catch(() => null);

  if (!member) {
    return interaction.reply({
      content: `An error occurred, please contact the support.\n${codeBlock(
        "ps",
        `[ERROR]: "User not found in guild"`
      )}`,
      flags: MessageFlags.Ephemeral,
    });
  }

  var discount = 0;
  const memberRoles = member.roles.cache;
  logger.debug(`has Tier 1: ${memberRoles.has(config.TIER1)}`);
  logger.debug(`has Tier 2: ${memberRoles.has(config.TIER2)}`);
  logger.debug(`has Tier 3: ${memberRoles.has(config.TIER3)}`);
  switch (dbUser.discountCounter) {
    case 3:
      memberRoles.has(config.TIER3) ? (discount = 30) : (discount = 0);
      break;
    case 2:
      memberRoles.has(config.TIER2) ? (discount = 20) : (discount = 0);
      break;
    case 1:
      memberRoles.has(config.TIER1) ? (discount = 10) : (discount = 0);
      break;
  }

  let basePrice = parseInt(value as string);

  logger.info(
    `Fetching crypto prices for user ${user.id} with base price ${basePrice} and discount -${discount}`
  );

  basePrice = basePrice - discount;

  // fetch BTC price
  await fetch("https://api.coingate.com/api/v2/rates/merchant/GBP/BTC", options)
    .then((res) => res.json())
    .then((res) => (btcPrice = res))
    .catch((err) => logger.error(err, "Error fetching BTC price"));

  // fetch LTC price
  await fetch("https://api.coingate.com/api/v2/rates/merchant/GBP/LTC", options)
    .then((res) => res.json())
    .then((res) => (ltcPrice = res))
    .catch((err) => logger.error(err, "Error fetching LTC price"));

  if (btcPrice == -1 || ltcPrice == -1) {
    return interaction.reply({
      content: "Error fetching BTC or LTC price",
      flags: MessageFlags.Ephemeral,
    });
  }

  btcAmount = basePrice * btcPrice;
  ltcAmount = basePrice * ltcPrice;

  const endTime = new Date();
  endTime.setDate(endTime.getDate() + 2);

  var message = ``;
  message += `To purchase with Bitcoin send:\n`;
  message += `├ BTC: \`${btcAmount.toFixed(6)}\`\n`;
  message += `└ To:  \`${config.BTC_WALLET}\`\n\n`;
  message += `To purchase with Litecoin send:\n`;
  message += `├ LTC: \`${ltcAmount.toFixed(6)}\`\n`;
  message += `└ To:  \`${config.LTC_WALLET}\`\n\n`;
  message += `# The addresses will expire ${time(endTime, TimestampStyles.RelativeTime)}\n`;
  message += `-# Price including applicable discounts is £${basePrice}`;

  return interaction.reply({ content: message });
}
