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
import { SecureRandomGenerator } from '../secure_random_number';
import { FixedOptions } from '../typeFixes';

const prisma = new PrismaClient();
const secRand = new SecureRandomGenerator();

const gold = '<<a:gold_slotted_gif:1351793834681565214>>';
const goldId = '1351793834681565214';
const black = '<a:black_slotted_gif:1351793837202473001>';
const blackId = '1351793837202473001';
const red = '<a:red_slotted_gif:1351793841216290826>';
const redId = '1351793841216290826';
const participants = new Collection<string, string>();
const rouletteTimer = 1000 * 60 * 1;
let activeRoulette = false;

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
      typeId = redId;
    });
  }
  // Gold - 10% chance
  if (rng1.number > 45 && rng1.number <= 55) {
    // select random variance from 1 to 5
    await secRand.generateSecureRandom(1, 5).then((rng) => {
      rng2 = rng.number;
      type = 'Gold';
      typeId = goldId;
    });
  }
  // Black - 45% chance
  if (rng1.number > 55 && rng1.number <= 100) {
    // select random variance from 1 to 24
    await secRand.generateSecureRandom(1, 24).then((rng) => {
      rng2 = rng.number;
      type = 'Black';
      typeId = blackId;
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
  console.log(`Roulette: ${participantsString} - ${type} - ${rng2}`);

  const file = `./assets/roulette/Optimized-${type}-${rng2}.gif`;
  const attachment = new AttachmentBuilder(file);
  const embed = new EmbedBuilder()
    .setTitle('Roulette')
    .setColor('#601499')
    .setDescription('## Rolling...')
    .setImage(`attachment://Optimized-${type}-${rng2}.gif`);

  const rouletteMessage = await interaction.followUp({
    embeds: [embed],
    files: [attachment],
  });

  // wait 18.63 seconds + loading buffer for gif to finish playing
  await new Promise((resolve) => setTimeout(resolve, 23_000));

  const winners = participants.filter((value) => value === typeId);
  const winnerList = winners
    .map((value, key) => `${userMention(key)}`)
    .join(', ');

  const embed2 = new EmbedBuilder().setTitle('Roulette').setColor('#601499');

  if (winners.size === 0) {
    embed2.setDescription(`No winners this round.. Better luck next time!`);
  } else {
    embed2.setDescription(
      `# **${type}** won! Congratulations to: \n\n ${winnerList}\n\nYour money will be added to your wallet shortly!`
    );
  }
  rouletteMessage.edit({
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
    console.error(error);
    interaction.followUp({
      content: `Error in transaction, please contact support.`,
      ephemeral: true,
    });
  }

  prisma.$disconnect();
  await new Promise((resolve) => setTimeout(resolve, 10_000));
  participants.clear();
  activeRoulette = false;
  return;
}

async function rouletteStart(interaction: CommandInteraction) {
  if (activeRoulette) {
    interaction.followUp({
      content: 'Roulette is already active!',
      ephemeral: true,
    });
    new Promise((resolve) => setTimeout(resolve, 15_000));
    return;
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
      )}`
    );

  const message = await interaction.editReply({
    embeds: [embed],
  });

  message.react(red);
  message.react(gold);
  message.react(black);

  const collector = message.createReactionCollector({
    time: timer,
    dispose: true,
  });

  collector.on('collect', async (reaction: MessageReaction, user: User) => {
    if (
      !(
        ['red_slotted', 'gold_slotted', 'black_slotted'].includes(
          reaction.emoji.name!
        ) && message.author.id !== user.id
      )
    )
      return;
    let isNewUser = false;
    const userEntry = participants.get(user.id);
    if (!userEntry) {
      participants.set(user.id, reaction.emoji.id!);
      isNewUser = true;
    } else {
      await message.reactions.resolve(userEntry)?.users.remove(user.id);
      participants.delete(user.id);
      participants.set(user.id, reaction.emoji.id!);
      console.log(
        `Changed reaction from: ${userEntry} to ${reaction.emoji.id}`
      );
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
        var voteType = '';
        switch (reaction.emoji.name) {
          case 'red_slotted':
            voteType = 'Red';
            break;
          case 'gold_slotted':
            voteType = 'Gold';
            break;
          case 'black_slotted':
            voteType = 'Black';
            break;
        }
        interaction.followUp({
          content: `${userMention(user.id)} has joined roulette and bet ${
            dbUser.wallet.baseBet
          } coins on ${voteType}!`,
        });
      }
      prisma.$disconnect();
      return;
    } catch (error) {
      console.error(error);
      prisma.$disconnect();
      return interaction.followUp({
        content: `Error in reaction collector, please contact support.`,
        ephemeral: true,
      });
    }
  });
  collector.on('create', async (reaction: MessageReaction, user: User) => {
    if (message.author.id === user.id) return;
    await reaction.remove();
  });
  collector.on(
    'end',
    async (
      collected: ReadonlyCollection<string, MessageReaction>,
      reason: string
    ) => {
      console.log(` Collector ended: ${reason} - ${collected.size}`);
      if (participants.size === 0) {
        const embed2 = new EmbedBuilder()
          .setTitle('Roulette')
          .setColor('#601499')
          .setDescription('## Voting has ended and no one participated');
        interaction.editReply({
          embeds: [embed2],
        });
        message.reactions.removeAll();
        await new Promise((resolve) => setTimeout(resolve, 10_000));
        interaction.deleteReply();
        activeRoulette = false;
        participants.clear();
        return;
      }
      if (reason == 'time') {
        const embed2 = new EmbedBuilder()
          .setTitle('Roulette')
          .setColor('#601499')
          .setDescription('## Voting has ended and round will start shortly!');
        interaction.editReply({
          embeds: [embed2],
        });
        message.reactions.removeAll();
        roulette(interaction);
        await new Promise((resolve) => setTimeout(resolve, 5_000));
        interaction.deleteReply();
      }
    }
  );
  collector.on('remove', async (reaction: MessageReaction, user: User) => {
    const userEntry = participants.get(user.id);
    if (userEntry && userEntry === reaction.emoji.id) {
      participants.delete(user.id);
      console.log(`Removed reaction: ${userEntry}`);
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
              data: { balance: { increment: lastTransaction.amount } },
            });
            await tx.transactions.create({
              data: {
                amount: lastTransaction.amount,
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
        console.error(error);
        prisma.$disconnect();
        return interaction.followUp({
          content: `Error on removing vote, please contact support.`,
          ephemeral: true,
        });
      }
    }
    return;
  });
}
