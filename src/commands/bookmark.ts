import {
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  EmbedBuilder,
  MessageContextMenuCommandInteraction,
  MessageFlags,
} from 'discord.js';

export const type = 'contextMenu';
export const name = 'bookmark';

export const contextMenuData = new ContextMenuCommandBuilder()
  .setName('Bookmark')
  .setType(ApplicationCommandType.Message);

export async function contextMenuExecute(
  interaction: MessageContextMenuCommandInteraction
) {
  const user = await interaction.targetMessage.author.fetch();
  const embed = new EmbedBuilder()
    .setAuthor({
      name: user.tag,
      iconURL: user.avatarURL() ?? '',
    })
    .setDescription(interaction.targetMessage.content)
    .setFooter({
      text: `Message ID: ${interaction.targetMessage.id}`,
    })
    .setTimestamp(interaction.targetMessage.createdTimestamp);
  interaction.user.send({
    content: `[Message](${interaction.targetMessage.url}) bookmarked!`,
    embeds: [embed],
  });
  interaction.reply({
    content: 'Message bookmarked!',
    flags: MessageFlags.Ephemeral,
  });
}
