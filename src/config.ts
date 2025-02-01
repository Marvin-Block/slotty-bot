import dotenv from "dotenv";

dotenv.config({path: ".env", debug:true});

const { DISCORD_TOKEN, DISCORD_CLIENT_ID, BASE_PRICE, BTC_WALLET, LTC_WALLET } = process.env;

if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID || !BASE_PRICE || !BTC_WALLET || !LTC_WALLET) {
  throw new Error("Missing environment variables");
}

export const config = {
  DISCORD_TOKEN,
  DISCORD_CLIENT_ID,
  BASE_PRICE,
  BTC_WALLET,
  LTC_WALLET,
};

