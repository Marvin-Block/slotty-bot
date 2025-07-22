import { PrismaClient } from '@prisma/client';
import {
	CommandInteraction,
	EmbedBuilder,
	InteractionContextType,
	MessageFlags,
	SlashCommandBuilder,
	time,
	TimestampStyles,
	userMention,
} from 'discord.js';
import { fetchLicenseInfo } from '../helper/api';
import { diffText } from '../helper/dates';
import { logger } from '../helper/logger';
import { FixedOptions, LicenseInfo } from '../typeFixes';
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
			.addUserOption((option) =>
				option.setName('user').setDescription('The user you want to link the key to').setRequired(true)
			)
	)
	.addSubcommand((subcommand) =>
		subcommand
			.setName('unlink')
			.setDescription('Unlink a slotted key from a discord account')
			.addStringOption((option) => option.setName('key').setDescription('The key you want to unlink').setRequired(true))
	)
	.addSubcommand((subcommand) =>
		subcommand
			.setName('list')
			.setDescription('Lists all linked keys of the specified user')
			.addUserOption((option) =>
				option.setName('user').setDescription('The user you want to list the keys of').setRequired(true)
			)
	)
	.addSubcommandGroup((group) =>
		group
			.setName('info')
			.setDescription('Get information about a users active key')
			.addSubcommand((subcommand) =>
				subcommand
					.setName('key')
					.setDescription('Shows information about the active key of a selected user')
					.addStringOption((option) =>
						option.setName('key').setDescription('The key you want to get the info of').setRequired(true)
					)
			)
			.addSubcommand((subcommand) =>
				subcommand
					.setName('user')
					.setDescription('Shows information about the active key of a selected user')
					.addUserOption((option) =>
						option.setName('user').setDescription('The user you want to get the info of').setRequired(true)
					)
			)
	);

