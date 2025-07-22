import {
  CommandInteraction,
  InteractionContextType,
  SlashCommandBuilder,
} from 'discord.js';

export const type = 'slash';
export const name = 'licenseandloader';

export const allowed_servers = ['1074973203249770538', '1300479915308613702'];

export const data = new SlashCommandBuilder()
  .setName('licenseandloader')
  .setContexts(InteractionContextType.Guild)
  .setDescription('Sends informational text regarding license and loader.');

export async function execute(interaction: CommandInteraction) {
  const content = `**License & Loader**

Download loader given by zeri

Navigate to the folder where your loader is located.

Create a txt file named license where ur loader is located.

Open the txt and paste your license inside. 

**Setting up the Plugins Folder**
Download any available <#1383438316694671443> plugin.

In the same directory as your loader, create a new folder named plugins.

Place the downloaded plugin files in this plugins folder.`;

  return interaction.reply({
    content: content,
  });
}
