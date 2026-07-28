export const platforms = {
  youtube: {
    url: 'https://www.youtube.com/@tidussstwitch',
    handle: 'tidussstwitch',
    channelId: 'UCk3-zIWTjiK_XICSSxkVwIw',
  },
  instagram: {
    url: 'https://www.instagram.com/tidussstwitch/',
  },
  twitch: {
    url: 'https://www.twitch.tv/tidussstwitch',
    handle: 'tidussstwitch',
  },
  x: {
    url: 'https://x.com/TidusssTwitch',
  },
  discord: {
    url: 'https://discord.com/invite/QwR8AEKY9Q',
  },
} as const;

export const integrationEndpoints = {
  youtube: '/api/youtube',
  youtubeStats: '/api/youtube/channel-stats',
  riot: '/api/riot/overview',
  twitch: '/api/twitch/status',
} as const;
