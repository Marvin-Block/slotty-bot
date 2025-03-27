import {
  ActionRowBuilder,
  CacheType,
  CommandInteraction,
  InteractionContextType,
  MessageFlags,
  ModalActionRowComponentBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  SlashCommandBuilder,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { logger } from '../helper/logger';

export const type = 'slash';
export const name = 'echo';
export const cutomId = 'echoModal';
export const allowed_servers = [
  '1074973203249770538',
  '1300479915308613702',
  '900017491554734080',
];

export const data = new SlashCommandBuilder()
  .setName('echo')
  .setContexts(InteractionContextType.Guild)
  .setDescription('Replies with your input!')
  .setDefaultMemberPermissions(0);

export async function execute(interaction: CommandInteraction) {
  // Create the modal
  const modal = new ModalBuilder().setCustomId(cutomId).setTitle('Echo Modal');

  const channelid = new TextInputBuilder()
    .setCustomId('channelid')
    .setLabel('Channel ID')
    .setRequired(false)
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

export async function handleModal(
  interaction: ModalSubmitInteraction<CacheType>
) {
  const channelid = interaction.fields.getTextInputValue('channelid');
  const messageid = interaction.fields.getTextInputValue('messageid');
  const messageInput = interaction.fields.getTextInputValue('messageInput');
  if (messageInput.length > 2000) {
    return interaction.reply(
      'Message is too long, please keep it under 2000 characters'
    );
  }

  try {
    if (!messageid) {
      const channel = interaction.client.channels.cache.get(
        channelid
      ) as TextChannel;
      if (!channel) return interaction.reply(messageInput);

      return channel.send(messageInput);
    } else {
      const channel = interaction.client.channels.cache.get(
        channelid
      ) as TextChannel;
      if (!channel) return interaction.reply(messageInput);

      const message = await channel.messages.fetch(messageid);
      if (!message)
        return interaction.reply({
          content: 'Message not found',
          flags: MessageFlags.Ephemeral,
        });

      return message.edit(messageInput);
    }
  } catch (e) {
    logger.error(e, 'Error while sending message');
    return interaction.reply({
      content: 'An error occurred',
      flags: MessageFlags.Ephemeral,
    });
  }
}
