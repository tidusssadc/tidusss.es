import type { Patch } from '../../domain/league-laboratory';

export const patch1514: Patch = {
  id: 'patch:15-14',
  label: '15.14',
  sequence: 1,
  dataDragonVersion: '15.14.1',
  editorialSummary: 'Parche de referencia para el lanzamiento del Laboratorio.',
};

/**
 * Parche de referencia para la build, las runas y el orden de habilidades
 * de Lucian documentados por Tidusss (ver `builds.ts`/`rune-pages.ts`).
 * Sin `dataDragonVersion`/`releasedAt`: no se ha confirmado ninguno de los
 * dos y no se han consultado fuentes externas para adivinarlos.
 */
export const patch2614: Patch = {
  id: 'patch:26-14',
  label: '26.14',
  sequence: 2,
  editorialSummary:
    'Parche de referencia para la build y las runas de Lucian documentadas por Tidusss.',
};

export const leagueLaboratoryPatches: Patch[] = [patch1514, patch2614];
