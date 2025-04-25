import { PrismaClient } from '@prisma/client';
import { CommandInteraction, EmbedBuilder, InteractionContextType, MessageFlags, SlashCommandBuilder, time, TimestampStyles, userMention } from 'discord.js';
import { fetchLicenseInfo } from '../helper/api';
import { diffText } from '../helper/dates';
import { logger } from '../helper/logger';
import { FixedOptions } from '../typeFixes';
import { giveRole, updateLicenseInfo } from './license';

const prisma = new PrismaClient();

const keyReg = /^([A-Z]|\d){6}-([A-Z]|\d){6}-([A-Z]|\d){6}-([A-Z]|\d){6}$/;

export const type = 'slash';
export const name = 'admin';
export const allowed_servers = ['1074973203249770538', '1300479915308613702'];
export const whitelisted_users = [
  '834847858439618620', // rsn
  '846185075372720158', // sx
  '322659763643088897', // muffin
  '1145617537711734844', // zeri

  '495280024891424769', // clouq
  '704032133106237551', // erytrea
  '854527909385338940', // sim
];

export const data = new SlashCommandBuilder()
  .setName('admin')
  .setDescription('Admin license commands')
  .setContexts(InteractionContextType.Guild)
  .setDefaultMemberPermissions(0)
  .addSubcommand((subcommand) =>
    subcommand
      .setName('link')
      .setDescription('Link a slotted key to a discord account')
      .addStringOption((option) => option.setName('key').setDescription('The key you want to link').setRequired(true))
      .addUserOption((option) => option.setName('user').setDescription('The user you want to link the key to').setRequired(true))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('list')
      .setDescription('Lists all linked keys of the specified user')
      .addUserOption((option) => option.setName('user').setDescription('The user you want to list the keys of').setRequired(true))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('info')
      .setDescription('Shows information about a selected users active key')
      .addUserOption((option) => option.setName('user').setDescription('The user you want to get the info of').setRequired(true))
  );

export async function execute(interaction: CommandInteraction) {
  if (!whitelisted_users.includes(interaction.user.id)) return;

  const options = interaction.options as FixedOptions;
  const subcommand = options.getSubcommand();
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  switch (subcommand) {
    case 'link':
      logger.info(`Admin link called by ${interaction.user.id}`);
      await linkLicense(interaction, options);
      break;
    case 'list':
      logger.info(`Admin list called by ${interaction.user.id}`);
      await listLicenses(interaction, options);
      break;
    case 'info':
      logger.info(`Admin info called by ${interaction.user.id}`);
      await getLicenseInfo(interaction, options);
      break;
  }
}

async function linkLicense(interaction: CommandInteraction, options: FixedOptions) {
  try {
    const optionUser = options.getUser('user');

    if (!optionUser) {
      logger.error('Interaction option user not found');
      await prisma.$disconnect();
      return interaction.editReply({
        content: 'An error occurred, please contact the support.',
      });
    }

    logger.info(`Attempting to link license key to user ${optionUser.id}`);

    const key = options.getString('key');
    if (!key) {
      logger.error('Interaction option key not found');
      await prisma.$disconnect();
      return interaction.editReply({
        content: 'An error occurred, please contact the support.',
      });
    }
    if (!keyReg.test(key)) {
      logger.error(`Invalid key format ${key}`);
      await prisma.$disconnect();
      return interaction.editReply({
        content: 'The key you provided is not valid.',
      });
    }
    logger.info(`Linking license key ${key}`);
    const license = await fetchLicenseInfo(key);

    if (!license) {
      logger.error(`API error with ${key}`);
      await prisma.$disconnect();
      return interaction.editReply({
        content: 'An error occured, please contact the support.',
      });
    }

    if (!license.active) {
      await prisma.$disconnect();
      logger.error(`${key} is no longer active`);
      return interaction.editReply({
        content: 'The key you provided is no longer active.',
      });
    }

    if (!license.valid) {
      logger.error(`${key} is no longer valid`);
      await prisma.$disconnect();
      return interaction.editReply({
        content: 'The key you provided is no longer valid.',
      });
    }

    const dbKey = await prisma.key.findUnique({
      where: { key },
    });

    if (dbKey) {
      logger.error(`${key} is already linked to another user`);
      await prisma.$disconnect();
      return interaction.editReply({
        content: 'The key you provided is already linked to another user.',
      });
    }

    const licenseEndDate = new Date(license.dateActivated);
    licenseEndDate.setDate(licenseEndDate.getDate() + license.daysValid);

    const updatedUser = await prisma.user.upsert({
      where: { discordID: optionUser.id },
      update: {
        activeKey: key,
        keys: {
          create: {
            key,
            active: license.active,
            valid: license.valid,
            activationDate: new Date(license.dateActivated),
            expirationDate: licenseEndDate,
          },
        },
      },
      create: {
        discordID: optionUser.id,
        activeKey: key,
        wallet: {
          create: {
            balance: 0,
          },
        },
        keys: {
          create: {
            key,
            active: license.active,
            valid: license.valid,
            activationDate: new Date(license.dateActivated),
            expirationDate: licenseEndDate,
          },
        },
      },
    });

    if (!updatedUser) {
      logger.error(`Error linking license key ${key} to user ${userMention(optionUser.id)}`);
      await prisma.$disconnect();
      return interaction.editReply({
        content: 'There was an error trying to link the key, please contact the support.',
      });
    }

    if (interaction.guild) {
      giveRole(interaction.guild, optionUser.id);
    }

    await prisma.$disconnect();

    return interaction.editReply({
      content: `\`${key}\` is now linked to ${userMention(optionUser.id)}.\nThe license key will expire in ${diffText(licenseEndDate, new Date())}.`,
    });
  } catch (e) {
    logger.error(e);
    await prisma.$disconnect();
    return interaction.editReply({
      content: 'An error occured, please contact the support.',
    });
  }
}

