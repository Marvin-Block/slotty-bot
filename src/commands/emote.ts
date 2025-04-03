import {
  CommandInteraction,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getEmote } from '../helper/getEmote';
import { FixedOptions } from '../typeFixes';
export const type = 'slash';
export const name = 'faq';
export const allowed_servers = [
  '1074973203249770538',
  '1300479915308613702',
  '900017491554734080',
];

export const data = new SlashCommandBuilder()
  .setName('emote')
  .setContexts(InteractionContextType.Guild)
  .addStringOption((option) =>
    option
      .setName('emote')
      .setDescription('The emote you want to the image of to be sent')
      .setRequired(true)
  )
  .setDescription('Sends the image url to any emote.');

export async function execute(interaction: CommandInteraction) {
  const options = interaction.options as FixedOptions;
  const optionEmote = options.getString('emote', true);
  if (!optionEmote) {
    return interaction.reply({
      content: 'Please provide an emote.',
      flags: MessageFlags.Ephemeral,
    });
  }
  const emote = getEmote(optionEmote);
  if (emote.id === '') {
    return interaction.reply({
      content: 'Please provide a valid emote.',
      flags: MessageFlags.Ephemeral,
    });
  }
  const emoteId = emote.id;
  const emoteName = emote.name;
  const emoteUrl = `https://cdn.discordapp.com/emojis/${emoteId}.${
    emote.gif ? 'gif' : 'webp'
  }`;
  const content = `**${emoteName}**\n${emoteUrl}`;
  return interaction.reply({
    content: content,
    flags: MessageFlags.Ephemeral,
  });
}
