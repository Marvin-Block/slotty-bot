import {
  CommandInteraction,
  InteractionContextType,
  SlashCommandBuilder,
} from 'discord.js';

export const type = 'slash';
export const name = 'inactivity';
export const allowed_servers = ['1074973203249770538', '900017491554734080'];

export const data = new SlashCommandBuilder()
  .setName('inactivity')
  .setContexts(InteractionContextType.Guild)
  .setDescription(
    'Sends informational text regarding inactivity in the application process.'
  );

export async function execute(interaction: CommandInteraction) {
  const content = `# <a:alert:1365290359072100423> 48 HOURS UNTIL YOUR APPLICATION & SLOT ARE TERMINATED FOR INACTIVITY`;

  return interaction.reply({
    content: content,
  });
}
