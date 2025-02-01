import { CommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { config } from "../config";
const options = {method: 'GET', headers: {accept: 'text/plain'}};


export const data = new SlashCommandBuilder()
  .setName("crypto")
  .setDefaultMemberPermissions(0)
  .setDescription("Replies with crypto wallted & prices");


export async function execute(interaction: CommandInteraction) {

    var btcPrice = -1;
    var ltcPrice = -1;
    var btcAmount = -1;
    var ltcAmount = -1;
    const basePrice = parseInt(config.BASE_PRICE);

    // fetch BTC price
    await fetch('https://api.coingate.com/api/v2/rates/merchant/GBP/BTC', options)
    .then(res => res.json())
    .then(res => btcPrice = res)
    .catch(err => console.error(err));

    // fetch LTC price
    await fetch('https://api.coingate.com/api/v2/rates/merchant/GBP/LTC', options)
    .then(res => res.json())
    .then(res => ltcPrice = res)
    .catch(err => console.error(err));

    if(btcPrice == -1 || ltcPrice == -1) {
        return interaction.reply({content: "Error fetching BTC or LTC price", flags: MessageFlags.Ephemeral});
    }

    btcAmount = basePrice * btcPrice;
    ltcAmount = basePrice * ltcPrice;

    var message = '';
    message += `To purchase with Bitcoin send:\n`;
    message += `├ BTC: \`${btcAmount.toFixed(6)}\`\n`;
    message += `└ To:  \`${config.BTC_WALLET}\`\n\n`;
    message += `To purchase with Litecoin send:\n`;
    message += `├ LTC: \`${ltcAmount.toFixed(6)}\`\n`;
    message += `└ To:  \`${config.LTC_WALLET}\`\n`;


  return interaction.reply({content: message});
}