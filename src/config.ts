import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const {
  MODE,
  DISCORD_TOKEN,
  DISCORD_CLIENT_ID,
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
} = process.env;

if (
  !MODE ||
  !DISCORD_TOKEN ||
  !DISCORD_CLIENT_ID ||
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
  !RED
) {
  throw new Error('Missing environment variables');
}

export const config = {
  MODE,
  DISCORD_TOKEN,
  DISCORD_CLIENT_ID,
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
};

async function loadSettings() {
  const settings = await prisma.settings.findMany();

  return {
    delay: parseInt(settings.find((s) => s.name === 'delay')?.value ?? '500'),
    vdfIterations: parseInt(
      settings.find((s) => s.name === 'vdfIterations')?.value ?? '5000'
    ),
    cooldown: parseInt(
      settings.find((s) => s.name === 'cooldown')?.value ?? '5000'
    ),
    cooldownEnabled: JSON.parse(
      settings.find((s) => s.name === 'cooldownEnabled')?.value ?? 'false'
    ),
  };
}

export const asyncSettings = loadSettings();