async function listLicenses(interaction: CommandInteraction, options: FixedOptions) {
  try {
    const optionUser = options.getUser('user');
    if (!optionUser) {
      logger.error('Interaction option key not found');
      await prisma.$disconnect();
      return interaction.editReply({
        content: 'An error occurred, please contact the support.',
      });
    }

    logger.info(`Listing licenses for user ${optionUser.id}`);

    const success = await updateLicenseInfo(interaction.guild!);
    if (!success) {
      logger.error('Error updating license info');
      await prisma.$disconnect();
      return interaction.editReply({
        content: 'An error occured, please contact the support.',
      });
    }

    const user = await prisma.user.findUnique({
      where: { discordID: optionUser.id },
      include: { keys: true },
    });

    if (!user) {
      logger.error('User not found');
      await prisma.$disconnect();
      return interaction.editReply({
        content: 'An error occurred, please contact the support.',
      });
    }

    if (user.keys.length < 1) {
      logger.error(`No licenses found for user ${optionUser.id}`);
      await prisma.$disconnect();
      return interaction.editReply({
        content: 'There are no licenses linked to your account yet.',
      });
    }

    const keys = user.keys.slice(0, Math.min(2, 5));

    let updatedKeys: {
      createdAt: Date;
      id: number;
      updatedAt: Date;
      key: string;
      userID: number;
      active: boolean;
      valid: boolean;
      activationDate: Date;
      expirationDate: Date;
    }[] = [];

    for (const key of keys) {
      if (key.updatedAt > new Date(Date.now() - 1000 * 60 * 10)) {
        logger.debug(`last update ${key.updatedAt.toISOString()}, ${new Date(Date.now() - 1000 * 60 * 5).toISOString()}`);
        logger.info(`Key ${key.key} was updated recently, skipping`);
        updatedKeys.push(key);
        continue;
      }
      const license = await fetchLicenseInfo(key.key);
      if (!license) {
        logger.error(`API error with ${key.key}`);
        updatedKeys.push(key);
        continue;
      }

      const licenseEndDate = new Date(license.dateActivated);
      licenseEndDate.setDate(licenseEndDate.getDate() + license.daysValid);

      const newKey = await prisma.key.update({
        where: { id: key.id },
        data: {
          active: license.active,
          valid: license.valid,
          activationDate: new Date(license.dateActivated),
          expirationDate: licenseEndDate,
        },
      });

      logger.info(`${key.key} has been updated`);

      updatedKeys.push(newKey);
    }

    let embedDescription = '';
    updatedKeys.forEach((key) => {
      embedDescription += `**License #${key.id}**\n`;
      embedDescription += '├ Key: `' + key.key + '`\n';
      embedDescription += `├ Expires in: ${diffText(key.expirationDate, new Date())}\n`;
      embedDescription += `├ Activation Time: ${time(key.activationDate, TimestampStyles.ShortDateTime)}\n`;
      embedDescription += `└ Status: ${key.active ? '**Active**' : '**Inactive**'}\n\n`;
    });

    const embed = new EmbedBuilder()
      .setTitle('Slotted Key Manager')
      .setDescription(embedDescription)
      .setThumbnail(optionUser.displayAvatarURL({ forceStatic: false }))
      .setFooter({ text: `Requested by ${interaction.user.displayName}`, iconURL: interaction.user.displayAvatarURL({ forceStatic: false }) })
      .setTimestamp()
      .setColor('#500de0');

    await prisma.$disconnect();
    return interaction.editReply({
      embeds: [embed],
    });
  } catch (error) {
    logger.error(error);
    await prisma.$disconnect();
    return interaction.editReply({
      content: 'An error occured, please contact the support.',
    });
  }
}

