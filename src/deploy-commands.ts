import { Client, Collection, REST, Routes } from 'discord.js';
import { config } from './config';
import { CommandCollection, ContextMenuCommandCollection } from './typeFixes';

const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN);

type DeployCommandsProps = {
  guildId: string;
};

export async function deployCommands(
  { guildId }: DeployCommandsProps,
  client: Client<boolean> & {
    commands: Collection<string, any>;
    contextMenuCommands: Collection<string, any>;
  }
) {
  console.log(`Deploying commands to guild ${guildId}`);
  const commandsData = client.commands.map((command: CommandCollection) => {
    if (command.allowed_servers) {
      if (command.allowed_servers.includes(guildId)) {
        console.log(`\n${command.data.name}`);
        if (command.data.options.length > 0) {
          for (let i = 0; i < command.data.options.length; i++) {
            if (i === command.data.options.length - 1) {
              console.log(` └ ${command.data.options[i].name}`);
              break;
            }
            console.log(` ├ ${command.data.options[i].name}`);
          }
        }
        return command.data;
      }
    }
    return null;
  });

  console.log(`\nDeploying context menu commands to guild ${guildId}`);
  const contextMenuData = client.contextMenuCommands.map(
    (command: ContextMenuCommandCollection) => {
      if (command.allowed_servers) {
        if (command.allowed_servers.includes(guildId)) {
          console.log(`- ${command.contextMenuData.name}`);
          return command.contextMenuData;
        }
      }
    }
  );
  try {
    console.log('\nStarted applying commands.');
    await rest.put(
      Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, guildId),
      {
        body: [...commandsData, ...contextMenuData],
      }
    );

    console.log('Successfully applied commands.');
  } catch (error) {
    console.error(error);
  }
}
