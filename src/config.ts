import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const {
  MODE,
  DISCORD_TOKEN,
  DISCORD_CLIENT_ID,
  DISCORD_SECRET,
  BASE_PRICE,
  BTC_WALLET,
  LTC_WALLET,
  WEEK_PRICE,
  THREE_MONTH_PRICE,
  SALT,
  DEVELOPER_ID,
  CASINO_CHANNEL_ID,
  API_KEY,
  PUBLIC_KEY,
  API_BASE_URL,
  GOLD,
  BLACK,
  RED,
  PORT,
  REDIRECT_URL,
  STATUS_CHANNEL_ID,
  TIER1,
  TIER2,
  TIER3,
} = process.env;

if (
  !MODE ||
  !DISCORD_TOKEN ||
  !DISCORD_CLIENT_ID ||
  !DISCORD_SECRET ||
  !BASE_PRICE ||
  !BTC_WALLET ||
  !LTC_WALLET ||
  !WEEK_PRICE ||
  !THREE_MONTH_PRICE ||
  !SALT ||
  !DEVELOPER_ID ||
  !CASINO_CHANNEL_ID ||
  !API_KEY ||
  !PUBLIC_KEY ||
  !API_BASE_URL ||
  !GOLD ||
  !BLACK ||
  !RED ||
  !PORT ||
  !REDIRECT_URL ||
  !STATUS_CHANNEL_ID ||
  !TIER1 ||
  !TIER2 ||
  !TIER3
) {
  throw new Error("Missing environment variables");
}

export const config = {
  MODE,
  DISCORD_TOKEN,
  DISCORD_CLIENT_ID,
  DISCORD_SECRET,
  WEEK_PRICE,
  BASE_PRICE,
  THREE_MONTH_PRICE,
  BTC_WALLET,
  LTC_WALLET,
  SALT,
  DEVELOPER_ID,
  CASINO_CHANNEL_ID,
  API_KEY,
  PUBLIC_KEY,
  API_BASE_URL,
  GOLD,
  BLACK,
  RED,
  PORT,
  REDIRECT_URL,
  STATUS_CHANNEL_ID,
  TIER1,
  TIER2,
  TIER3,
};

async function loadSettings() {
  const settings = await prisma.settings.findMany();

  return {
    delay: parseInt(settings.find((s) => s.name === "delay")?.value ?? "500"),
    vdfIterations: parseInt(settings.find((s) => s.name === "vdfIterations")?.value ?? "5000"),
    cooldown: parseInt(settings.find((s) => s.name === "cooldown")?.value ?? "5000"),
    cooldownEnabled: JSON.parse(
      settings.find((s) => s.name === "cooldownEnabled")?.value ?? "false"
    ),
  };
}

export const asyncSettings = loadSettings();

// export async function loadSettings(): Promise<Settings[]> {
//   const settings = await prisma.settings.findMany();
//   return settings;
// }

// export function getSetting(settings: Settings[], name: string): Settings | undefined {
//   logger.info(`Getting setting: ${name}`);
//   return settings.find((s) => s.name === name);
// }

// export async function setSetting(
//   settings: Settings[],
//   user: string,
//   name: string,
//   value: string | number | boolean
// ): Promise<void> {
//   logger.info(`Setting ${name} to ${value}`);
//   const setting: Settings | undefined = settings.find((s) => s.name === name);
//   try {
//     if (setting) {
//       await prisma.settings.update({
//         where: { id: setting.id },
//         data: { value: value.toString(), updatedBy: user, updatedAt: new Date() },
//       });
//     } else {
//       await prisma.settings.create({
//         data: { name, value: value.toString(), createdBy: user },
//       });
//     }
//   } catch (error) {
//     logger.error(`Error setting ${name}: ${error}`);
//   }
// }

// if (!settings) {
//   throw new Error("Failed to load settings");
// }
