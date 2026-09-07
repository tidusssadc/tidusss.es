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

/**
 * Parche en el que Tidusss grabó y analizó por primera vez su Tier List
 * ADC actual (vídeo: "La TIER LIST de ADCs que jugaría para SUBIR ELO").
 */
export const patch2616: Patch = {
  id: 'patch:26-16',
  label: '26.16',
  sequence: 3,
  editorialSummary:
    'Parche en el que Tidusss grabó su análisis actual de la Tier List ADC.',
};

/**
 * Parche vigente hoy en la Tier List ADC. Tidusss confirma que su criterio
 * no ha cambiado entre 26.16 y 26.17 — por eso `officialAdcTierList` marca
 * `patchId: patch2617.id` (la edición vigente) y `basedOnPatchId:
 * patch2616.id` (de dónde procede el análisis), en vez de duplicar la
 * clasificación completa para un parche sin cambios reales.
 */
export const patch2617: Patch = {
  id: 'patch:26-17',
  label: '26.17',
  sequence: 4,
  editorialSummary:
    'Parche vigente de la Tier List ADC: sin cambios respecto al análisis de 26.16.',
};

export const leagueLaboratoryPatches: Patch[] = [
  patch1514,
  patch2614,
  patch2616,
  patch2617,
];
