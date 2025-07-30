import { PrismaClient } from "@prisma/client";
import {
  codeBlock,
  CommandInteraction,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import { config } from "../config.js";
import { logger } from "../helper/logger.js";

const prisma = new PrismaClient();

export const type = "slash";
export const name = "prepare";
export const allowed_servers = [
  "1074973203249770538",
  "1300479915308613702",
  "1362445089120714762",
];
export const whitelisted_users = [
  "834847858439618620", // rsn
  "846185075372720158", // sx
  "322659763643088897", // muffin
  "1145617537711734844", // zeri

  "495280024891424769", // clouq
  "704032133106237551", // erytrea
  "854527909385338940", // sim
];

export const data = new SlashCommandBuilder()
  .setName("prepare")
  .setDescription("Dev admin command")
  .setContexts(InteractionContextType.Guild)
  .setDefaultMemberPermissions(0);

export async function execute(interaction: CommandInteraction) {
  if (!whitelisted_users.includes(interaction.user.id)) return;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const guild = interaction.guild;

  if (!guild) {
    logger.error("Guild not found");
    await prisma.$disconnect();
    return interaction.editReply({
      content: `An error occurred, please contact the support.\n${codeBlock(
        "ps",
        '[ERROR]: "Guild not found"'
      )}`,
    });
  }

  const members = await guild.members.fetch().catch(() => null);

  if (!members) {
    logger.error(`Could not find members in guild ${guild.id}`);
    await prisma.$disconnect();
    return interaction.editReply({
      content: `An error occurred, please contact the support.\n${codeBlock(
        "ps",
        `[ERROR]: "User not found in guild"`
      )}`,
    });
  }

  members.forEach(async (member) => {
    if (member.user.bot) return;

    const role = await member.roles.cache.get("1341879803254411315");
    if (!role) {
      return;
    }
    logger.info(`Role found for member: ${member.user.username}`);

    prisma.user
      .update({
        where: { discordID: member.id },
        data: {
          discountCounter: 3,
          updatedAt: new Date(),
        },
      })
      .then(async () => {
        logger.info(`User ${member.user.username} discount counter updated`);
        await member.roles.add(config.TIER3).catch((error) => {
          logger.error(`Failed to add role to member ${member.user.username}: ${error}`);
        });
      })
      .catch((error) => {
        logger.error(`Failed to update user ${member.user.username}: ${error}`);
        return;
      });
  });

  await prisma.$disconnect();
  await interaction.editReply({
    content: `Guild members fetched successfully. Total members: ${members.size}`,
  });
  return;
}
