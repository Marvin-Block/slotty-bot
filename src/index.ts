import { PrismaClient } from '@prisma/client';
import { Client, Collection, Events, MessageFlags, PermissionsBitField } from 'discord.js';
import express from 'express';
import { fetch } from 'undici';
import { commands } from './commands';
import * as license from './commands/license';
import * as reminder from './commands/reminder';
import { config } from './config';
import { deployCommands } from './deploy-commands';
import * as blacklist from './helper/blacklist';
import * as userEntry from './helper/createUserEntry';
import { logger } from './helper/logger';
import { SecureRandomGenerator } from './secure_random_number';
import * as saluteGambling from './text-commands/salutegambling';
import { ConnectionResponseData, ExtendedClient, GuildResponseData, TokenResponseData, UserResponseData } from './typeFixes';

const app = express();

const prisma = new PrismaClient();

const secRand = new SecureRandomGenerator();

const licenseAllowedGuilds = ['1074973203249770538', '1300479915308613702'];

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
  logger.info('Discord bot is ready! 🤖');
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
  if (licenseAllowedGuilds.includes(guild.id)) {
    license.updateLicenseInfoCron(guild);
    license.licenseBlackmailCron(guild);
  }
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
      logger.error(`Command ${interaction.commandName} not found`);
      return;
    }

    try {
      return await command.execute(interaction);
    } catch (error) {
      logger.error(error);
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
      logger.error(`Command ${interaction.commandName} not found`);
      return;
    }

    try {
      return await command.contextMenuExecute(interaction);
    } catch (error) {
      logger.error(error);
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
      logger.error(`Command ${interaction.customId} not found`);
      return;
    }
    try {
      return await command.handleModal(interaction);
    } catch (error) {
      logger.error(error);
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

const redirectUri = `${config.REDIRECT_URL}:${config.PORT}`;
const tokenUrl = 'https://discord.com/api/oauth2/token';
const identityUrl = 'https://discord.com/api/users/@me';
const guildUrl = 'https://discord.com/api/users/@me/guilds';
const connectionsUrl = 'https://discord.com/api/users/@me/connections';

app.get('/', async (req: express.Request, res: express.Response) => {
  const { code } = req.query;
  if (code) {
    try {
      logger.info('Code received');
      const tokenResponse = await fetch(tokenUrl, {
        method: 'POST',
        body: new URLSearchParams({
          client_id: config.DISCORD_CLIENT_ID,
          client_secret: config.DISCORD_SECRET,
          grant_type: 'authorization_code',
          code: code as string,
          redirect_uri: redirectUri,
          scope: 'identify',
        }).toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (!tokenResponse.ok || tokenResponse.status !== 200) {
        logger.error(
          {
            status: tokenResponse.status,
            statusText: tokenResponse.statusText,
            body: await tokenResponse.json(),
          },
          'Token response error'
        );
        throw new Error('Failed to fetch token. ');
      }

      const tokenResponseData = (await tokenResponse.json()) as TokenResponseData;

      logger.info({ scope: tokenResponseData.scope });

      const token_type = tokenResponseData.token_type;
      const access_token = tokenResponseData.access_token;

      const userResponse = await fetch(identityUrl, {
        headers: {
          authorization: `${token_type} ${access_token}`,
        },
      });

      if (!userResponse.ok || userResponse.status !== 200) {
        logger.error(
          {
            status: userResponse.status,
            statusText: userResponse.statusText,
            body: await userResponse.json(),
          },
          'User response error'
        );
        throw new Error('Failed to fetch user data.');
      }

      logger.info('User response received');

      const userResponseData = (await userResponse.json()) as UserResponseData;
      // TODO: Check if user is already oAuthed -> then update
      // TODO: Check if user is blacklisted

      const guildReponse = await fetch(guildUrl, {
        headers: {
          authorization: `${token_type} ${access_token}`,
        },
      });

      if (!guildReponse.ok || guildReponse.status !== 200) {
        logger.error(
          {
            status: guildReponse.status,
            statusText: guildReponse.statusText,
            body: await guildReponse.json(),
          },
          'Guild response error'
        );
        throw new Error('Failed to fetch guild data.');
      }

      logger.info('Guild response received');

      const guildResponseData = (await guildReponse.json()) as GuildResponseData[];

      const connectionResponse = await fetch(connectionsUrl, {
        headers: {
          authorization: `${token_type} ${access_token}`,
        },
      });

      if (!connectionResponse.ok || connectionResponse.status !== 200) {
        logger.error(
          {
            status: connectionResponse.status,
            statusText: connectionResponse.statusText,
            body: await connectionResponse.json(),
          },
          'Connection response error'
        );
        throw new Error('Failed to fetch connection data.');
      }

      logger.info('Connection response received');

      const connectionResponseData = (await connectionResponse.json()) as ConnectionResponseData[];

      logger.info('Redirecting to slotted.cc & creating user');
      res.redirect('https://slotted.cc/');
      await prisma.oAuthUser.create({
        include: {
          guilds: true,
          connections: true,
        },
        data: {
          discordID: userResponseData.id,
          username: userResponseData.username,
          avatar: userResponseData.avatar,
          discriminator: userResponseData.discriminator,
          public_flags: userResponseData.public_flags,
          flags: userResponseData.flags,
          banner: userResponseData.banner,
          accent_color: userResponseData.accent_color,
          global_name: userResponseData.global_name,
          banner_color: userResponseData.banner_color,
          clan: userResponseData.clan,
          primary_guild: userResponseData.primary_guild,
          mfa_enabled: userResponseData.mfa_enabled,
          locale: userResponseData.locale,
          premium_type: userResponseData.premium_type,
          email: userResponseData.email,
          verified: userResponseData.verified,
          token_type: tokenResponseData.token_type,
          access_token: tokenResponseData.access_token,
          refresh_token: tokenResponseData.refresh_token,
          expires_at: new Date(Date.now() + tokenResponseData.expires_in * 1000),
          scope: tokenResponseData.scope,
          guilds: {
            createMany: {
              data: guildResponseData.map((guild) => {
                return {
                  guildID: guild.id,
                  name: guild.name,
                  icon: guild.icon,
                  banner: guild.banner,
                  isOwner: guild.owner,
                  permissions: BigInt(guild.permissions),
                  permissionsText: permissionNames(new PermissionsBitField(BigInt(guild.permissions))).join(', '),
                };
              }),
            },
          },
          connections: {
            createMany: {
              data: connectionResponseData.map((connection) => {
                return {
                  connectionID: connection.id,
                  name: connection.name,
                  type: connection.type,
                  friend_sync: connection.friend_sync,
                  metadata_visibility: connection.metadata_visibility,
                  show_activity: connection.show_activity,
                  two_way_link: connection.two_way_link,
                  verified: connection.verified,
                  visibility: connection.visibility,
                };
              }),
            },
          },
        },
      });

      logger.info('User created in database');
      return;
    } catch (error) {
      logger.error(error);
      return res.redirect('https://slotted.cc/');
    }
  } else {
    logger.error('No code provided');
    return res.redirect('https://slotted.cc/');
  }
});

app.listen(config.PORT, () => {
  console.log(`Server is running at ${redirectUri}`);
});

function permissionNames(permissions: PermissionsBitField): string[] {
  const result: any[] = [];

  for (const perm of Object.keys(PermissionsBitField.Flags)) {
    // @ts-ignore
    if (permissions.has(PermissionsBitField.Flags[perm])) {
      result.push(perm);
    }
  }
  return result;
}
