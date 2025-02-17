import {
  CommandInteraction,
  InteractionContextType,
  SlashCommandBuilder,
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('knownissues')
  .setContexts(InteractionContextType.Guild)
  .setDescription(
    'Sends informational text regarding some of the known issues.'
  );

export async function execute(interaction: CommandInteraction) {
  const content = `# Known Issues

## Error 5
- **Description:** Error 5 is a common issue that occurs when other overlays are active.
- **Solution:** Disable any other overlays that may be running in the background alternatively wait with injecting until all overlays are loaded ingame.
  
## Loader connection issue:
- **Description:** The loader is unable to connect to the server and shows an empty cmd.
- **Solution:** This issue is usually caused by a firewall or antivirus blocking the connection. Make sure to whitelist the loader in your firewall and antivirus settings. Alternatively, try using a VPN.
`;

  return interaction.reply({
    content: content,
  });
}
