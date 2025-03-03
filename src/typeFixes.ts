import {
  Client,
  Collection,
  CommandInteractionOptionResolver,
} from 'discord.js';
import { Options } from 'node-html-to-image/dist/types';

export interface fixedOptions extends CommandInteractionOptionResolver {
  options: CommandInteractionOptionResolver;
}

export interface extendedClient extends Client {
  commands: Collection<string, any>;
  contextMenuCommands: Collection<string, any>;
}

export interface fixedImageOptions extends Options {
  handlebarsHelpers?: {
    [helpers: string]: (...args: any[]) => any;
  };
}

export interface BlacklistRecord {
  createdAt: Date;
  id: number;
  discordID: string;
  reason: string;
  active: number;
  updatedBy: string;
  updatedAt: Date;
}

export interface SaluteUser {
  place: number;
  discordID: string;
  nickname: string;
  avatarUrl: string;
  total: number;
  normal: number;
  rare: number;
  epic: number;
  legendary: number;
  mythic: number;
}
