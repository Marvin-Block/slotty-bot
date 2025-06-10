import { PrismaClient } from "@prisma/client";
import {
  ApplicationCommandType,
  AttachmentBuilder,
  CommandInteraction,
  ContextMenuCommandBuilder,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
  UserContextMenuCommandInteraction,
} from "discord.js";
import * as fs from "fs";
import nodeHtmlToImage from "node-html-to-image";
import { diffDays, diffText } from "../helper/dates";
import { FixedImageOptions, FixedOptions, SaluteUser } from "../typeFixes";
import { updateLicenseInfo } from "./license";

const prisma = new PrismaClient();

export const type = "slash";
export const name = "stats";
export const allowed_servers = ["1074973203249770538", "1300479915308613702"];

export const data = new SlashCommandBuilder()
  .setName("stats")
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((subcommand) => subcommand.setName("top").setDescription("Shows the Top 10 saluters."))
  .addSubcommand((subcommand) =>
    subcommand
      .setName("user")
      .setDescription("Shows the stats of a user.")
      .addUserOption((option) => option.setName("user").setDescription("The user you want to see the stats of.").setRequired(true))
  )
  .setDescription("Salute Stats");

export async function execute(interaction: CommandInteraction) {
  const options = interaction.options as FixedOptions;
  const subcommand = options.getSubcommand();

  await interaction.deferReply();

  if (subcommand === "user") {
    const user = options.getUser("user");
    const file = fs.readFileSync("./stats.html", "utf-8");

    if (!user) {
      return interaction.editReply("No user found.");
    }

    const saluteUser = await prisma.user.findFirst({
      where: { discordID: user.id },
      include: { salutes: true, wallet: true },
    });

    if (!saluteUser) {
      return interaction.editReply("No salutes found.");
    }

    let subTime = "None";
    let slottedCoins = 0;
    let highestWin = 0;
    let highestLoss = 0;

    if (saluteUser.activeKey) {
      const key = await prisma.key.findFirst({
        where: { key: saluteUser.activeKey },
      });
      if (key) {
        if(interaction.guild) {
          await updateLicenseInfo(interaction.guild)
        }
        const days = parseInt(diffDays(key.expirationDate, new Date()).toFixed(0));
        if (days > 500) {
          subTime = "Lifetime";
        } else {
          subTime = diffText(key.expirationDate, new Date());
        }
      }
    }

    if (saluteUser.wallet) {
      slottedCoins = saluteUser.wallet.balance;
      highestWin = saluteUser.wallet.highestWin;
      highestLoss = saluteUser.wallet.highestLoss;
    }

    const normal = saluteUser.salutes.filter((s) => s.rarity === 0).length;
    const rare = saluteUser.salutes.filter((s) => s.rarity === 1).length;
    const epic = saluteUser.salutes.filter((s) => s.rarity === 2).length;
    const legendary = saluteUser.salutes.filter((s) => s.rarity === 3).length;
    const mythic = saluteUser.salutes.filter((s) => s.rarity === 4).length;
    const total = normal + rare + epic + legendary + mythic;

    const member = await interaction.guild?.members.fetch(user.id);
    await member?.user.fetch();

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
          avatarUrl: member!.displayAvatarURL({
            extension: "png",
            size: 4096,
          }),
          nickname: user.displayName,
          username: user.username,
          banner: member!.displayBannerURL({ extension: "webp", size: 4096 }) ?? "https://zipline.sephiran.com/u/Tx4KlZ.gif",
          total,
          normal,
          rare,
          epic,
          legendary,
          mythic,
          subTime,
          slottedCoins,
          highestWin,
          highestLoss,
        },
      },
    } as FixedImageOptions);

    const attachment = new AttachmentBuilder("./assets/stats.png");

    const embed = new EmbedBuilder().setTitle("Here are the stats you requested.").setColor("#601499").setImage("attachment://stats.png");

    return interaction.editReply({
      embeds: [embed],
      files: [attachment],
    });
  }

  if (subcommand === "top") {
    const file = fs.readFileSync("./top-stats.html", "utf-8");

    const users = await prisma.user.findMany({
      include: { salutes: true, wallet: true },
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
        slottedCoins: 0,
        subTime: "None",
      } as SaluteUser;
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
      const dbUser = await prisma.user.findFirst({
        where: { discordID: u.discordID },
        include: { wallet: true },
      });
      if (dbUser && dbUser.wallet) {
        u.slottedCoins = dbUser.wallet.balance;
        if (dbUser.activeKey) {
          const key = await prisma.key.findFirst({
            where: { key: dbUser.activeKey },
          });
          if (key) {
            const days = parseInt(diffDays(key.expirationDate, new Date()).toFixed(0));
            if (days > 500) {
              u.subTime = "Lifetime";
            } else {
              u.subTime = diffText(key.expirationDate, new Date());
            }
          }
        }
      }
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
    } as FixedImageOptions);

    const attachment = new AttachmentBuilder("./assets/top-stats.png");

    const embed = new EmbedBuilder().setTitle("Top 10 Salute users").setColor("#601499").setImage("attachment://top-stats.png");

    return interaction.editReply({
      embeds: [embed],
      files: [attachment],
    });
  }

  return;
}

