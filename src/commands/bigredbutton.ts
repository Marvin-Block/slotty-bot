import { CommandInteraction, SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('bigredbutton')
  .addStringOption((option) =>
    option
      .setName('location')
      .setDescription('The location to send the missiles to.')
      .setRequired(true)
  )
  .setDescription(
    'Sends intercontinental ballistic missiles to the specified location.'
  );

export async function execute(interaction: CommandInteraction) {
  const location = interaction.options.get('location')?.value as string;
  return interaction.reply({
    content:
      'Official Slotted missile launch sequence initiated. Targeting ' +
      location +
      '.',
  });
}
