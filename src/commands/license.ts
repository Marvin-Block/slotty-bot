import { PrismaClient } from '@prisma/client';
import {
  CommandInteraction,
  EmbedBuilder,
  Guild,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
  time,
  TimestampStyles,
} from 'discord.js';
import { fetchLicenseInfo } from '../helper/api';
import { diffText } from '../helper/dates';
import { FixedOptions } from '../typeFixes';

const prisma = new PrismaClient();

export const type = 'slash';
export const name = 'license';
export const allowed_servers = ['1074973203249770538', '1300479915308613702'];

const roleId = '1351479711368220774';

export const data = new SlashCommandBuilder()
  .setName('license')
  .setDescription('Manage your licenses')
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((subcommand) =>
    subcommand
      .setName('link')
      .setDescription('Links your slotted key to your discord account')
      .addStringOption((option) =>
        option
          .setName('key')
          .setDescription('The key you want to link to your discord account')
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand.setName('list').setDescription('Lists all your linked keys')
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('info')
      .setDescription('Shows information about your active key')
  );

export async function execute(interaction: CommandInteraction) {
  const options = interaction.options as FixedOptions;
  const subcommand = options.getSubcommand();
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  switch (subcommand) {
    case 'link':
      await linkLicense(interaction, options);
      break;
    case 'list':
      await listLicenses(interaction);
      break;
    case 'info':
      await getLicenseInfo(interaction);
      break;
  }
}

async function linkLicense(
  interaction: CommandInteraction,
  options: FixedOptions
) {
  try {
    const key = options.getString('key');
    if (!key) {
      console.error('Interaction option key not found');
      await prisma.$disconnect();
      return interaction.editReply({
        content: 'An error occurred, please contact the support.',
      });
    }
    console.log(`Linking license key ${key} to user ${interaction.user.id}`);

    const license = await fetchLicenseInfo(key);

    if (!license) {
      console.error('API error with %s', key);
      await prisma.$disconnect();
      return interaction.editReply({
        content: 'An error occured, please contact the support.',
      });
    }

    if (!license.active) {
      await prisma.$disconnect();
      console.error('%s is no longer active', key);
      return interaction.editReply({
        content: 'The key you provided is no longer active.',
      });
    }

    if (!license.valid) {
      console.error('%s is no longer valid', key);
      await prisma.$disconnect();
      return interaction.editReply({
        content: 'The key you provided is no longer valid.',
      });
    }

    const dbKey = await prisma.key.findUnique({
      where: { key },
    });

    if (dbKey) {
      console.error('%s is already linked to another user', key);
      await prisma.$disconnect();
      return interaction.editReply({
        content: 'The key you provided is already linked to another user.',
      });
    }

    const licenseEndDate = new Date(license.dateActivated);
    licenseEndDate.setDate(licenseEndDate.getDate() + license.daysValid);

    const updatedUser = await prisma.user.upsert({
      where: { discordID: interaction.user.id },
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
        discordID: interaction.user.id,
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
      console.error(
        'Error linking license key %s to user %s',
        key,
        interaction.user.id
      );
      await prisma.$disconnect();
      return interaction.editReply({
        content:
          'There was an error trying to link the key to your account, please contact the support.',
      });
    }

    if (interaction.guild) {
      giveRole(interaction.guild, interaction.user.id);
    }

    await prisma.$disconnect();

    return interaction.editReply({
      content: `\`${key}\` is now linked to your account.\nYour remaining sub time is ${diffText(
        licenseEndDate,
        new Date()
      )}.`,
    });
  } catch (e) {
    console.error(e);
    await prisma.$disconnect();
    return interaction.editReply({
      content: 'An error occured, please contact the support.',
    });
  }
}

async function listLicenses(interaction: CommandInteraction) {
  try {
    console.log(`Listing licenses for user ${interaction.user.id}`);
    const success = await updateLicenseInfo(interaction.guild!);
    if (!success) {
      console.error('Error updating license info');
      await prisma.$disconnect();
      return interaction.editReply({
        content: 'An error occured, please contact the support.',
      });
    }

    const user = await prisma.user.findUnique({
      where: { discordID: interaction.user.id },
      include: { keys: true },
    });

    if (!user) {
      console.error('User not found');
      await prisma.$disconnect();
      return interaction.editReply({
        content: 'An error occurred, please contact the support.',
      });
    }

    if (user.keys.length < 1) {
      console.error('No licenses found for user %s', interaction.user.id);
      await prisma.$disconnect();
      return interaction.editReply({
        content: 'There are no licenses linked to your account yet.',
      });
    }

    const keys = user.keys.slice(0, Math.min(2, 5));

    let embedDescription = '';
    keys.forEach((key) => {
      embedDescription += `**License #${key.id}**\n`;
      embedDescription += '├ Key: `' + key.key + '`\n';
      embedDescription += `├ Expires in: ${diffText(
        key.expirationDate,
        new Date()
      )}\n`;
      embedDescription += `├ Activation Time: ${time(
        key.activationDate,
        TimestampStyles.ShortDateTime
      )}\n`;
      embedDescription += `└ Status: ${
        key.active ? '**Active**' : '**Inactive**'
      }\n\n`;
    });

    const embed = new EmbedBuilder()
      .setTitle('Slotted Key Manager')
      .setDescription(embedDescription)
      .setColor('#500de0');

    await prisma.$disconnect();
    return interaction.editReply({
      embeds: [embed],
    });
  } catch (error) {
    console.error(error);
    await prisma.$disconnect();
    return interaction.editReply({
      content: 'An error occured, please contact the support.',
    });
  }
}

async function getLicenseInfo(interaction: CommandInteraction) {
  try {
    console.log(`License info for user ${interaction.user.id}`);
    const success = await updateLicenseInfo(interaction.guild!);
    if (!success) {
      console.error('Error updating license info');
      await prisma.$disconnect();
      return interaction.editReply({
        content: 'An error occured, please contact the support.',
      });
    }

    const user = await prisma.user.findUnique({
      where: { discordID: interaction.user.id },
      include: { keys: true },
    });

    if (!user) {
      console.error('User not found');
      await prisma.$disconnect();
      return interaction.editReply({
        content: 'An error occured, please contact the support.',
      });
    }

    const useableKey = user.keys.find(
      (key) => key.active && key.valid && key.expirationDate > new Date()
    );

    if (!user.activeKey && !useableKey) {
      console.error('No active license found for user %s', interaction.user.id);
      await prisma.$disconnect();
      return interaction.editReply({
        content: 'There is no active license linked to your account yet.',
      });
    } else if (!user.activeKey && useableKey) {
      console.log(
        'User %s has a useable key but no active key',
        interaction.user.id
      );
      await prisma.user.update({
        where: { discordID: interaction.user.id },
        data: { activeKey: useableKey.key },
      });
      console.log('User %s has been updated', interaction.user.id);
    }

    let activeKey = user.keys.find((key) => key.key === user.activeKey);

    if (useableKey && !activeKey) {
      activeKey = useableKey;
    }

    if (!activeKey) {
      console.error('No active license found for user %s', interaction.user.id);
      await prisma.$disconnect();
      return interaction.editReply({
        content: 'There is no active license linked to your account yet.',
      });
    }

    let embedDescription = '';
    embedDescription += `**License #${activeKey.id}**\n`;
    embedDescription += '├ Key: `' + activeKey.key + '`\n';
    embedDescription += `├ Expires in: ${diffText(
      activeKey.expirationDate,
      new Date()
    )}\n`;
    embedDescription += `├ Activation Time: ${time(
      activeKey.activationDate,
      TimestampStyles.ShortDateTime
    )}\n`;
    embedDescription += `└ Status: ${
      activeKey.active ? '**Active**' : 'Inactive'
    }\n\n`;

    const embed = new EmbedBuilder()
      .setTitle('Slotted Key Manager')
      .setDescription(embedDescription)
      .setColor('#500de0');

    await prisma.$disconnect();
    return interaction.editReply({
      embeds: [embed],
    });
  } catch (error) {
    console.error(error);
    await prisma.$disconnect();
    return interaction.editReply({
      content: 'An error occured, please contact the support.',
    });
  }
}

async function updateLicenseInfo(guild: Guild) {
  if (!guild) {
    console.error('Guild not found');
    return false;
  }
  await guild.fetch();
  try {
    console.log('Updating license info');
    const key = await prisma.key.findMany({
      where: { active: true, valid: true, expirationDate: { gte: new Date() } },
      include: { user: true },
    });
    if (key.length < 1) {
      console.log('No updateable keys found');
      const users = await prisma.user.findMany({
        where: { activeKey: { not: null } },
      });
      if (users.length < 1) {
        console.log('No users with invalid active keys found');
        await prisma.$disconnect();
        return true;
      } else {
        for (const u of users) {
          await prisma.user.update({
            where: { discordID: u.discordID },
            data: { activeKey: null },
          });
          console.log(
            `User ${u.discordID} has been updated to remove the invalid active key`
          );
          await removeRole(guild, u.discordID);
          console.log(
            `Role hase been removed since the key is no longer active`
          );
        }
      }
      await prisma.$disconnect();
      return true;
    }
    for (const k of key) {
      const license = await fetchLicenseInfo(k.key);
      if (license === null) {
        console.log(`${k.key} is not a valid key`);
        continue;
      }

      if (!license.active) {
        await prisma.key.update({
          where: { id: k.id },
          data: { active: false },
        });
        console.log(`${k.key} is now inactive`);
        if (k.user.activeKey === k.key) {
          await prisma.user.update({
            where: { discordID: k.user.discordID },
            data: { activeKey: null },
          });
          console.log(
            `${k.key} has been removed from user ${k.user.discordID} since it is no longer active`
          );
          await removeRole(guild, k.user.discordID);
          console.log(
            `Role hase been removed since the key is no longer active`
          );
        }
        continue;
      }

      if (!license.valid) {
        await prisma.key.update({
          where: { id: k.id },
          data: { valid: false },
        });
        console.log(`${k.key} is now invalid`);
        if (k.user.activeKey === k.key) {
          await prisma.user.update({
            where: { discordID: k.user.discordID },
            data: { activeKey: null },
          });
          console.log(
            `${k.key} has been removed from user ${k.user.discordID} since it is no longer valid`
          );
          await removeRole(guild, k.user.discordID);
          console.log(
            `Role hase been removed since the key is no longer active`
          );
        }
        continue;
      }

      const licenseEndDate = new Date(license.dateActivated);
      licenseEndDate.setDate(licenseEndDate.getDate() + license.daysValid);
      await prisma.key.update({
        where: { id: k.id },
        data: {
          active: license.active,
          valid: license.valid,
          activationDate: new Date(license.dateActivated),
          expirationDate: licenseEndDate,
        },
      });
      console.log(`${k.key} has been updated`);
    }

    const users = await prisma.user.findMany({
      where: { activeKey: { not: null } },
    });

    if (users.length < 1) {
      console.log('No users with invalid active keys found');
      await prisma.$disconnect();
      return true;
    } else {
      for (const u of users) {
        await prisma.user.update({
          where: { discordID: u.discordID },
          data: { activeKey: null },
        });
        console.log(
          `User ${u.discordID} has been updated to remove the invalid active key`
        );
        await removeRole(guild, u.discordID);
        console.log(`Role hase been removed since the key is no longer active`);
      }
    }

    await prisma.$disconnect();
    console.log('Licenses and Users updated');
    return true;
  } catch (error) {
    console.error(error);
    await prisma.$disconnect();
    return false;
  }
}

async function giveRole(guild: Guild, userId: string) {
  const member = await guild.members.fetch(userId);
  await member?.user.fetch();
  if (!member) {
    console.error('Member not found');
    return false;
  }
  const role = guild.roles.cache.get(roleId);
  if (!role) {
    console.error('Role not found');
    return false;
  }
  if (member.roles.cache.has(roleId)) {
    console.log('User already has the role');
    return false;
  }
  await member.roles.add(role);
  console.log('Role added to user');
  return true;
}

async function removeRole(guild: Guild, userId: string) {
  const member = await guild.members.fetch(userId);
  await member?.user.fetch();
  if (!member) {
    console.error('Member not found');
    return false;
  }
  const role = guild.roles.cache.get(roleId);
  if (!role) {
    console.error('Role not found');
    return false;
  }
  if (!member.roles.cache.has(roleId)) {
    console.log('User doesnt have the role');
    return false;
  }
  await member.roles.remove(role);
  console.log('Role removed from user');
  return true;
}

export async function updateLicenseInfoCron(guild: Guild) {
  await guild.fetch();
  updateLicenseInfo(guild);
  // check every 30 minutes
  const interval = 30 * 60 * 1000;
  const msToNextRoundedMinute = interval - (Date.now() % interval);
  setTimeout(() => {
    updateLicenseInfoCron(guild);
  }, msToNextRoundedMinute);
  console.log('Next update in ' + msToNextRoundedMinute / 1000 + ' seconds');
}
