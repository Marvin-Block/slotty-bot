import { Client, Events, MessageFlags, TextChannel } from 'discord.js';
import { commands } from './commands';
import { config } from './config';
import { deployCommands } from './deploy-commands';

const client = new Client({
  intents: ['Guilds', 'GuildMessages', 'DirectMessages', 'MessageContent'],
});

client.once(Events.ClientReady, () => {
  console.log('Discord bot is ready! 🤖');
});

client.on(Events.GuildCreate, async (guild) => {
  await deployCommands({ guildId: guild.id });
});

client.on(Events.GuildAvailable, async (guild) => {
  await deployCommands({ guildId: guild.id });
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isCommand()) {
    return;
  }

  const { commandName } = interaction;
  if (commands[commandName as keyof typeof commands]) {
    commands[commandName as keyof typeof commands].execute(interaction);
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
      interaction.reply({
        content: 'An error occurred',
        flags: MessageFlags.Ephemeral,
      });
      console.log(e);
    }
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (
    message.content.startsWith('<:salute:1335591427031306342>') &&
    !message.author.bot
  ) {
    let rng = Math.floor(Math.random() * 100);

    // special case for sx
    if (message.author.id == '846185075372720158') {
      // 65% chance of sending a static emoji, 35% chance of sending a gif
      if (rng < 65) {
        return message.channel.send(
          '<:salute:1335591427031306342> <:slotty:1336010394829066240>'
        );
      } else {
        return message.channel.send(
          '<:salute:1335591427031306342> <a:slotty_gif:1336009659399802900>'
        );
      }
    }

    // 85% chance of sending a static emoji, 15% chance of sending a gif, 1% chance of sending a special message
    if (rng == 69) {
      return message.channel.send(
        '<:salute:1335591427031306342> <a:slotty_gif:1336009659399802900> <a:slotty_gif:1336009659399802900> <a:slotty_gif:1336009659399802900> <a:slotty_gif:1336009659399802900> <a:slotty_gif:1336009659399802900> <a:slotty_gif:1336009659399802900>'
      );
    } else if (rng < 85) {
      return message.channel.send(
        '<:salute:1335591427031306342> <:slotty:1336010394829066240>'
      );
    } else {
      return message.channel.send(
        '<:salute:1335591427031306342> <a:slotty_gif:1336009659399802900>'
      );
    }
  }
});

client.login(config.DISCORD_TOKEN);
