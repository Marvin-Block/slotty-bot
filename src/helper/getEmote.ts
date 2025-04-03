export function getEmote(emoteString: string) {
  const emote = emoteString.match(/(<a?)?:\w+:(\d{18,19}>)?/g);
  if (!emote) {
    return {
      fullString: '',
      name: '',
      id: '',
      gif: false,
    };
  }
  const cleanEmoteString = emote[0].replaceAll(/<|>/gm, '');
  const emoteName = cleanEmoteString.split(':')[1];
  const emoteId = cleanEmoteString.split(':')[2];
  const isAnimated = cleanEmoteString.split(':')[0] === 'a';
  return {
    fullString: emote[0],
    name: emoteName,
    id: emoteId,
    gif: isAnimated,
  };
}
