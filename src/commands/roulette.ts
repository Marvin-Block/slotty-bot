import { PrismaClient } from '@prisma/client';
import {
  AttachmentBuilder,
  Collection,
  CommandInteraction,
  EmbedBuilder,
  InteractionContextType,
  MessageReaction,
  ReadonlyCollection,
  SlashCommandBuilder,
  time,
  TimestampStyles,
  User,
  userMention,
} from 'discord.js';
import { config } from '../config';
import { logger } from '../helper/logger';
import { SecureRandomGenerator } from '../secure_random_number';
import { FixedOptions } from '../typeFixes';

const prisma = new PrismaClient();
const secRand = new SecureRandomGenerator();

const gold = getEmote(config.GOLD);
const black = getEmote(config.BLACK);
const red = getEmote(config.RED);
const participants = new Collection<string, string>();
const rouletteTimer = 1000 * 60 * 0.5;

let activeRoulette = false;
let rouletteMessageId: string | null = null;
let rouletteChannelId: string | null = null;

export const type = 'slash';
export const name = 'roulette';
export const allowed_servers = ['1074973203249770538', '1300479915308613702'];

export const data = new SlashCommandBuilder()
  .setName(name)
  .setContexts(InteractionContextType.Guild)
  .setDescription('Roulette')
  .addSubcommand((sub) =>
    sub.setName('start').setDescription('Start a round of roulette')
  );

export async function execute(interaction: CommandInteraction) {
  const options = interaction.options as FixedOptions;
  const subcommand = options.getSubcommand();
  await interaction.deferReply();

  switch (subcommand) {
    case 'start':
      return rouletteStart(interaction);
    default:
      return;
  }
}

export async function canChangeBaseBet(discordId: string) {
  if (participants.has(discordId) && activeRoulette) {
    return false;
  }
  return true;
}

async function roulette(interaction: CommandInteraction) {
  let rng1 = await secRand.generateSecureRandom(1, 100);
  let rng2 = 0;
  let type = 'none';
  let typeId = 'none';
  // Red - 45% chance
  if (rng1.number > 0 && rng1.number <= 45) {
    // select random variance from 1 to 24
    await secRand.generateSecureRandom(1, 24).then((rng) => {
      rng2 = rng.number;
      type = 'Red';
      typeId = red.id;
    });
  }
  // Gold - 10% chance
  if (rng1.number > 45 && rng1.number <= 55) {
    // select random variance from 1 to 5
    await secRand.generateSecureRandom(1, 5).then((rng) => {
      rng2 = rng.number;
      type = 'Gold';
      typeId = gold.id;
    });
  }
  // Black - 45% chance
  if (rng1.number > 55 && rng1.number <= 100) {
    // select random variance from 1 to 24
    await secRand.generateSecureRandom(1, 24).then((rng) => {
      rng2 = rng.number;
      type = 'Black';
      typeId = black.id;
    });
  }

  if (!rng2 || !type) {
    return interaction.editReply({
      content: 'Error generating roulette',
    });
  }
  const participantsString = participants
    .map((value, key) => `${userMention(key)}`)
    .join(', ');
  logger.info(`Roulette: ${participantsString} - ${type} - ${rng2}`);

  const file = `./assets/roulette/Optimized-${type}-${rng2}.gif`;
  const attachment = new AttachmentBuilder(file);
  const embed = new EmbedBuilder()
    .setTitle('Roulette')
    .setColor('#601499')
    .setDescription('## Rolling...')
    .setImage(`attachment://Optimized-${type}-${rng2}.gif`);

  const message = await interaction.followUp({
    embeds: [embed],
    files: [attachment],
  });

  rouletteMessageId = message.id;
  rouletteChannelId = message.channelId;

  // wait 18.63 seconds + loading buffer for gif to finish playing
  await new Promise((resolve) => setTimeout(resolve, 23_000));

  const winners = participants.filter((value) => value === typeId);
  const winnerList = winners
    .map((value, key) => `${userMention(key)}`)
    .join(', ');

  const embed2 = new EmbedBuilder().setTitle('Roulette').setColor('#601499');

  if (winners.size === 0) {
    embed2.setDescription(
      `No winners this round.. Better luck next time!\nTo start the next round, use /roulette start.`
    );
  } else {
    embed2.setDescription(
      `# **${type}** won! Congratulations to: \n\n ${winnerList}\n\nYour money will be added to your wallet.\nTo start the next round, use /roulette start.`
    );
  }

  message.edit({
    embeds: [embed2],
    files: [],
  });
  // TODO: Give winners their money

  const multiplier = type === 'Gold' ? 10 : 2;
  try {
    await Promise.all(
      winners.map(async (value, key) => {
        const dbUser = await prisma.user.findFirst({
          where: { discordID: key },
          include: { wallet: true, transactions: true },
        });
        if (!dbUser || !dbUser.wallet) {
          return interaction.followUp({
            content: `There was an error, please contact support.`,
            ephemeral: true,
          });
        }
        await prisma.$transaction(async (tx) => {
          const wallet = await tx.wallet.update({
            where: { id: dbUser.wallet!.id },
            data: {
              balance: { increment: dbUser.wallet!.baseBet * multiplier },
            },
          });
          await tx.transactions.create({
            data: {
              amount: dbUser.wallet!.baseBet * multiplier,
              type: 'win roulette',
              wallet: { connect: { id: wallet.id } },
              user: { connect: { discordID: key } },
            },
          });
        });
      })
    );
  } catch (error) {
    logger.error(error, 'Error in transaction');
    interaction.followUp({
      content: `Error in transaction, please contact support.`,
      ephemeral: true,
    });
  }

  await prisma.$disconnect();
  participants.clear();
  activeRoulette = false;
  rouletteMessageId = null;
  rouletteChannelId = null;
  // rouletteStart(interaction, true);
  return;
}

