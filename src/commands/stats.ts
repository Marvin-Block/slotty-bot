import { PrismaClient } from '@prisma/client';
import {
  AttachmentBuilder,
  CommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import * as fs from 'fs';
import nodeHtmlToImage from 'node-html-to-image';

const prisma = new PrismaClient();

interface SaluteUser {
  place: number;
  discordID: string;
  nickname: string;
  avatarUrl: string;
  total: number;
  normal: number;
  rare: number;
  epic: number;
  legendary: number;
  mythic: number;
}

export const data = new SlashCommandBuilder()
  .setName('stats')
  // .addUserOption((option) =>
  //   option
  //     .setName('user')
  //     .setDescription('The user you want to see the stats of.')
  // )
  .setDescription('Shows the Top 10 saluters.');

export async function execute(interaction: CommandInteraction) {
  const file = fs.readFileSync('./stats.html', 'utf-8');

  await interaction.deferReply();

  const userSalutes = await prisma.userSalutes.findMany({});

  const groupedUsers = Object.entries(
    Object.groupBy(
      userSalutes,
      ({ discordID }: { id: number; discordID: string; rarity: number }) =>
        discordID
    )
  );

  var saluteUsers: SaluteUser[] = groupedUsers.map(([discordID, salutes]) => {
    const normal = salutes!.filter((s) => s.rarity === 0).length;
    const rare = salutes!.filter((s) => s.rarity === 1).length;
    const epic = salutes!.filter((s) => s.rarity === 2).length;
    const legendary = salutes!.filter((s) => s.rarity === 3).length;
    const mythic = salutes!.filter((s) => s.rarity === 4).length;
    const total = normal + rare + epic + legendary + mythic;
    return {
      place: 0,
      discordID,
      nickname: '',
      avatarUrl: '',
      total,
      normal,
      rare,
      epic,
      legendary,
      mythic,
    };
  });

  const topUsers = saluteUsers
    .sort((a, b) => {
      const aTotal = a.normal + a.rare + a.epic + a.legendary + a.mythic;
      const bTotal = b.normal + b.rare + b.epic + b.legendary + b.mythic;

      return bTotal - aTotal;
    })
    .slice(0, 10);

  const userIdList = topUsers.map((u) => u.discordID);
  const discordUserList = await interaction.guild?.members.fetch({
    user: userIdList,
  });

  if (!discordUserList) {
    return interaction.editReply('No users found.');
  }

  saluteUsers = saluteUsers.filter((u) => discordUserList.has(u.discordID));

  saluteUsers.forEach(async (u) => {
    const user = discordUserList.get(u.discordID)!;
    u.place = topUsers.findIndex((tu) => tu.discordID === u.discordID) + 1;
    u.nickname = user.nickname ?? user.user.globalName ?? user.user.username;
    u.avatarUrl = user.displayAvatarURL({
      extension: 'png',
      size: 4096,
    });
  });

  await nodeHtmlToImage({
    output: './assets/stats.png',
    html: file,
    puppeteerArgs: {
      headless: true,
      args: ['--no-sandbox'],
      defaultViewport: {
        width: 1280,
        height: 800,
      },
    },
    type: 'png',
    transparent: true,
    handlebarsHelpers: {},
    content: {
      users: saluteUsers,
    },
  });

  const attachment = new AttachmentBuilder('./assets/stats.png');

  const embed = new EmbedBuilder()
    .setTitle('Top 10 Salute users')
    .setColor('#601499')
    .setImage('attachment://stats.png');

  return interaction.editReply({
    embeds: [embed],
    files: [attachment],
  });
}
