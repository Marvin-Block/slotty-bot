import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Collection,
  CommandInteraction,
  ComponentType,
  EmbedBuilder,
  MessageActionRowComponentBuilder,
  MessageFlags,
} from 'discord.js';

type PaginationParams = {
  interaction: CommandInteraction;
  headers: Collection<string, string>;
  values: Collection<string, any>[];
  chunkSize?: number;
  title: string;
};

export async function paginate({
  interaction,
  headers,
  values,
  chunkSize = 5,
  title,
}: PaginationParams) {
  const responseArr: any[] = [];

  values.forEach((reminder) => {
    const partialResponseArr: string[] = [];
    headers.forEach((header, key) => {
      if (reminder.get(key) !== null) {
        let message = `${header}: ${reminder.get(key)}`;
        if (headers.last() !== header) {
          message += '\n';
        }
        partialResponseArr.push(message);
      }
    });
    responseArr.push(partialResponseArr.join(''));
  });

  const chunks: any[] = [];
  for (let i = 0; i < responseArr.length; i++) {
    if (i % chunkSize === 0) {
      const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor('#601499')
        .setDescription(
          responseArr.slice(i, i + chunkSize).join('\n────────────────\n')
        );
      chunks.push(embed);
    }
  }

  let currentPage = 0;

  const prev = new ButtonBuilder()
    .setCustomId('prev')
    .setLabel('Previous page')
    .setDisabled(true)
    .setStyle(ButtonStyle.Primary);

  const next = new ButtonBuilder()
    .setCustomId('next')
    .setLabel('Next Page')
    .setDisabled(currentPage + 1 === chunks.length)
    .setStyle(ButtonStyle.Primary);

  const page = new ButtonBuilder()
    .setCustomId('page')
    .setLabel('1 / ' + chunks.length)
    .setDisabled(true)
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder().addComponents(
    prev,
    page,
    next
  ) as ActionRowBuilder<MessageActionRowComponentBuilder>;

  const response = await interaction.reply({
    embeds: [chunks[0]],
    flags: MessageFlags.Ephemeral,
    components: [row],
    withResponse: true,
  });

  const collector = response.resource?.message?.createMessageComponentCollector(
    {
      componentType: ComponentType.Button,
      time: 3_600_000,
    }
  );

  if (collector) {
    collector.on('collect', async (i) => {
      if (i.customId === 'next') {
        if (currentPage + 1 < chunks.length) {
          currentPage++;
          prev.setDisabled(false);
          page.setLabel(`${currentPage + 1} / ${chunks.length}`);
          i.update({
            embeds: [chunks[currentPage]],
            components: [row],
            withResponse: true,
          });
        } else {
          next.setDisabled(true);
          i.update({
            components: [row],
          });
        }
      }
      if (i.customId === 'prev') {
        if (currentPage - 1 >= 0) {
          currentPage--;
          next.setDisabled(false);
          page.setLabel(`${currentPage + 1} / ${chunks.length}`);
          i.update({
            embeds: [chunks[currentPage]],
            components: [row],
            withResponse: true,
          });
        } else {
          prev.setDisabled(true);
          i.update({
            components: [row],
          });
        }
      }
    });
  }
}

export function formatDate(date: Date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
