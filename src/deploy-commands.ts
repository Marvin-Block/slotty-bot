import { Client, Collection, REST, Routes } from 'discord.js';
import { config } from './config';
import { logger } from './helper/logger';
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
  logger.info(`Collecting commands for guild ${guildId}`);
  const commandsData = client.commands.map((command: CommandCollection) => {
    if (command.allowed_servers) {
      if (command.allowed_servers.includes(guildId)) {
        logger.info(`- ${command.data.name}`);
        if (command.data.options.length > 0) {
          for (let i = 0; i < command.data.options.length; i++) {
            if (i === command.data.options.length - 1) {
              logger.info(`  └ ${command.data.options[i].name}`);
              break;
            }
            logger.info(`  ├ ${command.data.options[i].name}`);
          }
        }
        return command.data;
      }
    }
    return null;
  });
  logger.info(`Collecting context menu commands for guild ${guildId}`);
  const contextMenuData = client.contextMenuCommands.map(
    (command: ContextMenuCommandCollection) => {
      if (command.allowed_servers) {
        if (command.allowed_servers.includes(guildId)) {
          logger.info(`- ${command.contextMenuData.name}`);
          return command.contextMenuData;
        }
      }
      return null;
    }
  );
  try {
    logger.info('Started applying commands.');
    await rest.put(
      Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, guildId),
      {
        body: [...commandsData, ...contextMenuData],
      }
    );

    logger.info('Successfully applied commands.');
  } catch (error) {
    logger.error(error, 'Error deploying commands:');
  }
}
