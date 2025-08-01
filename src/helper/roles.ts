import { Guild } from "discord.js";
import { logger } from "./logger";
import { config } from "../config";

export const roleId = config.ACTIVE_SUB_ROLE;
export const whitelistRoleId = "1354198468863856772";

export async function giveRole(guild: Guild, roleId: string, userId: string) {
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) {
    logger.error(`Member with ID ${userId} not found in guild ${guild.id}`);
    return false;
  }
  await member.user.fetch().catch(() => null);
  try {
    if (!member) {
      logger.error("Member not found");
      return false;
    }
    const role = guild.roles.cache.get(roleId);
    if (!role) {
      logger.error("Role not found");
      return false;
    }
    if (member.roles.cache.has(roleId)) {
      logger.error("User already has the role");
      return false;
    }
    await member.roles.add(role);
    logger.info("Role added to user");
    return true;
  } catch (error) {
    logger.error(error, "Error adding role to user");
    return false;
  }
}

export async function removeRole(guild: Guild, roleId: string, userId: string) {
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) {
    logger.error(`Member with ID ${userId} not found in guild ${guild.id}`);
    return false;
  }
  await member.user.fetch().catch(() => null);
  try {
    if (!member) {
      logger.error("Member not found");
      return false;
    }
    const role = guild.roles.cache.get(roleId);
    if (!role) {
      logger.error("Role not found");
      return false;
    }
    if (!member.roles.cache.has(roleId)) {
      logger.info("User doesnt have the role");
      return false;
    }
    await member.roles.remove(role);
    logger.info(`Role removed from user ${userId} since the key is no longer active`);
    return true;
  } catch (error) {
    logger.error(error, "Error removing role from user");
    return false;
  }
}
