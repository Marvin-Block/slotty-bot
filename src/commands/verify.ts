import {
  CommandInteraction,
  InteractionContextType,
  SlashCommandBuilder,
} from 'discord.js';

export const type = 'slash';
export const name = 'verify';
export const allowed_servers = [
  '1074973203249770538',
  '1300479915308613702',
  '900017491554734080',
];

export const data = new SlashCommandBuilder()
  .setName('verify')
  .setContexts(InteractionContextType.Guild)
  .setDescription('Sends the guidelines for verification.');

export async function execute(interaction: CommandInteraction) {
  const content = `# 🛂 GUIDELINES

To verify, send the following:

> **First, 2 pictures of the ID itself (front and back) **
> **Second, a picture of you holding your ID and a paper which reads [ current date ] + "slotted.cc" **

3 pictures in total
ID = Drivers license/passport
`;

  return interaction.reply({
    content: content,
  });
}
