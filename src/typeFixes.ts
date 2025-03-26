import {
  Client,
  Collection,
  CommandInteraction,
  CommandInteractionOptionResolver,
} from 'discord.js';
import { Options } from 'node-html-to-image/dist/types';

export interface FixedOptions extends CommandInteractionOptionResolver {
  options: CommandInteractionOptionResolver;
}

export interface ExtendedClient extends Client {
  commands: Collection<string, any>;
  contextMenuCommands: Collection<string, any>;
  modalCommands: Collection<string, any>;
}

export interface CommandCollection extends Collection<string, any> {
  allowed_servers: string[];
  type: string;
  name: string;
  data: any;
  execute: (interaction: CommandInteraction) => Promise<void>;
}

export interface ContextMenuCommandCollection extends Collection<string, any> {
  allowed_servers: string[];
  type: string;
  name: string;
  contextMenuData: any;
  contextMenuExecute: (interaction: CommandInteraction) => Promise<void>;
}

export interface FixedImageOptions extends Options {
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
  slottedCoins: number;
  subTime: string;
}

export interface LicenseInfo {
  licenseString: string;
  active: boolean;
  valid: boolean;
  daysLeft: number;
  daysValid: number;
  dateActivated: string;
}
