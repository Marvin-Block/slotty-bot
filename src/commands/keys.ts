import { CommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const data = new SlashCommandBuilder()
  .setName("keys")
  .setDescription("Shows you all the keys linked to your account");

export async function execute(interaction: CommandInteraction) {
    try {
        const user = await prisma.user.findFirst({where: {discordID: interaction.user.id}});
        if (!user) return interaction.reply({content: "You do not any keys linked to your account", flags: MessageFlags.Ephemeral});
        let keys = await prisma.key.findMany({where: {userID: user.id}, orderBy: {createdAt: "desc"}});
        if(keys.length < 1) return interaction.reply({content: "You do not any keys linked to your account", flags: MessageFlags.Ephemeral});
        keys = keys.slice(0, Math.min(2, keys.length));

        let embedDescription = "";
        keys.forEach(key => {
            embedDescription += `**License #${key.id}**\n`;
            embedDescription += "├ Key: `"+key.key+"`\n"; ;
            embedDescription += `├ Expires at: <t:${key.createdAt.getTime().toString().slice(0, 10)}:f>\n`;
            embedDescription += `└ Status: DEBUG\n\n`;
            // const keyString = key.key;
            // const createdAt = `<t:${key.createdAt.getTime().toString().slice(0, 10)}:R>`;
            // const updatedAt = `<t:${key.updatedAt.getTime().toString().slice(0, 10)}:R>`;
            // const expiresAt = '<t:1738259516:R>';
            // const status = "DEBUG";
        });

        const embed = new EmbedBuilder()
        .setTitle("Slotted Key Manager")
        .setDescription(embedDescription)
        .setColor("#500de0")


        await prisma.$disconnect();
        return interaction.reply({flags: MessageFlags.Ephemeral, embeds: [embed]});
    }
    catch (e) {
        console.error(e);
        await prisma.$disconnect();
        return interaction.reply({content: "An error occured", flags: MessageFlags.Ephemeral});
    }
}