export async function execute(interaction: CommandInteraction) {
	if (!whitelisted_users.includes(interaction.user.id)) return;

	const options = interaction.options as FixedOptions;
	const subcommand = options.getSubcommand();
	const subcommandGroup = options.getSubcommandGroup();
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	switch (subcommand) {
		case 'link':
			logger.info(`Admin link called by ${interaction.user.id}`);
			await linkLicense(interaction, options);
			break;
		case 'unlink':
			logger.info(`Admin unlink called by ${interaction.user.id}`);
			await unlinkLicense(interaction, options);
			break;
		case 'list':
			logger.info(`Admin list called by ${interaction.user.id}`);
			await listLicenses(interaction, options);
			break;
		default:
			if (subcommandGroup === 'info') {
				if (subcommand === 'user') {
					logger.info(`Admin info user called by ${interaction.user.id}`);
					await getInfoByUser(interaction, options);
					break;
				} else if (subcommand === 'key') {
					logger.info(`Admin info key called by ${interaction.user.id}`);
					await getInfoByKey(interaction, options);
					break;
				} else {
					logger.error(`Unknown subcommand ${subcommand} called by ${interaction.user.id}`);
					interaction.editReply({
						content: 'An error occurred, please contact the support.',
					});
				}
			} else {
				logger.error(`Unknown subcommandGroup ${subcommandGroup} called by ${interaction.user.id}`);
				interaction.editReply({
					content: 'An error occurred, please contact the support.',
				});
			}
			break;
	}
	return;
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

		console.log(license);

		if (
			(license.dateActivated !== null && (license.daysLeft <= 0 || license.daysValid <= 0)) ||
			(license.daysLeft === 0 && license.daysValid === 0 && license.dateActivated === null)||
			(!license.active && !license.valid && license.dateActivated === null && !license.daysLeft && !license.daysValid)
		) {
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

		if (dbKey && dbKey.user.discordID !== optionUser.id) {
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
			content: `\`${key}\` is now linked to ${userMention(optionUser.id)}.\nThe license key will expire ${
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

async function unlinkLicense(interaction: CommandInteraction, options: FixedOptions) {
	try {
		
		const key = options.getString('key');
		logger.info(`Attempting to unlink license key: ${key}`);
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
		logger.info(`Unlinking license key ${key}`);
		
		const dbKey = await prisma.key.findUnique({
			where: { key },
			include: { user: true },
		});

		if( !dbKey ) {
			logger.error(`Key ${key} not found`);
			await prisma.$disconnect();
			return interaction.editReply({
				content: 'The key you provided is not linked to any user.',
			});
		}

		await prisma.key.delete({
			where: { key },
		});

		logger.info(`Key ${key} has been unlinked from user ${dbKey.user.discordID}`);
		await prisma.$disconnect();

		return interaction.editReply({
			content: `The key \`${key}\` has been unlinked from ${userMention(dbKey?.user.discordID ?? 'unknown user')}.`,
		});

	}
	catch (e) {
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
			logger.error('Interaction option user not found');
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

    let embedDescription = "";
    updatedKeys.forEach((key) => {
      embedDescription += `**License #${key.id}**\n`;
      embedDescription += "├ Key: `" + key.key + "`\n";
      if (key.license) {
        if(
			(key.license.dateActivated !== null && (key.license.daysLeft <= 0  || key.license.daysValid <= 0)) ||
        	(key.license.daysLeft === 0 && key.license.daysValid === 0 && key.license.dateActivated === null) ||
        	(!key.license.active && !key.license.valid && key.license.dateActivated === null && !key.license.daysLeft && !key.license.daysValid)
		)	{
          embedDescription += `└ Status: **Expired**\n\n`;
        } else {
          embedDescription += `├ Expires${
            key.license.dateActivated === null ? `: ${key.license.daysValid} Days after activation` : `in: ${diffText(key.expirationDate, new Date())}`
          }\n`;
          embedDescription += `├ Activation Time: ${
            key.activationDate.getTime() === new Date(0).getTime() ? "Never" : time(key.activationDate, TimestampStyles.ShortDateTime)
          }\n`;
        }
      } else {
        embedDescription += `├ Expires in: ${diffText(key.expirationDate, new Date())}\n`;
        embedDescription += `├ Activation Time: ${time(key.activationDate, TimestampStyles.ShortDateTime)}\n`;
      }
    });

		const embed = new EmbedBuilder()
			.setTitle('Slotted Key Manager')
			.setDescription(embedDescription)
			.setThumbnail(optionUser.displayAvatarURL({ forceStatic: false }))
			.setFooter({
				text: `Requested by ${interaction.user.displayName}`,
				iconURL: interaction.user.displayAvatarURL({ forceStatic: false }),
			})
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

async function getInfoByUser(interaction: CommandInteraction, options: FixedOptions) {
	try {
		const optionUser = options.getUser('user');
		if (!optionUser) {
			logger.error('Interaction option user not found');
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
		embedDescription += `├ Expires${
			newLicense.dateActivated === null
				? `: ${newLicense.daysValid} Days after activation`
				: ` in: ${diffText(licenseEndDate, new Date())}`
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
			.setThumbnail(optionUser.displayAvatarURL({ forceStatic: false }))
			.setFooter({
				text: `Requested by ${interaction.user.displayName}`,
				iconURL: interaction.user.displayAvatarURL({ forceStatic: false }),
			})
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

async function getInfoByKey(interaction: CommandInteraction, options: FixedOptions) {
	try {
		const optionKey = options.getString('key');
		if (!optionKey) {
			logger.error('Interaction option key not found');
			await prisma.$disconnect();
			return interaction.editReply({
				content: 'An error occurred, please contact the support.',
			});
		}

		logger.info(`License info for key ${optionKey}`);

		if (!keyReg.test(optionKey)) {
			logger.error(`Invalid key format ${optionKey}`);
			await prisma.$disconnect();
			return interaction.editReply({
				content: 'The key you provided is not valid.',
			});
		}

		const success = await updateLicenseInfo(interaction.guild!);

		if (!success) {
			logger.error('Error updating license info');
			await prisma.$disconnect();
			return interaction.editReply({
				content: 'An error occured, please contact the support.',
			});
		}

		const key = await prisma.key.findUnique({
			where: { key: optionKey },
			include: { user: true },
		});

		if (!key) {
			logger.error(`Key ${optionKey} not found`);
			await prisma.$disconnect();
			return interaction.editReply({
				content: 'An error occurred, please contact the support.',
			});
		}

		const user = await interaction.guild?.members.fetch(key.user.discordID).catch(() => null);

		if (!user) {
			logger.error(`User with ID ${key.user.discordID} not found in guild`);
			await prisma.$disconnect();
			return interaction.editReply({
				content: 'The user linked to this key is not found in the guild.',
			});
		}
		let embedDescription = '';
		embedDescription += `**License #${key.id}**\n`;
		embedDescription += '├ User: ' + user.displayName + '\n';
		embedDescription += '├ Key: `' + key.key + '`\n';

		const newLicense = await fetchLicenseInfo(key.key);

		if (!newLicense) {
			logger.error(`API error with ${key.key}`);
			await prisma.$disconnect();
			return interaction.editReply({
				content: 'An error occured, please contact the support.',
			});
		}

		const licenseEndDate = new Date(newLicense.dateActivated);
		licenseEndDate.setDate(licenseEndDate.getDate() + newLicense.daysValid);

		if (
			(newLicense.dateActivated !== null && (newLicense.daysLeft <= 0 || newLicense.daysValid <= 0)) ||
			(newLicense.daysLeft === 0 && newLicense.daysValid === 0 && newLicense.dateActivated === null)||
			(!newLicense.active && !newLicense.valid && newLicense.dateActivated === null && !newLicense.daysLeft && !newLicense.daysValid)
			
		) {
			embedDescription += `└ Status: **Expired**\n\n`;
		} else {
			await prisma.key.update({
				where: { id: key.id },
				data: {
					active: newLicense.active,
					valid: newLicense.valid,
					activationDate: new Date(newLicense.dateActivated),
					expirationDate: licenseEndDate,
				},
			});
			embedDescription += `├ Expires${
				newLicense.dateActivated === null
					? `: ${newLicense.daysValid} Days after activation`
					: `in: ${diffText(licenseEndDate, new Date())}`
			}\n`;
			embedDescription += `├ Activation Time: ${
				key.activationDate.getTime() === new Date(0).getTime()
					? 'Never'
					: time(key.activationDate, TimestampStyles.ShortDateTime)
			}\n`;
			embedDescription += `└ Status: ${key.active ? '**Active**' : 'Inactive'}\n\n`;
		}

		const embed = new EmbedBuilder()
			.setTitle('Slotted Key Manager')
			.setDescription(embedDescription)
			.setThumbnail(user.displayAvatarURL({ forceStatic: false }))
			.setFooter({
				text: `Requested by ${interaction.user.displayName}`,
				iconURL: interaction.user.displayAvatarURL({ forceStatic: false }),
			})
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
