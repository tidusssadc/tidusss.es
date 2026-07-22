export const platforms = {
  youtube: {
    url: 'https://www.youtube.com/@tidussstwitch',
    handle: 'tidussstwitch',
    channelId: 'UCIZS6HbLtXnAReUOxyLMCsb',
  },
  instagram: {
    url: 'https://www.instagram.com/tidussstwitch/',
  },
  twitch: {
    url: 'https://www.twitch.tv/tidussstwitch',
  },
} as const;

export const integrationEndpoints = {
  youtube: '/api/youtube',
  riot: '/api/riot/overview',
} as const;
