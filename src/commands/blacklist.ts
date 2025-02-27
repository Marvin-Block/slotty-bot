import {
  CacheType,
  CommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface BlacklistRecord {
  createdAt: Date;
  id: number;
  discordID: string;
  reason: string;
  active: number;
  updatedBy: string;
  updatedAt: Date;
}

export const data = new SlashCommandBuilder()
  .setName("blacklist")
  .setDescription("Blacklist a user from the server.")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("add")
      .setDescription("Blacklist a user from the server.")
      .addStringOption((option) =>
        option
          .setName("user")
          .setDescription("The User to be blacklisted.")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("reason")
          .setDescription("The reason for blacklisting the user.")
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("remove")
      .setDescription("Remove a user from the blacklist.")
      .addStringOption((option) =>
        option
          .setName("user")
          .setDescription("The User to be removed from the blacklist.")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("reason")
          .setDescription(
            "The reason for removing the user from the blacklist."
          )
          .setRequired(true)
      )
  );

export async function execute(interaction: CommandInteraction<CacheType>) {
  const optionsData = interaction.options.data;
  const entry = optionsData[0];
  const type = entry.name;
  const userid = entry.options?.find((x) => x.name === "user")?.value as string;
  const reason = entry.options?.find((x) => x.name === "reason")
    ?.value as string;

  if (
    optionsData.length < 1 ||
    (type !== "add" && type !== "remove") ||
    !userid ||
    !reason
  ) {
    return interaction.reply({
      content: "Invalid command usage",
      flags: MessageFlags.Ephemeral,
    });
  }

  try {
    var result: BlacklistRecord | undefined;
    if (type === "add") {
      result = await prisma.blacklist.upsert({
        where: {
          discordID: userid,
        },
        update: {
          reason: reason,
          active: 1,
          updatedBy: interaction.user.id,
        },
        create: {
          discordID: userid,
          reason: reason,
          updatedBy: interaction.user.id,
          active: 1,
        },
      });
      console.log(
        `Blacklisted user ${result.discordID} with reason ${result.reason}`
      );
    }
    if (type === "remove") {
      result = await prisma.blacklist.update({
        where: {
          discordID: userid,
        },
        data: {
          reason: reason,
          active: 0,
          updatedBy: interaction.user.id,
        },
      });
      console.log(
        `Removed blacklisted user ${result.discordID} with reason ${result.reason}`
      );
    }

    if (result && result.active === 1) {
      await interaction.guild?.members.kick(userid);
      console.log(`Kicked user ${userid}`);
    }

    await prisma.$disconnect();
    return interaction.reply({
      content: "Command executed successfully",
      flags: MessageFlags.Ephemeral,
    });
  } catch (e) {
    console.log(e);
    await prisma.$disconnect();
    return interaction.reply({
      content: "An error occured",
      flags: MessageFlags.Ephemeral,
    });
  }
}
