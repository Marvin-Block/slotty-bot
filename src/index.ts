import {
  Client,
  Collection,
  Events,
  MessageFlags,
  TextChannel,
} from 'discord.js';
// import * as fs from 'fs';
// import * as path from 'path';
import { commands } from './commands';
import { config } from './config';
import { deployCommands } from './deploy-commands';
import * as blacklist from './helper/blacklist';
import * as userEntry from './helper/createUserEntry';
import { SecureRandomGenerator } from './secure_random_number';
import * as saluteGambling from './text-commands/salutegambling';
import { extendedClient } from './typeFixes';

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
    'DirectMessages',
    'MessageContent',
    'GuildMembers',
  ],
}) as extendedClient;

client.commands = new Collection();
client.contextMenuCommands = new Collection();

// const commandsPath = path.join(__dirname, 'commands');
// const commandFiles = fs
//   .readdirSync(commandsPath)
//   .filter((file) => file.endsWith('.ts'));

let t: keyof typeof commands;

for (t in commands) {
  const command = commands[t];
  client.commands.set(command.data.name, command);
}

// for (const file of commandFiles) {
//   const filePath = path.join(commandsPath, file);
//   const command = require(filePath);
//   if ('data' in command && 'execute' in command) {
//     client.commands.set(command.data.name, command);
//   } else {
//     console.log(`Command ${file} is missing data or execute function`);
//   }
//   if ('contextMenuData' in command && 'contextMenuExecute' in command) {
//     client.contextMenuCommands.set(command.contextMenuData.name, command);
//   }
// }

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
});

client.on(Events.GuildMemberAdd, async (member) => {
  blacklist.run(member);
  userEntry.addOnJoin(member);
});

client.on(Events.InteractionCreate, async (interaction) => {
  const client = interaction.client as extendedClient;

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
  } else {
    return;
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isModalSubmit()) return;

  if (interaction.customId === 'echoModal') {
    const channelid = interaction.fields.getTextInputValue('channelid');
    const messageid = interaction.fields.getTextInputValue('messageid');
    const messageInput = interaction.fields.getTextInputValue('messageInput');
    if (messageInput.length > 2000) {
      return interaction.reply(
        'Message is too long, please keep it under 2000 characters'
      );
    }

    try {
      if (!messageid) {
        const channel = client.channels.cache.get(channelid) as TextChannel;
        if (!channel) return interaction.reply(messageInput);

        return channel.send(messageInput);
      } else {
        const channel = client.channels.cache.get(channelid) as TextChannel;
        if (!channel) return interaction.reply(messageInput);

        const message = await channel.messages.fetch(messageid);
        if (!message)
          return interaction.reply({
            content: 'Message not found',
            flags: MessageFlags.Ephemeral,
          });

        return message.edit(messageInput);
      }
    } catch (e) {
      console.log(e);
      return interaction.reply({
        content: 'An error occurred',
        flags: MessageFlags.Ephemeral,
      });
    }
  }
  return;
});

client.on(Events.MessageCreate, async (message) => {
  saluteGambling.run(message);
});

client.login(config.DISCORD_TOKEN);
