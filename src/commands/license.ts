import { PrismaClient } from "@prisma/client";
import {
  CommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  time,
  TimestampStyles,
} from "discord.js";
import { FixedOptions } from "../typeFixes";
import { fetchLicenseInfo } from "../helper/api";
import {
  diffDays,
  diffHours,
  diffMonths,
  diffText,
  diffTime,
  diffYears,
} from "../helper/dates";

const prisma = new PrismaClient();

export const type = "slash";
export const name = "license";
export const allowed_servers = ["1074973203249770538", "1300479915308613702"];

export const data = new SlashCommandBuilder()
  .setName("license")
  .setDescription("Manage your licenses")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("link")
      .setDescription("Links your slotted key to your discord account")
      .addStringOption((option) =>
        option
          .setName("key")
          .setDescription("The key you want to link to your discord account")
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand.setName("list").setDescription("Lists all your linked keys")
  );

export async function execute(interaction: CommandInteraction) {
  const options = interaction.options as FixedOptions;
  const subcommand = options.getSubcommand();
  await interaction.deferReply({ ephemeral: true });
  switch (subcommand) {
    case "link":
      linkLicense(interaction, options);
      break;
    case "list":
      listLicenses(interaction);
      break;

    default:
      return interaction.editReply(`Interaction ${subcommand} not found`);
  }
}

async function linkLicense(
  interaction: CommandInteraction,
  options: FixedOptions
) {
  // TODO: add check on backend to see if key is valid before linking
  try {
    console.log("Linking license...");
    const key = options.getString("key");
    if (!key) {
      await prisma.$disconnect();
      console.log("No key provided");
      return interaction.editReply({
        content: "No key provided",
      });
    }

    const license = await fetchLicenseInfo(key);
    if (license === null) {
      await prisma.$disconnect();
      console.log("Invalid key");
      return interaction.editReply({
        content: "Invalid key",
      });
    }

    if (!license.active) {
      await prisma.$disconnect();
      console.log("License is not active");
      return interaction.editReply({
        content: "License is not active",
      });
    }

    if (!license.valid) {
      await prisma.$disconnect();
      console.log("License is not valid");
      return interaction.editReply({
        content: "License is not valid",
      });
    }

    const dbKey = await prisma.key.findUnique({
      where: { key },
    });
    if (dbKey) {
      await prisma.$disconnect();
      console.log("Key already linked to another user");
      return interaction.editReply({
        content: "Key already linked  to another user",
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
      await prisma.$disconnect();
      console.log("Error linking key to user");
      return interaction.editReply({
        content: "Error linking key to user",
      });
    }
    await prisma.$disconnect();
    return interaction.editReply({
      content: `\`${key}\` is now linked to your account.\nYour remaining sub time is ${diffText(
        licenseEndDate,
        new Date()
      )}`,
    });
  } catch (e) {
    console.error(e);
    await prisma.$disconnect();
    return interaction.editReply({
      content: "An error occured, please contact the support",
    });
  }
}

async function listLicenses(interaction: CommandInteraction) {
  try {
    console.log("Listing licenses...");
    const user = await prisma.user.findUnique({
      where: { discordID: interaction.user.id },
      include: { keys: true },
    });

    if (!user) {
      await prisma.$disconnect();
      console.log("User not found");
      return interaction.editReply({
        content: "User not found",
      });
    }

    if (user.keys.length < 1) {
      await prisma.$disconnect();
      console.log("No keys found");
      return interaction.editReply({
        content: "No keys found",
      });
    }

    const keys = user.keys.slice(0, Math.min(2, user.keys.length));

    let embedDescription = "";
    keys.forEach((key) => {
      embedDescription += `**License #${key.id}**\n`;
      embedDescription += "├ Key: `" + key.key + "`\n";
      embedDescription += `├ Time Left: ${diffText(
        key.expirationDate,
        new Date()
      )}\n`;
      embedDescription += `├ Status: ${key.active ? "active" : "inactive"}\n\n`;
      embedDescription += `└ Status: ${key.active ? "active" : "inactive"}\n\n`;
    });

    const embed = new EmbedBuilder()
      .setTitle("Slotted Key Manager")
      .setDescription(embedDescription)
      .setColor("#500de0");

    await prisma.$disconnect();
    return interaction.editReply({
      embeds: [embed],
    });
  } catch (error) {
    console.error(error);
    await prisma.$disconnect();
    return interaction.editReply({
      content: "An error occured, please contact the support",
    });
  }

  return interaction.editReply({
    content: "Listing your licenses...",
  });
}
