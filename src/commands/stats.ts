import { PrismaClient } from "@prisma/client";
import {
  AttachmentBuilder,
  CommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import * as fs from "fs";
import nodeHtmlToImage from "node-html-to-image";

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
  .setName("stats")
  .addSubcommand((subcommand) =>
    subcommand.setName("top").setDescription("Shows the Top 10 saluters.")
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("user")
      .setDescription("Shows the stats of a user.")
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("The user you want to see the stats of.")
          .setRequired(true)
      )
  )
  .setDescription("Salute Stats");

export async function execute(interaction: CommandInteraction) {
  const optionsData = interaction.options.data;
  const entry = optionsData[0];
  const type = entry.name;

  await interaction.deferReply();

  if (type === "user") {
    const file = fs.readFileSync("./stats.html", "utf-8");
    const user = entry.options?.find((o) => o.name === "user")?.user;

    if (!user) {
      return interaction.reply("No user found.");
    }

    const saluteUser = await prisma.user.findFirst({
      where: { discordID: user.id },
      include: { salutes: true },
    });

    if (!saluteUser) {
      return interaction.reply("No salutes found.");
    }

    const normal = saluteUser.salutes.filter((s) => s.rarity === 0).length;
    const rare = saluteUser.salutes.filter((s) => s.rarity === 1).length;
    const epic = saluteUser.salutes.filter((s) => s.rarity === 2).length;
    const legendary = saluteUser.salutes.filter((s) => s.rarity === 3).length;
    const mythic = saluteUser.salutes.filter((s) => s.rarity === 4).length;
    const total = normal + rare + epic + legendary + mythic;

    await nodeHtmlToImage({
      output: "./assets/stats.png",
      html: file,
      puppeteerArgs: {
        headless: true,
        args: ["--no-sandbox"],
        defaultViewport: {
          width: 800,
          height: 1000,
        },
      },
      type: "png",
      transparent: true,
      handlebarsHelpers: {},
      content: {
        user: {
          avatarUrl: user.displayAvatarURL({
            extension: "png",
            size: 4096,
          }),
          nickname: user.displayName,
          username: user.username,
          total,
          normal,
          rare,
          epic,
          legendary,
          mythic,
        },
      },
    });

    const attachment = new AttachmentBuilder("./assets/stats.png");

    const embed = new EmbedBuilder()
      .setTitle("Here are the stats you requested.")
      .setColor("#601499")
      .setImage("attachment://stats.png");

    return interaction.editReply({
      embeds: [embed],
      files: [attachment],
    });
  }

  if (type === "top") {
    const file = fs.readFileSync("./top-stats.html", "utf-8");

    const users = await prisma.user.findMany({
      include: { salutes: true },
    });

    const groupedUsers = users.map((user) => [user.discordID, user.salutes]);

    var saluteUsers: SaluteUser[] = groupedUsers.map(([discordID, salutes]) => {
      const id = discordID as string;
      const saluteList = salutes as {
        createdAt: Date;
        id: number;
        updatedAt: Date;
        auditId: number;
        userID: number;
        rarity: number;
      }[];
      const normal = saluteList!.filter((s) => s.rarity === 0).length;
      const rare = saluteList!.filter((s) => s.rarity === 1).length;
      const epic = saluteList!.filter((s) => s.rarity === 2).length;
      const legendary = saluteList!.filter((s) => s.rarity === 3).length;
      const mythic = saluteList!.filter((s) => s.rarity === 4).length;
      const total = normal + rare + epic + legendary + mythic;
      return {
        place: 0,
        discordID: id,
        nickname: "",
        avatarUrl: "",
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
      return interaction.editReply("No users found.");
    }

    saluteUsers = saluteUsers.filter((u) => discordUserList.has(u.discordID));

    saluteUsers.forEach(async (u) => {
      const user = discordUserList.get(u.discordID)!;
      u.place = topUsers.findIndex((tu) => tu.discordID === u.discordID) + 1;
      u.nickname = user.nickname ?? user.user.globalName ?? user.user.username;
      u.avatarUrl = user.displayAvatarURL({
        extension: "png",
        size: 4096,
      });
    });

    await nodeHtmlToImage({
      output: "./assets/top-stats.png",
      html: file,
      puppeteerArgs: {
        headless: true,
        args: ["--no-sandbox"],
        defaultViewport: {
          width: 1280,
          height: 800,
        },
      },
      type: "png",
      transparent: true,
      handlebarsHelpers: {},
      content: {
        users: saluteUsers,
      },
    });

    const attachment = new AttachmentBuilder("./assets/top-stats.png");

    const embed = new EmbedBuilder()
      .setTitle("Top 10 Salute users")
      .setColor("#601499")
      .setImage("attachment://top-stats.png");

    return interaction.editReply({
      embeds: [embed],
      files: [attachment],
    });
  }

  return;
}
