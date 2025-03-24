import {
  CommandInteraction,
  InteractionContextType,
  SlashCommandBuilder,
} from 'discord.js';

export const type = 'slash';
export const name = 'faq';
export const allowed_servers = [
  '1074973203249770538',
  '1300479915308613702',
  '900017491554734080',
];

export const data = new SlashCommandBuilder()
  .setName('faq')
  .setContexts(InteractionContextType.Guild)
  .setDescription(
    'Sends informational text regarding some of the frequently asked questions.'
  );

export async function execute(interaction: CommandInteraction) {
  const content = `**Frequently Asked Questions**
1️⃣ **How to Install Plugins?**
Create a plugins folder in your loader directory. Add one plugin at a time.

2️⃣ **What Do Plugins Do?**
They handle champion scripts (combos, mechanics). Some add features like target selectors.

3️⃣ **Plugins for All Champions?**
No, most are covered by the core system. Check the feature list or plugin updates.

4️⃣ **Nothing Happens Before Game?**
Normal! Software activates in-game since the client and game are separate.

5️⃣ **Inject After Game Starts?**
Yes, you can inject anytime. Just reinject if already in-game.

6️⃣ **Haven’t Used It in a While?**
No stress! Slotty automates most tasks after setup.

7️⃣ **Hotkeys?**
Space - combo
Cltr+Space - full combo
Z - flee
X - lasthit
C- harras
V - waveclear
Ctrl+V - fastclear
-# all hotkeys are customizable in the settings.
`;

  return interaction.reply({
    content: content,
  });
}
