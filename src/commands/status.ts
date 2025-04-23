import {
  CommandInteraction,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { config } from '../config';
import { logger } from '../helper/logger';
import { FixedOptions } from '../typeFixes';

export const type = 'slash';
export const name = 'status';
export const allowed_servers = ['1074973203249770538', '1300479915308613702'];

export const data = new SlashCommandBuilder()
  .setName('status')
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((subcommand) =>
    subcommand
      .setName('update')
      .setDescription('Update the status channel')
      .addStringOption((option) =>
        option
          .setRequired(true)
          .setName('status')
          .setDescription('Status to set')
          .addChoices(
            {
              name: 'Working',
              value: '✅ WORKING ✅',
            },
            {
              name: 'Updating',
              value: '🔄 UPDATING 🔄',
            },
            { name: 'Server Down', value: '⛔ SERVER DOWN ⛔' },
            { name: 'Outdated', value: '❌ OUTDATED ❌' },
            {
              name: 'Detected',
              value: '🩸 DETECTED 🩸',
            }
          )
      )
  )
  .setDescription('Updates the status of the status channel.');

export async function execute(interaction: CommandInteraction) {
  const interactionOptions = interaction.options as FixedOptions;
  const value = interactionOptions.getString('status');
  interaction.deferReply({
    flags: MessageFlags.Ephemeral,
  });
  if (value == undefined || value == null) {
    return interaction.editReply({
      content: 'Error fetching status',
    });
  }
  const channel = interaction.guild?.channels.cache.find(
    (channel) => channel.id === config.STATUS_CHANNEL_ID
  );
  if (channel == undefined || channel == null) {
    return interaction.editReply({
      content: 'Error fetching channel',
    });
  }
  await channel
    .fetch()
    .then(async (ch) => {
      logger.debug(ch, 'Fetched channel');
      await ch
        .edit({
          name: value,
        })
        .then(() => {
          logger.debug('Status updated', 'Status Update');
          return interaction.editReply({
            content: `Status updated to ${value}`,
          });
        })
        .catch((err) => {
          logger.error(err, 'Error updating status');
          return interaction.editReply({
            content: 'Error updating status',
          });
        });
    })
    .catch((err) => {
      logger.error(err, 'Error fetching channel');
      return interaction.editReply({
        content: 'Error fetching channel',
      });
    })
    .finally(() => {
      logger.debug('Status update finished', 'Status Update');
    });
  logger.debug(`Status updated to ${value}`, 'Status Update');
  return;
}