async function rouletteStart(interaction: CommandInteraction) {
  if (activeRoulette) {
    if (rouletteChannelId && rouletteMessageId) {
      const channel = await interaction.client.channels.fetch(
        rouletteChannelId
      );
      if (channel && channel.isTextBased()) {
        const message = await channel.messages.fetch(rouletteMessageId);
        if (message) {
          return interaction.followUp({
            content: `Roulette is already active. \nHere is the link to the active roulette: ${message.url}`,
            ephemeral: true,
          });
        }
      }
    }
    return interaction.followUp({
      content: 'Roulette is already active!',
      ephemeral: true,
    });
  }

  activeRoulette = true;

  const timer = rouletteTimer;
  const rouletteStart = new Date(Date.now() + timer);
  const embed = new EmbedBuilder()
    .setTitle('Roulette')
    .setColor('#601499')
    .setDescription(
      `To enter slotty roulette, please react on the color you want to bet on\n## Voting will end ${time(
        rouletteStart,
        TimestampStyles.RelativeTime
      )}\n\n**${red.fullString}** - 2x payout\n**${
        gold.fullString
      }** - 10x payout\n**${
        black.fullString
      }** - 2x payout\n\nTo collect your daily reward use /wallet daily\nTo set your base bet use /wallet basebet`
    );

  const message = await interaction.editReply({
    embeds: [embed],
  });
  rouletteMessageId = message.id;
  rouletteChannelId = message.channelId;

  message.react(red.fullString);
  message.react(gold.fullString);
  message.react(black.fullString);

  const collector = message.createReactionCollector({
    time: timer,
    dispose: true,
  });

  collector.on('collect', async (reaction: MessageReaction, user: User) => {
    if (
      !(
        [red.name, gold.name, black.name].includes(reaction.emoji.name!) &&
        message.author.id !== user.id
      )
    )
      return;
    let isNewUser = false;
    const userEntry = participants.get(user.id);
    var voteType = '';
    switch (reaction.emoji.name) {
      case red.name:
        voteType = 'Red';
        break;
      case gold.name:
        voteType = 'Gold';
        break;
      case black.name:
        voteType = 'Black';
        break;
    }
    if (!userEntry) {
      participants.set(user.id, reaction.emoji.id!);
      isNewUser = true;
    } else {
      await message.reactions.resolve(userEntry)?.users.remove(user.id);
      participants.delete(user.id);
      participants.set(user.id, reaction.emoji.id!);
      logger.info(
        `Changed reaction from: ${userEntry} to ${reaction.emoji.id}`
      );
      return interaction.followUp({
        content: `${userMention(user.id)} changed their vote to ${voteType}!`,
      });
    }
    try {
      const dbUser = await prisma.user.findFirst({
        where: { discordID: user.id },
        include: { wallet: true, transactions: true },
      });
      if (!dbUser || !dbUser.wallet) {
        return interaction.followUp({
          content: `Cant find user or wallet, please contact support.`,
          ephemeral: true,
        });
      }
      if (dbUser.wallet.balance < dbUser.wallet.baseBet) {
        await message.reactions
          .resolve(reaction.emoji.id!)
          ?.users.remove(user.id);
        return interaction.followUp({
          content: `${userMention(
            user.id
          )} does not have enough coins to play roulette!`,
        });
      }
      if (isNewUser) {
        await prisma.$transaction(async (tx) => {
          const wallet = await tx.wallet.update({
            where: { id: dbUser.wallet!.id },
            data: { balance: { decrement: dbUser.wallet!.baseBet } },
          });
          await tx.transactions.create({
            data: {
              amount: -wallet!.baseBet,
              type: 'particiapte roulette',
              wallet: { connect: { id: wallet.id } },
              user: { connect: { discordID: user.id } },
            },
          });
        });
        return interaction.followUp({
          content: `${userMention(user.id)} has joined roulette and bet ${
            dbUser.wallet.baseBet
          } coins on ${voteType}!`,
        });
      }
      prisma.$disconnect();
      return;
    } catch (error) {
      logger.error(error, 'Error in reaction collector');
      prisma.$disconnect();
      return interaction.followUp({
        content: `Error in reaction collector, please contact support.`,
        ephemeral: true,
      });
    }
  });
  collector.on('create', async (reaction: MessageReaction, user: User) => {
    if (message.author.id === user.id) return;
    return await reaction.remove();
  });
  collector.on(
    'end',
    async (
      collected: ReadonlyCollection<string, MessageReaction>,
      reason: string
    ) => {
      logger.info(` Collector ended: ${reason} - ${collected.size}`);
      if (participants.size === 0) {
        const embed2 = new EmbedBuilder()
          .setTitle('Roulette')
          .setColor('#601499')
          .setDescription('## Voting has ended and no one participated');
        await message.edit({
          embeds: [embed2],
        });
        await participants.clear();
        await message.reactions.removeAll();
        activeRoulette = false;
        rouletteMessageId = null;
        rouletteChannelId = null;
        return;
      }
      if (reason == 'time') {
        const embed2 = new EmbedBuilder()
          .setTitle('Roulette')
          .setColor('#601499')
          .setDescription('## Voting has ended and round will start shortly!');
        message.edit({
          embeds: [embed2],
        });
        return roulette(interaction);
      }
      return;
    }
  );
  collector.on('remove', async (reaction: MessageReaction, user: User) => {
    const userEntry = participants.get(user.id);
    let skipRemove = false;
    message.reactions.cache.forEach(async (reaction) => {
      if (reaction.users.cache.has(user.id)) {
        skipRemove = true;
        return;
      }
    });
    if (userEntry && userEntry === reaction.emoji.id && !skipRemove) {
      participants.delete(user.id);
      logger.info(`Removed reaction: ${userEntry}`);
      try {
        const dbUser = await prisma.user.findFirst({
          where: { discordID: user.id },
          include: { wallet: true, transactions: true },
        });
        if (!dbUser || !dbUser.wallet || !dbUser.transactions) {
          await prisma.$disconnect();
          logger.error('Cant find user, wallet or transactions');
          return interaction.followUp({
            content: `Cant find user, wallet or transactions, please contact support.`,
            ephemeral: true,
          });
        }
        if (dbUser.transactions.length == 0) {
          logger.error('User has no transactions');
          await prisma.$disconnect();
          return interaction.followUp({
            content: `${userMention(
              user.id
            )} has no transactions, please contact support.`,
            ephemeral: true,
          });
        }
        dbUser.transactions.toSorted(
          (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
        );
        const lastTransaction =
          dbUser.transactions[dbUser.transactions.length - 1];
        const lastTransactionDate = new Date(
          lastTransaction.createdAt.getTime() + rouletteTimer
        );

        if (
          lastTransactionDate > new Date() &&
          lastTransaction.type == 'particiapte roulette'
        ) {
          await prisma.$transaction(async (tx) => {
            const wallet = await tx.wallet.update({
              where: { id: dbUser.wallet!.id },
              data: {
                balance: { increment: Math.abs(lastTransaction.amount) },
              },
            });
            await tx.transactions.create({
              data: {
                amount: Math.abs(lastTransaction.amount),
                type: 'refund roulette',
                wallet: { connect: { id: wallet.id } },
                user: { connect: { discordID: user.id } },
              },
            });
          });
          return interaction.followUp({
            content: `${userMention(
              user.id
            )} pulled out. Your money has been refunded!`,
          });
        }
      } catch (error) {
        logger.error(error, 'Error on removing vote');
        await prisma.$disconnect();
        return interaction.followUp({
          content: `Error on removing vote, please contact support.`,
          ephemeral: true,
        });
      }
    }
    return;
  });
}

function getEmote(emoteString: string) {
  const emote = emoteString.match(/(<a?)?:\w+:(\d{18,19}>)?/g);
  if (!emote) {
    return {
      fullString: '',
      name: '',
      id: '',
    };
  }
  const cleanEmoteString = emote[0].replaceAll(/<|>/gm, '');
  const emoteName = cleanEmoteString.split(':')[1];
  const emoteId = cleanEmoteString.split(':')[2];
  return {
    fullString: emote[0],
    name: emoteName,
    id: emoteId,
  };
}
