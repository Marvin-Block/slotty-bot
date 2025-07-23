import { PrismaClient } from '@prisma/client';
import {
	codeBlock,
	CommandInteraction,
	EmbedBuilder,
	hyperlink,
	inlineCode,
	InteractionContextType,
	MessageFlags,
	SlashCommandBuilder,
	userMention
} from 'discord.js';
import { config } from '../config';
import { fetchLicenseInfo } from '../helper/api';
import { logger } from '../helper/logger';
import { giveRole } from '../helper/roles';
import { FixedOptions } from '../typeFixes';
import { emoteGold } from './license';

const prisma = new PrismaClient();
const keyReg = /^([A-Z]|\d){6}-([A-Z]|\d){6}-([A-Z]|\d){6}-([A-Z]|\d){6}$/;
const ticketChannelMessageLink = 'https://discord.com/channels/1300479915308613702/1330889242691502150/1330889548883820655';

export const type = 'slash';
export const name = 'ceremony';
export const allowed_servers = ['1074973203249770538', '1300479915308613702', '1362445089120714762'];
export const whitelisted_users = [
	'834847858439618620', 	// rsn
	'846185075372720158', 	// sx
	'322659763643088897', 	// muffin
	'1145617537711734844', 	// zeri

	'495280024891424769', 	// clouq
	'704032133106237551', 	// erytrea
	'854527909385338940', 	// sim
];

export const data = new SlashCommandBuilder()
	.setName('ceremony')
	.setDescription('work in progress')
	.setContexts(InteractionContextType.Guild)
	.setDefaultMemberPermissions(0)
	.addStringOption((option) => option.setName('key').setDescription('The key you want to send').setRequired(true))
	.addUserOption((option) =>
		option.setName('user').setDescription('The user you want the key to be sent to').setRequired(true)
	);
	
