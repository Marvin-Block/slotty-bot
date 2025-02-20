import {
  ActionRowBuilder,
  CommandInteraction,
  InteractionContextType,
  ModalActionRowComponentBuilder,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('echo')
  .setContexts(InteractionContextType.Guild)
  .setDescription('Replies with your input!')
  .setDefaultMemberPermissions(0);
//   .addChannelOption((option) =>
//     option
//       .setName('channel')
//       .setDescription('The channel to echo into')
//       .setRequired(true)
//       .addChannelTypes(ChannelType.GuildText)
//   )
//   .addStringOption((option) =>
//     option
//       .setName('input')
//       .setDescription('The input to echo back')
//       .setRequired(true)
//   )

export async function execute(interaction: CommandInteraction) {
  // Create the modal
  const modal = new ModalBuilder()
    .setCustomId('echoModal')
    .setTitle('Echo Modal');

  const channelid = new TextInputBuilder()
    .setCustomId('channelid')
    .setLabel('Channel ID')
    .setRequired(true)
    .setStyle(TextInputStyle.Short);

  const messageid = new TextInputBuilder()
    .setCustomId('messageid')
    .setLabel('Message ID')
    .setRequired(false)
    .setStyle(TextInputStyle.Short);

  const messageInput = new TextInputBuilder()
    .setCustomId('messageInput')
    .setLabel('What message to send / update to')
    .setRequired(true)
    .setStyle(TextInputStyle.Paragraph);

  const firstActionRow =
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
      channelid
    );

  const secondActionRow =
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
      messageid
    );

  const thirdActionRow =
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
      messageInput
    );

  // Add inputs to the modal
  modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);

  // Show the modal to the user
  await interaction.showModal(modal);
}