async function getLicenseInfo(interaction: CommandInteraction, options: FixedOptions) {
  try {
    const optionUser = options.getUser('user');
    if (!optionUser) {
      logger.error('Interaction option key not found');
      await prisma.$disconnect();
      return interaction.editReply({
        content: 'An error occurred, please contact the support.',
      });
    }

    logger.info(`License info for user ${optionUser.id}`);

    const success = await updateLicenseInfo(interaction.guild!);
    if (!success) {
      logger.error('Error updating license info');
      await prisma.$disconnect();
      return interaction.editReply({
        content: 'An error occured, please contact the support.',
      });
    }

    const user = await prisma.user.findUnique({
      where: { discordID: optionUser.id },
      include: { keys: true },
    });

    if (!user) {
      logger.error('User not found');
      await prisma.$disconnect();
      return interaction.editReply({
        content: 'An error occured, please contact the support.',
      });
    }

    const useableKey = user.keys.find((key) => key.active && key.valid && key.expirationDate > new Date());

    if (!user.activeKey && !useableKey) {
      logger.error(`No active license found for user ${optionUser.id}`);
      await prisma.$disconnect();
      return interaction.editReply({
        content: 'There is no active license linked to your account yet.',
      });
    } else if (!user.activeKey && useableKey) {
      logger.info(`User ${optionUser.id} has a useable key but no active key`);
      await prisma.user.update({
        where: { discordID: optionUser.id },
        data: { activeKey: useableKey.key },
      });
      logger.info(`User ${optionUser.id} has been updated`);
      await giveRole(interaction.guild!, optionUser.id);
      logger.info(` Role has been added to user ${optionUser.id}`);
    }

    let activeKey = user.keys.find((key) => key.key === user.activeKey);

    if (useableKey && !activeKey) {
      activeKey = useableKey;
    }

    if (!activeKey) {
      logger.error(`No active license found for user ${optionUser.id}`);
      await prisma.$disconnect();
      return interaction.editReply({
        content: 'There is no active license linked to your account yet.',
      });
    }

    const newLicense = await fetchLicenseInfo(activeKey.key);
    if (!newLicense) {
      logger.error(`API error with ${activeKey.key}`);
      await prisma.$disconnect();
      return interaction.editReply({
        content: 'An error occured, please contact the support.',
      });
    }
    const licenseEndDate = new Date(newLicense.dateActivated);
    licenseEndDate.setDate(licenseEndDate.getDate() + newLicense.daysValid);

    await prisma.key.update({
      where: { id: activeKey.id },
      data: {
        active: newLicense.active,
        valid: newLicense.valid,
        activationDate: new Date(newLicense.dateActivated),
        expirationDate: licenseEndDate,
      },
    });
    logger.info(`${activeKey.key} has been updated`);

    let embedDescription = '';
    embedDescription += `**License #${activeKey.id}**\n`;
    embedDescription += '├ User: ' + optionUser.displayName + '\n';
    embedDescription += '├ Key: `' + activeKey.key + '`\n';
    embedDescription += `├ Expires in: ${diffText(licenseEndDate, new Date())}\n`;
    embedDescription += `├ Activation Time: ${time(activeKey.activationDate, TimestampStyles.ShortDateTime)}\n`;
    embedDescription += `└ Status: ${activeKey.active ? '**Active**' : 'Inactive'}\n\n`;

    const embed = new EmbedBuilder()
      .setTitle('Slotted Key Manager')
      .setDescription(embedDescription)
      .setThumbnail(optionUser.displayAvatarURL({ forceStatic: false }))
      .setFooter({ text: `Requested by ${interaction.user.displayName}`, iconURL: interaction.user.displayAvatarURL({ forceStatic: false }) })
      .setTimestamp()
      .setColor('#500de0');

    await prisma.$disconnect();
    return interaction.editReply({
      content: 'Here is the requested license info:',
      embeds: [embed],
    });
  } catch (error) {
    logger.error(error, 'Error getting license info');
    await prisma.$disconnect();
    return interaction.editReply({
      content: 'An error occured, please contact the support.',
    });
  }
}
