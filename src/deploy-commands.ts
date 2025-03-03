import { Client, Collection, REST, Routes } from "discord.js";
import { config } from "./config";

const rest = new REST({ version: "10" }).setToken(config.DISCORD_TOKEN);

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
  const commandsData = client.commands.map((command) => command.data);
  const contextMenuData = client.contextMenuCommands.map(
    (command) => command.contextMenuData
  );
  try {
    console.log("Started refreshing application (/) commands.");

    await rest.put(
      Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, guildId),
      {
        body: [...commandsData, ...contextMenuData],
      }
    );

    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error(error);
  }
}
