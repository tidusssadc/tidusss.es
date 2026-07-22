import type { TwitchStatus } from '../types/platforms';

export interface TwitchEnvironment {
  TWITCH_CLIENT_ID?: string;
  TWITCH_CLIENT_SECRET?: string;
  TWITCH_USER_LOGIN?: string;
}
let tokenCache:
  { value: string; expires: number; clientId: string } | undefined;

const reportTwitchFailure = (phase: 'oauth' | 'helix', status: number) => {
  console.error('[twitch-integration]', {
    phase,
    status,
    code:
      phase === 'oauth'
        ? status === 429
          ? 'TWITCH_RATE_LIMIT'
          : 'TWITCH_TOKEN_FAILED'
        : status === 429
          ? 'TWITCH_RATE_LIMIT'
          : status === 401 || status === 403
            ? 'TWITCH_AUTH_FAILED'
            : 'TWITCH_UNAVAILABLE',
  });
};

const token = async (env: Required<TwitchEnvironment>) => {
  if (
    tokenCache &&
    tokenCache.clientId === env.TWITCH_CLIENT_ID &&
    tokenCache.expires > Date.now()
  )
    return tokenCache.value;
  const params = new URLSearchParams({
    client_id: env.TWITCH_CLIENT_ID,
    client_secret: env.TWITCH_CLIENT_SECRET,
    grant_type: 'client_credentials',
  });
  const response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  if (!response.ok) {
    reportTwitchFailure('oauth', response.status);
    throw new Error(
      response.status === 429 ? 'TWITCH_RATE_LIMIT' : 'TWITCH_TOKEN_FAILED',
    );
  }
  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!payload.access_token) throw new Error('TWITCH_TOKEN_FAILED');
  tokenCache = {
    value: payload.access_token,
    clientId: env.TWITCH_CLIENT_ID,
    expires:
      Date.now() + Math.max(60, (payload.expires_in ?? 3600) - 300) * 1000,
  };
  return tokenCache.value;
};

export const getTwitchStatus = async (
  env: Required<TwitchEnvironment>,
): Promise<TwitchStatus> => {
  const accessToken = await token(env);
  const params = new URLSearchParams({ user_login: env.TWITCH_USER_LOGIN });
  const response = await fetch(
    `https://api.twitch.tv/helix/streams?${params}`,
    {
      headers: {
        'Client-Id': env.TWITCH_CLIENT_ID,
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
  if (!response.ok) {
    reportTwitchFailure('helix', response.status);
    throw new Error(
      response.status === 429
        ? 'TWITCH_RATE_LIMIT'
        : response.status === 401 || response.status === 403
          ? 'TWITCH_AUTH_FAILED'
          : 'TWITCH_UNAVAILABLE',
    );
  }
  const payload = (await response.json()) as {
    data?: Array<{
      title?: string;
      game_name?: string;
      viewer_count?: number;
      started_at?: string;
      thumbnail_url?: string;
    }>;
  };
  const stream = payload.data?.[0];
  const updatedAt = new Date().toISOString();
  if (!stream) return { isLive: false, state: 'offline', updatedAt };
  return {
    isLive: true,
    state: 'online',
    title: stream.title,
    category: stream.game_name,
    viewerCount: stream.viewer_count,
    startedAt: stream.started_at,
    thumbnailUrl: stream.thumbnail_url
      ?.replace('{width}', '640')
      .replace('{height}', '360'),
    updatedAt,
  };
};
