import {
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  TextChannel,
} from "discord.js";
import { commands } from "./commands";
import { config } from "./config";
import { deployCommands } from "./deploy-commands";
import * as blacklist from "./helper/blacklist";
import { SecureRandomGenerator } from "./secure_random_number";
import * as saluteGambling from "./text-commands/salutegambling";

const secRand = new SecureRandomGenerator();

const client = new Client({
  intents: [
    "GuildMessageReactions",
    "Guilds",
    "GuildMessages",
    "GuildModeration",
    "GuildExpressions",
    "GuildPresences",
    "GuildMessages",
    "DirectMessages",
    "MessageContent",
    "GuildMembers",
  ],
});

client.once(Events.ClientReady, async () => {
  console.log("Discord bot is ready! 🤖");
  secRand.generateCommitment();
});

client.on(Events.GuildCreate, async (guild) => {
  await deployCommands({ guildId: guild.id });
});

client.on(Events.GuildAvailable, async (guild) => {
  await deployCommands({ guildId: guild.id });
  blacklist.checkUsers(guild);
});

client.on(Events.GuildMemberAdd, async (member) => {
  blacklist.run(member);
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

  if (interaction.customId === "echoModal") {
    const channelid = interaction.fields.getTextInputValue("channelid");
    const messageid = interaction.fields.getTextInputValue("messageid");
    const messageInput = interaction.fields.getTextInputValue("messageInput");
    if (messageInput.length > 2000) {
      return interaction.reply(
        "Message is too long, please keep it under 2000 characters"
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
            content: "Message not found",
            flags: MessageFlags.Ephemeral,
          });

        return message.edit(messageInput);
      }
    } catch (e) {
      console.log(e);
      return interaction.reply({
        content: "An error occurred",
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