export async function execute(interaction: CommandInteraction) {
	if (!whitelisted_users.includes(interaction.user.id)) return;

	const options = interaction.options as FixedOptions;
	const optionUser = options.getUser('user');
	const optionKey = options.getString('key');

	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	if (!optionUser) {
		logger.error('Interaction option user not found');
		await prisma.$disconnect();
		return interaction.editReply({
			content: `An error occurred, please contact the support.\n${codeBlock('ps', `[ERROR]: "Interaction option 'user' not found"`)}`,
		});
	}

	if (!optionKey) {
		logger.error('Interaction option key not found');
		await prisma.$disconnect();
		return interaction.editReply({
			content: `An error occurred, please contact the support.\n${codeBlock('ps', `[ERROR]: "Interaction option 'key' not found"`)}`,
		});
	}

	if (!keyReg.test(optionKey)) {
		logger.error(`Invalid key format ${optionKey}`);
		await prisma.$disconnect();
		return interaction.editReply({
			content: `An error occurred, please contact the support.\n${codeBlock('ps', '[ERROR]: "Invalid key format"')}`,
		});
	}

	const guild = interaction.guild;
	
	if(!guild) {
		logger.error('Guild not found');
		await prisma.$disconnect();
		return interaction.editReply({
			content: `An error occurred, please contact the support.\n${codeBlock('ps', '[ERROR]: "Guild not found"')}`,
		});
	}

	const member = await guild.members.fetch(optionUser.id).catch(() => null);
	
	if(!member) {
		logger.error(`User ${optionUser.id} not found in guild ${guild.id}`);
		await prisma.$disconnect();
		return interaction.editReply({
			content: `An error occurred, please contact the support.\n${codeBlock('ps', `[ERROR]: "User not found in guild"`)}`,
		});
	}
	const dmChannel = await member.user.createDM().catch(() => {
		logger.error(`Failed to create DM channel for user ${optionUser.id}`);
		return interaction.editReply({
			content: `An error occurred, please contact the support.\n${codeBlock('ps', '[ERROR]: "Failed to create DM channel"')}`,
		});
	});
	if(!dmChannel) {
		logger.error(`DM channel for user ${optionUser.id} not found`);
		await prisma.$disconnect();
		return interaction.editReply({
			content: `An error occurred, please contact the support.\n${codeBlock('ps', '[ERROR]: "Failed to create DM channel"')}`,
		});
	}

	const license = await fetchLicenseInfo(optionKey);
	
	if (!license) {
		logger.error(`API error with ${optionKey}`);
		await prisma.$disconnect();
		return interaction.editReply({
			content: `An error occurred, please contact the support.\n${codeBlock('ps', `[ERROR]: "API Error with key ${optionKey}"`)}`,
		});
	}

	const licenseEndDate = new Date(license.dateActivated);
	licenseEndDate.setDate(licenseEndDate.getDate() + license.daysValid);

	const dbKey = await prisma.key.findFirst({
		where: { key: optionKey },
		include: { user: true },
	});

	if (dbKey) {
		logger.error(`${optionKey} is already linked to another user`);
		await prisma.$disconnect();
		return interaction.editReply({
			content: `An error occurred, please contact the support.\n${codeBlock('ps', `[ERROR]: "The key ${optionKey} is already linked to another user"`)}`,
		});
	}

	const message = `### *SLOTTED.CC* ${emoteGold} *LEAGUE INTERNAL*
	
Here is your key (${license.daysValid} Days):${codeBlock(optionKey)}
The key is automatically linked to your account and you can use ${inlineCode('/license info')} to see its status.

-# If you have any questions, please ${hyperlink('create a ticket', ticketChannelMessageLink)}.
`
	const embed = new EmbedBuilder()
		.setDescription(message)
		.setColor('#ffc800')
		.setFooter({ text: 'This is an automated message, please do not reply.' })
		.setTimestamp();

	await member.user.send({
		embeds: [embed],
	})
	.then(async () => {
		logger.info(`Sent key ${optionKey} to user ${optionUser.id} in DM`);

		const dbUser = await prisma.user.findUnique({
			where: { discordID: interaction.user.id },
		});

		let discountCounter = dbUser ? dbUser.discountCounter : 0;
		if (discountCounter >= 3) {
			logger.info(`User ${interaction.user.id} has reached the maximum discount counter.`);
		} else {
			discountCounter++;
			logger.info(`User ${interaction.user.id} has a discount counter of ${discountCounter}.`);
		}

		// TODO: implement proper discount logic
		const updatedUser = await prisma.user.upsert({
			where: { discordID: interaction.user.id },
			update: {
				lastPurchase: new Date(),
				discountCounter,
				activeKey: optionKey,
				keys: {
					upsert: {
						where: { key: optionKey },
						update: {
							active: license.active,
							valid: license.valid,
							activationDate: new Date(license.dateActivated),
							expirationDate: licenseEndDate,
						},
						create: {
							key: optionKey,
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
				lastPurchase: new Date(),
				discountCounter: 1,
				activeKey: optionKey,
				wallet: {
					create: {
						balance: 0,
					},
				},
				keys: {
					create: {
						key: optionKey,
						active: license.active,
						valid: license.valid,
						activationDate: new Date(license.dateActivated),
						expirationDate: licenseEndDate,
					},
				},
			},
		});

		if (!updatedUser) {
			logger.error(`Error linking license key ${optionKey} to user ${interaction.user.id}`);
			await prisma.$disconnect();
			return interaction.editReply({
				content: `An error occurred, please contact the support.\n${codeBlock('ps', `[ERROR]: "Could not link license key to user"`)}`,
			});
		}

		if(interaction.guild) {
			let tier: string | null = null;
			switch(updatedUser.discountCounter) {
				case 1:
					tier = config.TIER1;
					break;
				case 2:
					tier = config.TIER2;
					break;
				case 3:
					tier = config.TIER3;
					break;
			}
			if(tier) {
				giveRole(interaction.guild, tier, optionUser.id);
			}
		}

// TODO: discountCounter -> notify about discount if applicable
		const discountMessage = `### Congratulations :tada:

You have unlocked **Tier ${updatedUser.discountCounter}**

You are now eligible for a discount on your next purchase!

-# If you have any questions, please ${hyperlink('create a ticket', ticketChannelMessageLink)}.
`;

		const discountEmbed = new EmbedBuilder()
			.setDescription(discountMessage)
			.setColor('#00ff64')
			.setFooter({ text: 'This is an automated message, please do not reply.' })
			.setTimestamp();

		await member.user.send({
			embeds: [discountEmbed],
		}).catch((err) => {
			logger.error(`Failed to send discount message to user ${optionUser.id}: ${err}`);
			return interaction.editReply({
				content: `An error occurred while sending the discount message, please contact the support.\n${codeBlock('ps', `[ERROR]: "${err}"`)}`,
			});
		});

		await prisma.$disconnect();
		return await interaction.editReply({
			content: `Direct message sent to ${userMention(optionUser.id)} with the key ${inlineCode(optionKey)}.`,
		});
	})
	.catch(async (err) => {
		logger.error(`Failed to send DM to user ${optionUser.id}: ${err}`);
		await interaction.editReply({
			content: `An error occurred, please contact the support.\n${codeBlock('ps', `[ERROR]: "${err}"`)}`,
		});
		await prisma.$disconnect();
		return;
	})
	
	// TODO: check discountCounter -> notify about discount if applicable
	
	return;
}
