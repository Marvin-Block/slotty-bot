import {
  AttachmentBuilder,
  Message,
  OmitPartialGroupDMChannel,
  User,
  MessageFlags,
} from "discord.js";
import { PrismaClient } from "@prisma/client";
import { AuditRecord, SecureRandomGenerator } from "../secure_random_number";
import { asyncSettings } from "../config";

const prisma = new PrismaClient();
const secRand = new SecureRandomGenerator();
const salute = "<:salute:1335591427031306342>";
const loadSalute = "<a:load_salute:1342202643484774400>";
const slotty = "<:slotty:1336010394829066240>";
const slottyGif = "<a:slotty_gif:1336009659399802900>";

export async function run(
  message: OmitPartialGroupDMChannel<Message<boolean>>
) {
  const settings = await asyncSettings;

  if (!message.content.startsWith(salute) || message.author.bot) return;
  if (settings.cooldownEnabled) {
    const user = await prisma.user.findFirst({
      where: { discordID: message.author.id },
    });
    if (user) {
      const lastSalute = await prisma.salute.findFirst({
        where: { userID: user.id },
        orderBy: { createdAt: "desc" },
      });

      const time1 = lastSalute?.createdAt;
      const time2 = new Date();
      const diff = Math.abs(time2.getTime() - time1!.getTime());
      console.log(diff, lastSalute?.id);
      if (diff < settings.cooldown) {
        console.log("Cooldown limiting");
        return;
      }
    }
  }

  const sentMessage = await message.reply(loadSalute);
  const channelMessages = await message.channel.fetch();
  const msg = channelMessages.messages.cache.get(sentMessage.id)!;

  let rng = await secRand.generateSecureRandom(0, 1000);

  if (rng.number == 0 || rng.number == 1000) {
    // Rarity 4 - Mythical - 0.2%
    addToDB(message.author, 4, rng.auditRecord);
    const attachment = new AttachmentBuilder("./assets/supreme_salute.gif");
    setTimeout(() => {
      msg.edit({ content: "", files: [attachment] });
    }, settings.delay);
  } else if (rng.number >= 495 && rng.number <= 505) {
    // Rarity 3 - Legendary - 1%
    addToDB(message.author, 3, rng.auditRecord);

    setTimeout(() => {
      msg.edit(slottyGif);
      setTimeout(() => {
        msg.edit(slottyGif + slottyGif);
        setTimeout(() => {
          msg.edit(slottyGif + slottyGif + slottyGif);
          setTimeout(() => {
            msg.edit(
              slottyGif +
                slottyGif +
                slottyGif +
                "\n" +
                slottyGif +
                salute +
                slottyGif
            );
            setTimeout(() => {
              msg.edit(
                slottyGif +
                  slottyGif +
                  slottyGif +
                  "\n" +
                  slottyGif +
                  salute +
                  slottyGif +
                  "\n" +
                  slottyGif +
                  slottyGif +
                  slottyGif
              );
            }, settings.delay);
          }, settings.delay);
        }, settings.delay);
      }, settings.delay);
    }, settings.delay);
  } else if (
    (rng.number >= 470 && rng.number <= 494) ||
    (rng.number >= 506 && rng.number <= 530)
  ) {
    // Rarity 2 - Epic - 5%
    addToDB(message.author, 2, rng.auditRecord);
    setTimeout(() => {
      msg.edit(salute);
      setTimeout(() => {
        msg.edit(salute + slottyGif);
        setTimeout(() => {
          msg.edit(salute + slottyGif + slottyGif);
          setTimeout(() => {
            msg.edit(salute + slottyGif + slottyGif + slottyGif);
          }, settings.delay);
        }, settings.delay);
      }, settings.delay);
    }, settings.delay);
  } else if (
    (rng.number >= 395 && rng.number <= 469) ||
    (rng.number >= 531 && rng.number <= 605)
  ) {
    // Rarity 1 - Rare - 15%
    addToDB(message.author, 1, rng.auditRecord);
    setTimeout(() => {
      msg.edit(salute);
      setTimeout(() => {
        msg.edit(salute + slottyGif);
      }, settings.delay);
    }, settings.delay);
  } else {
    // Rarity 0 - Normal - 78.8%
    addToDB(message.author, 0, rng.auditRecord);
    setTimeout(() => {
      msg.edit(salute);
      setTimeout(() => {
        msg.edit(salute + slotty);
      }, settings.delay);
    }, settings.delay);
  }
}

async function addToDB(
  discordUser: User,
  pull: number,
  auditRecord: AuditRecord
): Promise<boolean> {
  try {
    const user = await prisma.user.findFirst({
      where: { discordID: discordUser.id },
    });
    if (!user) {
      const result = await prisma.user.create({
        data: {
          discordID: discordUser.id,
          salutes: {
            create: {
              audit: {
                connect: {
                  id: auditRecord.id,
                },
              },
              rarity: pull,
            },
          },
        },
      });
      console.log(`Added Salute for ${result.discordID} with rarity ${pull}`);
    } else {
      const result = await prisma.user.update({
        where: { discordID: discordUser.id },
        data: {
          salutes: {
            create: {
              audit: {
                connect: {
                  id: auditRecord.id,
                },
              },
              rarity: pull,
            },
          },
        },
      });
      console.log(`Added Salute for ${result.discordID} with rarity ${pull}`);
    }
    await prisma.$disconnect();
    return true;
  } catch (e) {
    console.error(e);
    await prisma.$disconnect();
    return false;
  }
}
