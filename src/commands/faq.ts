import {
  CommandInteraction,
  InteractionContextType,
  SlashCommandBuilder,
} from 'discord.js';

export const type = 'slash';

export const data = new SlashCommandBuilder()
  .setName('faq')
  .setContexts(InteractionContextType.Guild)
  .setDescription(
    'Sends informational text regarding some of the frequently asked questions.'
  );

export async function execute(interaction: CommandInteraction) {
  const content = `**Frequently Asked Questions**
1. How do I install plugins?
Create a folder named "plugins" in the same directory as your loader. Place the desired plugin inside the folder, but make sure to put only one plugin at a time.

2. What do the plugins do?
Plugins mainly handle champion-specific scripts like combos and mechanics. Some plugins also include features like target selectors, though many of these functions are already built into the core system.

3. Do I need plugins for all champions?
No. Many champions are already supported by the core system. You can check the feature-list to see which champions are covered. If your champion isn’t listed, look in the ✅plugin-updates channel to see if an SDK developer has created a plugin for it.

5. Is it normal that nothing happens before the game starts?
Yes, that's normal. The software injects when the game starts. The client and the game are separate, so you won’t see any changes until you're in-game.

6. Can I inject the software after the game has already started?
Yes, you can inject anytime in-game. If you're already playing, you can simply reinject without restarting the game.

7. What if I haven't used this kind of software in a while?
No worries! Just follow the steps above. Slotty is premium software and will handle most of the work automatically once set up.

8. What are the hotkeys?
Z - Flee
X - Lasthit
CTRL + X - Freeze
C - Harass
V - Waveclear
CTRL + V - Fastclear
SPACE - Combo
CTRL + SPACE - Full Combo
**K - Toggle evade**

9. Can i change the hotkeys?
Currently no.

`;

  return interaction.reply({
    content: content,
  });
}
