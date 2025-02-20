import { Attachment, AttachmentBuilder, Client, Events, MessageFlags, TextChannel } from 'discord.js';
import { commands } from './commands';
import { config } from './config';
import { deployCommands } from './deploy-commands';
import { SecureRandomGenerator } from './secure_random_number';

const secRand = new SecureRandomGenerator();

const client = new Client({
  intents: ['Guilds', 'GuildMessages', 'DirectMessages', 'MessageContent'],
});

client.once(Events.ClientReady, () => {
  console.log('Discord bot is ready! 🤖');
  
  secRand.generateCommitment();
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
    const sentMessage = await message.channel.send("<a:load_salute:1342202643484774400>");
    const channelMessages = await message.channel.fetch();
    const msg = channelMessages.messages.cache.get(sentMessage.id)!;

    let rng = await secRand.generateSecureRandom(0, 1000);

    //0.1 %
    if(rng.number == 69) {
      const attachment = new AttachmentBuilder('./assets/supreme_salute.gif');
      setTimeout(() => {
        msg.edit({ content: '', files: [attachment] });
      }, 1000);
    }
    // 1 %
    else if (rng.number >= 420 && rng.number < 430) {
      setTimeout(() => {
        msg.edit('<:salute:1335591427031306342>');
        setTimeout(() => {
          msg.edit('<:salute:1335591427031306342> <a:slotty_gif:1336009659399802900>');
          setTimeout(() => {
            msg.edit('<:salute:1335591427031306342> <a:slotty_gif:1336009659399802900> <a:slotty_gif:1336009659399802900>');
            setTimeout(() => {
              msg.edit('<:salute:1335591427031306342> <a:slotty_gif:1336009659399802900> <a:slotty_gif:1336009659399802900> <a:slotty_gif:1336009659399802900>');
            }, 1000);
          }, 1000);
        }, 1000);
      }, 1000);
    }
    // 83.9 %
    else if (rng.number < 840) {
      setTimeout(() => {
        msg.edit('<:salute:1335591427031306342>');
        setTimeout(() => {
          msg.edit('<:salute:1335591427031306342> <:slotty:1336010394829066240>');
        }, 1000);
      }, 1000);
    } 
    // 15 %
    else {
      setTimeout(() => {
        msg.edit('<:salute:1335591427031306342>');
        setTimeout(() => {
          msg.edit('<:salute:1335591427031306342> <a:slotty_gif:1336009659399802900>');
        }, 1000);
      }, 1000);
    }
  }
});

client.login(config.DISCORD_TOKEN);
