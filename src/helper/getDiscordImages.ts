const icons = 'https://cdn.discordapp.com/icons/{{serverid}}/{{iconid}}.webp';
const avatars =
  'https://cdn.discordapp.com/avatars/{{userid}}/{{avatarid}}.webp?size=1024';
const banners =
  'https://cdn.discordapp.com/banners/{{userid}}/{{bannerid}}.webp?size=1024';

export function getIcon(serverid: string, iconid: string): string {
  return icons.replace('{{serverid}}', serverid).replace('{{iconid}}', iconid);
}

export function getAvatar(userid: string, avatarid: string): string {
  return avatars
    .replace('{{userid}}', userid)
    .replace('{{avatarid}}', avatarid);
}

/**
 * @param id - userID or serverID
 */
export function getBanner(id: string, bannerid: string): string {
  return banners.replace('{{userid}}', id).replace('{{bannerid}}', bannerid);
}
