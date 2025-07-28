import { CommandInteraction, InteractionContextType, SlashCommandBuilder } from "discord.js";

export const type = "slash";
export const name = "spoof";
export const allowed_servers = ["1074973203249770538", "1300479915308613702"];

export const data = new SlashCommandBuilder()
  .setName("spoof")
  .setContexts(InteractionContextType.Guild)
  .setDescription("Sends spoof instructions.");

export async function execute(interaction: CommandInteraction) {
  const content = `# 🛂 Spoof instructions
WINDOWS REINSTALL (WIN 10)

MAKE SURE TO WIPE ALL YOUR DISKS IN PC,
MAKE OFFLINE WINDOWS ACCOUNT,
IN LAST STEPS, DISABLE ALL TRACKING STUFF,
DO NOT ACTIVATE WINDOWS WITH CD KEY.
========================
flash bios -> not newest version than 2023
disable tpm, secureboot, fast boot
`;

  return interaction.reply({
    content: content,
  });
}
