import { PrismaClient } from '@prisma/client';
import {
	CommandInteraction,
	EmbedBuilder,
	Guild,
	InteractionContextType,
	MessageFlags,
	PermissionFlagsBits,
	SlashCommandBuilder,
	time,
	TimestampStyles
} from 'discord.js';
import { fetchLicenseInfo } from '../helper/api';
import { diffDays, diffHours, diffText } from '../helper/dates';
import { getEmote } from '../helper/getEmote';
import { logger } from '../helper/logger';
import { FixedOptions, LicenseInfo } from '../typeFixes';

export const emoteGold = getEmote('<:slotted_gold:1349674918228394077>').fullString;
export const emoteAlert = getEmote('<a:alert:1365290359072100423>').fullString;
export const emoteWarng = getEmote('<a:warng:1365290361076977805>').fullString;

const prisma = new PrismaClient();
const reminderText = {
	expired: `-# ${emoteGold} LEAGUE OF LEGENDS INTERNAL
# Your license has expired ${emoteAlert}
-# To renew your license create a [purchase ticket](https://discord.com/channels/1300479915308613702/1330889242691502150/1330889548883820655).`,
	oneDay: `-# ${emoteGold} LEAGUE OF LEGENDS INTERNAL
# Your license expires in less than 24 hours ${emoteWarng} 
-# To renew your license create a [purchase ticket](https://discord.com/channels/1300479915308613702/1330889242691502150/1330889548883820655).`,
	threeDays: `-# ${emoteGold} LEAGUE OF LEGENDS INTERNAL:
# Your license expires in less than 3 days ⚠️ 
-# To renew your license create a [purchase ticket](https://discord.com/channels/1300479915308613702/1330889242691502150/1330889548883820655).`,
};
const cooldown = 1000 * 60 * 1; // 1 Minute cooldown
const cooldownCollection = new Map();
const keyReg = /^([A-Z]|\d){6}-([A-Z]|\d){6}-([A-Z]|\d){6}-([A-Z]|\d){6}$/;

export const type = 'slash';
export const name = 'license';
export const allowDM = true;
export const allowed_servers = ['1074973203249770538', '1300479915308613702'];

const roleId = '1341879803254411315';
const whitelistRoleId = '1354198468863856772';

export const data = new SlashCommandBuilder()
	.setName('license')
	.setDescription('Manage your licenses')
	.setContexts(InteractionContextType.Guild)
	.addSubcommand((subcommand) =>
		subcommand
			.setName('link')
			.setDescription('Links your slotted key to your discord account')
			.addStringOption((option) =>
				option.setName('key').setDescription('The key you want to link to your discord account').setRequired(true)
			)
	)
	.addSubcommand((subcommand) => subcommand.setName('list').setDescription('Lists all your linked keys'))
	.addSubcommand((subcommand) => subcommand.setName('info').setDescription('Shows information about your active key'));

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