export const contextMenuData = new ContextMenuCommandBuilder().setName("Show Stats").setType(ApplicationCommandType.User);

export async function contextMenuExecute(interaction: UserContextMenuCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await statUser(interaction);
}

async function statUser(interaction: UserContextMenuCommandInteraction | CommandInteraction) {
  let user;
  if (interaction.isContextMenuCommand()) {
    user = (interaction as UserContextMenuCommandInteraction).targetUser;
  } else {
    user = ((interaction as CommandInteraction).options as FixedOptions).getUser("user");
  }
  const file = fs.readFileSync("./stats.html", "utf-8");

  if (!user) {
    return interaction.editReply({
      content: "No user found.",
    });
  }

  const saluteUser = await prisma.user.findFirst({
    where: { discordID: user.id },
    include: { salutes: true, wallet: true },
  });

  if (!saluteUser) {
    return interaction.editReply({
      content: "No salutes found.",
    });
  }

  let subTime = "None";
  let slottedCoins = 0;

  if (saluteUser.activeKey) {
    const key = await prisma.key.findFirst({
      where: { key: saluteUser.activeKey },
    });
    if (key) {
      if(interaction.guild) {
        await updateLicenseInfo(interaction.guild);
      }
      const days = parseInt(diffDays(key.expirationDate, new Date()).toFixed(0));
      if (days > 500) {
        subTime = "Lifetime";
      } else {
        subTime = diffText(key.expirationDate, new Date());
      }
    }
  }

  if (saluteUser.wallet) {
    slottedCoins = saluteUser.wallet.balance;
  }

  const normal = saluteUser.salutes.filter((s) => s.rarity === 0).length;
  const rare = saluteUser.salutes.filter((s) => s.rarity === 1).length;
  const epic = saluteUser.salutes.filter((s) => s.rarity === 2).length;
  const legendary = saluteUser.salutes.filter((s) => s.rarity === 3).length;
  const mythic = saluteUser.salutes.filter((s) => s.rarity === 4).length;
  const total = normal + rare + epic + legendary + mythic;

  const member = await interaction.guild?.members.fetch(user.id);
  await member?.user.fetch();

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
        avatarUrl: member!.displayAvatarURL({
          extension: "png",
          size: 4096,
        }),
        nickname: user.displayName,
        username: user.username,
        banner: member!.displayBannerURL({ extension: "webp", size: 4096 }) ?? "https://zipline.sephiran.com/u/Tx4KlZ.gif",
        total,
        normal,
        rare,
        epic,
        legendary,
        mythic,
        subTime,
        slottedCoins,
      },
    },
  } as FixedImageOptions);

  const attachment = new AttachmentBuilder("./assets/stats.png");

  const embed = new EmbedBuilder().setTitle("Here are the stats you requested.").setColor("#601499").setImage("attachment://stats.png");

  return interaction.editReply({
    embeds: [embed],
    files: [attachment],
  });
}
