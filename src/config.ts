import dotenv from "dotenv";

dotenv.config({path: ".env", debug:true});

const { DISCORD_TOKEN, DISCORD_CLIENT_ID, BASE_PRICE, BTC_WALLET, LTC_WALLET, WEEK_PRICE, THREE_MONTH_PRICE, SALT } = process.env;

if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID || !BASE_PRICE || !BTC_WALLET || !LTC_WALLET || !WEEK_PRICE || !THREE_MONTH_PRICE || !SALT) {
  throw new Error("Missing environment variables");
}

export const config = {
  DISCORD_TOKEN,
  DISCORD_CLIENT_ID,
  WEEK_PRICE,
  BASE_PRICE,
  THREE_MONTH_PRICE,
  BTC_WALLET,
  LTC_WALLET,
  SALT,
};