async function linkLicense(interaction: CommandInteraction, options: FixedOptions) {
	try {
		logger.info(`Attempting to link license key to user ${interaction.user.id}`);
		if (cooldownCollection.has(interaction.user.id) && Date.now() < cooldownCollection.get(interaction.user.id)) {
			logger.info(`User is still under cooldown`);
			await prisma.$disconnect();
			return interaction.editReply(
				`You are still under cooldown, please try again later.\nCooldown will expire ${time(
					cooldownCollection.get(interaction.user.id),
					TimestampStyles.RelativeTime
				)}`
			);
		}

		cooldownCollection.set(interaction.user.id, new Date(new Date().getTime() + cooldown));

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

		if (license.dateActivated !== null && (license.daysLeft < 0 || license.daysValid < 0)) {
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
		}

		const dbKey = await prisma.key.findUnique({
			where: { key },
			include: { user: true },
		});

		if (dbKey && dbKey.user.discordID !== interaction.user.id) {
			logger.error(`${key} is already linked to another user`);
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
					upsert: {
						where: { key },
						update: {
							active: license.active,
							valid: license.valid,
							activationDate: new Date(license.dateActivated),
							expirationDate: licenseEndDate,
						},
						create: {
							key,
							active: license.active,
							valid: license.valid,
							activationDate: new Date(license.dateActivated),
							expirationDate: licenseEndDate,
						},
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
			logger.error(`Error linking license key ${key} to user ${interaction.user.id}`);
			await prisma.$disconnect();
			return interaction.editReply({
				content: 'There was an error trying to link the key to your account, please contact the support.',
			});
		}

		if (interaction.guild) {
			giveRole(interaction.guild, interaction.user.id);
		}

		await prisma.$disconnect();

		return interaction.editReply({
			content: `\`${key}\` is now linked to your account.\nYour license key will expire ${
				license.dateActivated === null
					? `${license.daysValid} Days after activation`
					: `in ${diffText(licenseEndDate, new Date())}`
			}.`,
		});
	} catch (e) {
		logger.error(e);
		await prisma.$disconnect();
		return interaction.editReply({
			content: 'An error occured, please contact the support.',
		});
	}
}

async function listLicenses(interaction: CommandInteraction) {
	try {
		logger.info(`Listing licenses for user ${interaction.user.id}`);
		const success = await updateLicenseInfo(interaction.guild!);
		if (!success) {
			logger.error('Error updating license info');
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
			logger.error('User not found');
			await prisma.$disconnect();
			return interaction.editReply({
				content: 'An error occurred, please contact the support.',
			});
		}

		if (user.keys.length < 1) {
			logger.error(`No licenses found for user ${interaction.user.id}`);
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
			license?: LicenseInfo;
		}[] = [];

		for (const key of keys) {
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

			updatedKeys.push({ ...newKey, license });
		}

		let embedDescription = '';
		updatedKeys.forEach((key) => {
			embedDescription += `**License #${key.id}**\n`;
			embedDescription += '├ Key: `' + key.key + '`\n';
			if (key.license) {
				embedDescription += `├ Expires${
					key.license.dateActivated === null
						? `: ${key.license.daysValid} Days after activation`
						: `in: ${diffText(key.expirationDate, new Date())}`
				}\n`;
				embedDescription += `├ Activation Time: ${
					key.license.dateActivated === null ? 'Never' : time(key.activationDate, TimestampStyles.ShortDateTime)
				}\n`;
			} else {
				embedDescription += `├ Expires in: ${diffText(key.expirationDate, new Date())}\n`;
				embedDescription += `├ Activation Time: ${time(key.activationDate, TimestampStyles.ShortDateTime)}\n`;
			}
			embedDescription += `└ Status: ${key.active ? '**Active**' : '**Inactive**'}\n\n`;
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
		logger.error(error);
		await prisma.$disconnect();
		return interaction.editReply({
			content: 'An error occured, please contact the support.',
		});
	}
}

async function getLicenseInfo(interaction: CommandInteraction) {
	try {
		logger.info(`License info for user ${interaction.user.id}`);
		const success = await updateLicenseInfo(interaction.guild!);
		if (!success) {
			logger.error('Error updating license info');
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
			logger.error('User not found');
			await prisma.$disconnect();
			return interaction.editReply({
				content: 'An error occured, please contact the support.',
			});
		}

		const useableKey = user.keys.find((key) => key.active && key.valid && key.expirationDate > new Date());

		if (!user.activeKey && !useableKey) {
			logger.error(`No active license found for user ${interaction.user.id}`);
			await prisma.$disconnect();
			return interaction.editReply({
				content: 'There is no active license linked to your account yet.',
			});
		} else if (!user.activeKey && useableKey) {
			logger.info(`User ${interaction.user.id} has a useable key but no active key`);
			await prisma.user.update({
				where: { discordID: interaction.user.id },
				data: { activeKey: useableKey.key },
			});
			logger.info(`User ${interaction.user.id} has been updated`);
			await giveRole(interaction.guild!, interaction.user.id);
			logger.info(` Role has been added to user ${interaction.user.id}`);
		}

		let activeKey = user.keys.find((key) => key.key === user.activeKey);

		if (useableKey && !activeKey) {
			activeKey = useableKey;
		}

		if (!activeKey) {
			logger.error(`No active license found for user ${interaction.user.id}`);
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
		embedDescription += '├ Key: `' + activeKey.key + '`\n';
		embedDescription += `├ Expires${
			newLicense.dateActivated === null
				? `: ${newLicense.daysValid} Days after activation`
				: `in: ${diffText(licenseEndDate, new Date())}`
		}\n`;
		embedDescription += `├ Activation Time: ${
			activeKey.activationDate.getTime() === new Date(0).getTime()
				? 'Never'
				: time(activeKey.activationDate, TimestampStyles.ShortDateTime)
		}\n`;
		embedDescription += `└ Status: ${activeKey.active ? '**Active**' : 'Inactive'}\n\n`;

		const embed = new EmbedBuilder()
			.setTitle('Slotted Key Manager')
			.setDescription(embedDescription)
			.setColor('#500de0');

		await prisma.$disconnect();
		return interaction.editReply({
			content: 'Here is your license info:',
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

export async function updateLicenseInfo(guild: Guild) {
  if (!guild) {
    logger.error('Guild not found');
    return false;
  }
  await guild.fetch();
  try {
    logger.info('Updating license info');
    const key = await prisma.key.findMany({
      where: {
        OR: [
          { active: true, valid: true },
          { active: true, valid: false },
          { active: false, valid: true },
          { active: false, valid: false },
        ],
      },
      include: { user: true },
    });
    if (key.length < 1) {
      logger.info('No updateable keys found');
      const users = await prisma.user.findMany({
        where: { activeKey: { not: null } },
      });
      if (users.length < 1) {
        logger.info('No users with invalid active keys found');
        await prisma.$disconnect();
        return true;
      } else {
        for (const u of users) {
          await prisma.user.update({
            where: { discordID: u.discordID },
            data: { activeKey: null },
          });
          logger.info(`User ${u.discordID} has been updated to remove the invalid active key`);
          await subtimeReminder(guild, u.discordID, reminderText.expired);
        }
      }
      await prisma.$disconnect();
      return true;
    }
    for (const k of key) {
      // update keys in 10 minutes intervals
      if (k.updatedAt > new Date(Date.now() - 1000 * 60 * 10)) {
        logger.info(`Key ${k.key} was updated recently, skipping`);
        continue;
      }

			const license = await fetchLicenseInfo(k.key);
			if (!license) {
				logger.error(`API error with ${k.key}`);
				continue;
			}

      const licenseEndDate = new Date(license.dateActivated);
      licenseEndDate.setDate(licenseEndDate.getDate() + license.daysValid);

      if (
        (license.dateActivated !== null && (license.daysLeft <= 0  || license.daysValid <= 0)) ||
        (license.daysLeft === 0 && license.daysValid === 0 && license.dateActivated === null) ||
        (!license.active && !license.valid && license.dateActivated === null && !license.daysLeft && !license.daysValid)
      ) {

      if (!license.active) {
        await prisma.key.update({
          where: { id: k.id },
          data: {
            active: license.active,
            valid: license.valid,
            activationDate: new Date(license.dateActivated),
            expirationDate: licenseEndDate,
          },
        });
        logger.info(`${k.key} is now inactive`);
        if (k.user.activeKey === k.key) {
          await prisma.user.update({
            where: { discordID: k.user.discordID },
            data: { activeKey: null },
          });
          logger.info(`${k.key} has been removed from user ${k.user.discordID} since it is no longer active`);
          await subtimeReminder(guild, k.user.discordID, reminderText.expired);
        }
        continue;
      }

      if (!license.valid) {
        await prisma.key.update({
          where: { id: k.id },
          data: {
            active: license.active,
            valid: license.valid,
            activationDate: new Date(license.dateActivated),
            expirationDate: licenseEndDate,
          },
        });
        logger.info(`${k.key} is now invalid`);
        if (k.user.activeKey === k.key) {
          await prisma.user.update({
            where: { discordID: k.user.discordID },
            data: { activeKey: null },
          });
          logger.info(`${k.key} has been removed from user ${k.user.discordID} since it is no longer valid`);
          await subtimeReminder(guild, k.user.discordID, reminderText.expired);
        }
        continue;
      }
}
      await prisma.key.update({
        where: { id: k.id },
        data: {
          active: license.active,
          valid: license.valid,
          activationDate: new Date(license.dateActivated),
          expirationDate: licenseEndDate,
        },
      });
      logger.info(`${k.key} has been updated`);
    }

		const users = await prisma.user.findMany({
			include: { keys: true },
		});

		for (const u of users) {
			const useableKey = u.keys.find((key) => key.active && key.valid && key.expirationDate > new Date());

			if (!u.activeKey && useableKey) {
				logger.info(`User ${u.discordID} has a useable key but no active key`);
				await prisma.user.update({
					where: { id: u.id },
					data: { activeKey: useableKey.key },
				});
				logger.info(`User ${u.discordID} has been updated`);
				await giveRole(guild, u.discordID);
				logger.info(`Role has been added to user ${u.discordID}`);
				continue;
			}

			const hasKey = u.keys.find((k) => k.key === u.activeKey);
			if (u.activeKey && !hasKey) {
				await prisma.user.update({
					where: { discordID: u.discordID },
					data: { activeKey: null },
				});
				logger.info(`User ${u.discordID} has been updated to remove the invalid active key`);
				await subtimeReminder(guild, u.discordID, reminderText.expired);
				continue;
			}
		}

		const usersWithActiveKeys = await prisma.user.findMany({
			include: { keys: true },
			where: {
				keys: {
					some: {
						active: true,
						valid: true,
						expirationDate: {
							gte: new Date(),
						},
					},
				},
			},
		});

		for (const user of usersWithActiveKeys) {
			const key = user.keys
				.filter((key) => {
					if (!key.active) return false;
					return true;
				})
				.at(0);
			if (!key) continue;

			const hoursSinceReminder = parseInt(diffHours(new Date(), user.lastSubtimeReminder).toFixed(1));
			const daysLeft = parseInt(diffDays(key.expirationDate, new Date()).toFixed(1));
			logger.info(`${hoursSinceReminder} hours since last reminder`);
			if (hoursSinceReminder < 18) continue;
			logger.info(`${daysLeft} days left`);

			const license = await fetchLicenseInfo(key.key);

			if (!license) {
				logger.error(`API error with ${key}`);
				continue;
			}

			if (license.dateActivated !== null && (license.daysLeft < 0 || license.daysValid < 0)) {
				if (daysLeft == 0) {
					logger.info(`User ${user.discordID} has less than a day on their key`);
					await subtimeReminder(guild, user.discordID, reminderText.oneDay);
				} else if (daysLeft == 2) {
					logger.info(`User ${user.discordID} has less than three days on their key`);
					await subtimeReminder(guild, user.discordID, reminderText.threeDays);
				}
			}
		}

		await prisma.$disconnect();
		logger.info('Licenses and Users updated');
		return true;
	} catch (error) {
		logger.error(error, 'Error updating license info');
		await prisma.$disconnect();
		return false;
	}
}

export async function giveRole(guild: Guild, userId: string) {
	const member = await guild.members.fetch(userId).catch(() => null);
	if (!member) {
		logger.error(`Member with ID ${userId} not found in guild ${guild.id}`);
		return false;
	}
	await member.user.fetch().catch(() => null);
	try {
		if (!member) {
			logger.error('Member not found');
			return false;
		}
		const role = guild.roles.cache.get(roleId);
		if (!role) {
			logger.error('Role not found');
			return false;
		}
		if (member.roles.cache.has(roleId)) {
			logger.error('User already has the role');
			return false;
		}
		await member.roles.add(role);
		logger.info('Role added to user');
		return true;
	} catch (error) {
		logger.error(error, 'Error adding role to user');
		return false;
	}
}

async function removeRole(guild: Guild, userId: string) {
	const member = await guild.members.fetch(userId).catch(() => null);
	if (!member) {
		logger.error(`Member with ID ${userId} not found in guild ${guild.id}`);
		return false;
	}
	await member.user.fetch().catch(() => null);
	try {
		if (!member) {
			logger.error('Member not found');
			return false;
		}
		const role = guild.roles.cache.get(roleId);
		if (!role) {
			logger.error('Role not found');
			return false;
		}
		if (!member.roles.cache.has(roleId)) {
			logger.info('User doesnt have the role');
			return false;
		}
		await member.roles.remove(role);
		logger.info(`Role removed from user ${userId} since the key is no longer active`);
		return true;
	} catch (error) {
		logger.error(error, 'Error removing role from user');
		return false;
	}
}

async function subtimeReminder(guild: Guild, userId: string, message: string) {
	try {
		const client = guild.client;
		const user = await client.users.fetch(userId).catch(() => null);

		if (!user) {
			logger.error('User not found');
			return;
		}

		const member = await guild.members.fetch(userId).catch(() => null);
		if (!member) {
			logger.error('Member not found');
			return;
		}

		if (member.permissions.has(PermissionFlagsBits.Administrator) || member.roles.cache.has(whitelistRoleId)) {
			logger.info('User is whitelisted, skipping reminder');
			return;
		}

		await removeRole(guild, userId);
		logger.info(`Role has been removed from user ${userId} since the key is no longer active`);

		const embed = new EmbedBuilder()
			.setTitle('Slotted Key Manager')
			.setDescription(message)
			.setColor('#500de0')
			.setFooter({ text: 'This is an automated message, please do not reply.' })
			.setTimestamp();

		await user
			.send({
				embeds: [embed],
			})
			.then(async () => {
				logger.info(`Reminder sent to user ${userId}`);
				await prisma.user.update({
					where: { discordID: userId },
					data: { lastSubtimeReminder: new Date() },
				});
				logger.info(`User ${userId} last reminder updated`);
				await prisma.$disconnect();
			})
			.catch(async (error) => {
				logger.error(error, 'Error sending reminder');
				await prisma.$disconnect();
			});
	} catch (error) {
		logger.error(error, 'Error sending reminder');
	}
	return;
}

async function blackmailRoutine(guild: Guild) {
	if (!guild) {
		logger.error('Guild not found');
		return false;
	}
	await guild.fetch();

	try {
		logger.info('Blackmail routine started');

		const users = await prisma.user.findMany({
			where: {
				activeKey: null,
			},
		});

		for (const u of users) {
			const hoursSinceReminder = parseInt(diffHours(new Date(), u.lastSubtimeReminder).toFixed(1));
			logger.info(`${hoursSinceReminder} hours since last reminder`);
			if (hoursSinceReminder < 12) continue;
		}

		await prisma.$disconnect();
		logger.info('Licenses and Users updated');
		return true;
	} catch (error) {
		logger.error(error, 'Error updating license info');
		await prisma.$disconnect();
		return false;
	}
}

export async function updateLicenseInfoCron(guild: Guild) {
	await guild.fetch();
	await updateLicenseInfo(guild);
	// check every 30 minutes
	const interval = 1000 * 60 * 5;
	const msToNextRoundedMinute = interval - (Date.now() % interval);
	setTimeout(() => {
		updateLicenseInfoCron(guild);
	}, msToNextRoundedMinute);
	logger.info('Next license update in ' + msToNextRoundedMinute / 1000 + ' seconds');
}

export async function licenseBlackmailCron(guild: Guild) {
	await guild.fetch();
	await blackmailRoutine(guild);
	// check every 30 minutes
	const interval = 1000 * 60 * 5;
	const msToNextRoundedMinute = interval - (Date.now() % interval);
	setTimeout(() => {
		licenseBlackmailCron(guild);
	}, msToNextRoundedMinute);
	logger.info('Next blackmail routine in ' + msToNextRoundedMinute / 1000 + ' seconds');
}
