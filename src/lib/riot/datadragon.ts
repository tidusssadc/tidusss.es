import { cached } from './cache';

const FALLBACK_VERSION = '15.14.1';

export const getDataDragonVersion = async () =>
  (
    await cached(
      'riot:ddragon:version',
      6 * 60 * 60_000,
      24 * 60 * 60_000,
      async () => {
        const response = await fetch(
          'https://ddragon.leagueoflegends.com/api/versions.json',
        );
        if (!response.ok) return FALLBACK_VERSION;
        const versions = (await response.json()) as string[];
        return versions[0] || FALLBACK_VERSION;
      },
    )
  ).value;

export const dataDragonUrls = (version: string) => ({
  profileIcon: (id: number) =>
    `https://ddragon.leagueoflegends.com/cdn/${version}/img/profileicon/${id}.png`,
  champion: (name: string) =>
    `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${name}.png`,
  /** No depende de la versión: Data Dragon sirve el arte de carga sin prefijo de parche. */
  championLoading: (name: string, skinNumber = 0) =>
    `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${name}_${skinNumber}.jpg`,
  item: (id: number) =>
    `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${id}.png`,
  summonerSpell: (name: string) =>
    `https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${name}.png`,
});
