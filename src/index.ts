import { Client, Collection, Events, MessageFlags } from 'discord.js';
// import * as fs from 'fs';
// import * as path from 'path';
import { commands } from './commands';
import * as reminder from './commands/reminder';
import { config } from './config';
import { deployCommands } from './deploy-commands';
import * as blacklist from './helper/blacklist';
import * as userEntry from './helper/createUserEntry';
import { SecureRandomGenerator } from './secure_random_number';
import * as saluteGambling from './text-commands/salutegambling';
import { ExtendedClient } from './typeFixes';

const secRand = new SecureRandomGenerator();

const client = new Client({
  intents: [
    'GuildMessageReactions',
    'Guilds',
    'GuildMessages',
    'GuildModeration',
    'GuildExpressions',
    'GuildPresences',
    'GuildMessages',
    'GuildMembers',
    'DirectMessages',
    'MessageContent',
    'GuildMembers',
  ],
}) as ExtendedClient;

client.commands = new Collection();
client.contextMenuCommands = new Collection();
client.modalCommands = new Collection();

let t: keyof typeof commands;
for (t in commands) {
  const command = commands[t];
  if (command.type === 'slash') {
    client.commands.set(command.data.name, command);
  }
  if (command.type == 'contextMenu' || command.name === 'stats') {
    client.contextMenuCommands.set(command.contextMenuData.name, command);
  }
  if (command.name === 'echo') {
    client.modalCommands.set(command.cutomId, command);
  }
}

client.once(Events.ClientReady, async () => {
  console.log('Discord bot is ready! 🤖');
  secRand.generateCommitment();
});

client.on(Events.GuildCreate, async (guild) => {
  await deployCommands({ guildId: guild.id }, client);
});

client.on(Events.GuildAvailable, async (guild) => {
  await deployCommands({ guildId: guild.id }, client);
  blacklist.checkUsers(guild);
  userEntry.checkUsers(guild);
  reminder.handleReminder(guild);
});

client.on(Events.GuildMemberAdd, async (member) => {
  blacklist.run(member);
  userEntry.addOnJoin(member);
});

client.on(Events.InteractionCreate, async (interaction) => {
  const client = interaction.client as ExtendedClient;

  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) {
      console.error(`Command ${interaction.commandName} not found`);
      return;
    }

    try {
      return await command.execute(interaction);
    } catch (error) {
      console.error(error);
      if (interaction.replied || interaction.deferred) {
        return await interaction.followUp({
          content: 'There was an error while executing this command!',
          flags: MessageFlags.Ephemeral,
        });
      } else {
        return await interaction.reply({
          content: 'There was an error while executing this command!',
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  } else if (interaction.isContextMenuCommand()) {
    const command = client.contextMenuCommands.get(interaction.commandName);
    if (!command) {
      console.error(`Command ${interaction.commandName} not found`);
      return;
    }

    try {
      return await command.contextMenuExecute(interaction);
    } catch (error) {
      console.error(error);
      if (interaction.replied || interaction.deferred) {
        return await interaction.followUp({
          content: 'There was an error while executing this command!',
          flags: MessageFlags.Ephemeral,
        });
      } else {
        return await interaction.reply({
          content: 'There was an error while executing this command!',
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  } else if (interaction.isModalSubmit()) {
    const command = client.modalCommands.get(interaction.customId);
    if (!command) {
      console.error(`Command ${interaction.customId} not found`);
      return;
    }
    try {
      return await command.handleModal(interaction);
    } catch (error) {
      console.error(error);
      if (interaction.replied || interaction.deferred) {
        return await interaction.followUp({
          content: 'There was an error while executing this command!',
          flags: MessageFlags.Ephemeral,
        });
      } else {
        return await interaction.reply({
          content: 'There was an error while executing this command!',
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  } else {
    return;
  }
});

client.on(Events.MessageCreate, async (message) => {
  saluteGambling.run(message);
});

client.login(config.DISCORD_TOKEN);
