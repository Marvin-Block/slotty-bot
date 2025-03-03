import {
  CommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import { config } from "../config";
import { fixedOptions } from "../typeFixes";
const options = { method: "GET", headers: { accept: "text/plain" } };

export const data = new SlashCommandBuilder()
  .setName("crypto")
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
  .setDescription("Replies with crypto wallted & prices");

export async function execute(interaction: CommandInteraction) {
  const interactionOptions = interaction.options as fixedOptions;
  const value = interactionOptions.getString("time");

  if (value == undefined) {
    return interaction.reply({
      content: "Error fetching price",
      flags: MessageFlags.Ephemeral,
    });
  }

  var btcPrice = -1;
  var ltcPrice = -1;
  var btcAmount = -1;
  var ltcAmount = -1;
  const basePrice = parseInt(value as string);

  // fetch BTC price
  await fetch("https://api.coingate.com/api/v2/rates/merchant/GBP/BTC", options)
    .then((res) => res.json())
    .then((res) => (btcPrice = res))
    .catch((err) => console.error(err));

  // fetch LTC price
  await fetch("https://api.coingate.com/api/v2/rates/merchant/GBP/LTC", options)
    .then((res) => res.json())
    .then((res) => (ltcPrice = res))
    .catch((err) => console.error(err));

  if (btcPrice == -1 || ltcPrice == -1) {
    return interaction.reply({
      content: "Error fetching BTC or LTC price",
      flags: MessageFlags.Ephemeral,
    });
  }

  btcAmount = basePrice * btcPrice;
  ltcAmount = basePrice * ltcPrice;

  var message = "";
  message += `To purchase with Bitcoin send:\n`;
  message += `├ BTC: \`${btcAmount.toFixed(6)}\`\n`;
  message += `└ To:  \`${config.BTC_WALLET}\`\n\n`;
  message += `To purchase with Litecoin send:\n`;
  message += `├ LTC: \`${ltcAmount.toFixed(6)}\`\n`;
  message += `└ To:  \`${config.LTC_WALLET}\`\n`;

  return interaction.reply({ content: message });
}
