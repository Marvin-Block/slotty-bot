import { CommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const data = new SlashCommandBuilder()
  .setName("link")
  .addStringOption(option => option.setName("key").setDescription("The key you want to link").setRequired(true))
  .setDescription("Links your slotted key to your account");

export async function execute(interaction: CommandInteraction) {
    try {
        const key = interaction.options.get("key")?.value as string;
        const user = await prisma.user.findFirst({where: {discordID: interaction.user.id}});    
        if (!user) {
            const result = await prisma.user.create({data: {discordID: interaction.user.id, keys: {create: {key}}}});
            console.log(`Created user ${result.discordID} with key ${key}`);
        } else {
            const result = await prisma.user.update({where: {discordID: interaction.user.id}, data: {keys: {create: {key}}}});
            console.log(`Updated user ${result.discordID} with key ${key}`);
        }
        await prisma.$disconnect();
        return interaction.reply({content: "Successfully linked", flags: MessageFlags.Ephemeral});
    }
    catch (e) {
        console.error(e);
        await prisma.$disconnect();
        return interaction.reply({content: "An error occured", flags: MessageFlags.Ephemeral});
    }
}