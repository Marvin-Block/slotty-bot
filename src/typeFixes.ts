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
  commands: CommandCollection;
  contextMenuCommands: ContextMenuCommandCollection;
  modalCommands: Collection<string, any>;
}

export interface CommandCollection extends Collection<string, any> {
  allowed_servers: string[];
  type: string;
  name: string;
  data: any;
  allowDM?: boolean;
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

export interface TokenResponseData {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  error?: string;
  error_description?: string;
  message?: string;
  retry_after?: number;
  global?: boolean;
}

export interface UserResponseData {
  id: string;
  username: string;
  avatar: string;
  discriminator: string;
  public_flags: number;
  flags: number;
  banner: string;
  accent_color: number;
  global_name: string;
  avatar_decoration_data: {
    asset: string;
    sku_id: string;
    expires_at: string | null;
  };
  collectibles: any | null;
  banner_color: string | null;
  clan: string | null;
  primary_guild: string | null;
  mfa_enabled: boolean;
  locale: string;
  premium_type: number;
  email: string;
  verified: boolean;
  error?: string;
  error_description?: string;
  message?: string;
  retry_after?: number;
  global?: boolean;
}

export interface GuildResponseData {
  id: string;
  name: string;
  icon: string;
  banner: string | null;
  owner: boolean;
  permissions: bigint;
  permissions_new: string;
  error?: string;
  error_description?: string;
  message?: string;
  retry_after?: number;
  global?: boolean;
}

export interface ConnectionResponseData {
  id: string;
  name: string;
  type: string;
  friend_sync: boolean;
  metadata_visibility: number;
  show_activity: boolean;
  two_way_link: boolean;
  verified: boolean;
  visibility: number;
  error?: string;
  error_description?: string;
  message?: string;
  retry_after?: number;
  global?: boolean;
}
