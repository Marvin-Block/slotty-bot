import { Client } from 'discord.js';
import { commands } from './commands';
import { config } from './config';
import { deployCommands } from './deploy-commands';

const client = new Client({
  intents: ['Guilds', 'GuildMessages', 'DirectMessages', 'MessageContent'],
});

client.once('ready', () => {
  console.log('Discord bot is ready! 🤖');
});

client.on('guildCreate', async (guild) => {
  await deployCommands({ guildId: guild.id });
});

client.on('guildAvailable', async (guild) => {
  await deployCommands({ guildId: guild.id });
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) {
    return;
  }
  const { commandName } = interaction;
  if (commands[commandName as keyof typeof commands]) {
    commands[commandName as keyof typeof commands].execute(interaction);
  }
});

client.on('messageCreate', async (message) => {
  if (
    message.content.startsWith('<:salute:1335591427031306342>') &&
    !message.author.bot
  ) {
    message.channel.send(
      '<:salute:1335591427031306342> <:slotty:1336010394829066240>'
    );
  }
});

client.login(config.DISCORD_TOKEN);
