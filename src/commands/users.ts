import { CommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const data = new SlashCommandBuilder()
  .setName("users")
  .setDescription("print users");

export async function execute(interaction: CommandInteraction) {
    if(interaction.user.id !== "") return interaction.reply({content: "You do not have permission to use this command", flags: MessageFlags.Ephemeral});
    try {
        const usersWithKeys = await prisma.user.findMany({include: {keys: true}});
        console.dir(usersWithKeys, {depth: null});
        let message = "```json\n";
        usersWithKeys.forEach(user => {
            message += JSON.stringify(user, null, 2) + "\n";
        });
        message += "```";
        return interaction.reply({content: message, flags: MessageFlags.Ephemeral});
    }
    catch (e) {
        console.error(e);
        await prisma.$disconnect();
        return interaction.reply({content: "An error occured", flags: MessageFlags.Ephemeral});
    }
}