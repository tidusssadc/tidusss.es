-- Night Shift 2026-09-09 — histórico de rango observado (Solo/Duo).
--
-- NO se ejecuta automáticamente. Pasos humanos (guía completa en
-- docs/operations/rank-history.md):
--   1. npx wrangler d1 create tidusss-competitive
--   2. Enlazar la base resultante al proyecto de Cloudflare Pages como
--      binding `DB` (Dashboard → Workers & Pages → tidusss-es → Settings
--      → Bindings → D1 database bindings → Add: Variable name `DB`).
--   3. npx wrangler d1 execute tidusss-competitive --remote \
--        --file=migrations/0001_rank_snapshots.sql
--
-- Sin este paso, `src/lib/rank-history` se degrada honestamente: el
-- histórico se reporta como "no configurado", nunca se inventa ni se
-- simula con memoria. Migración pensada para una base NUEVA (D1 todavía
-- sin aprovisionar); toda ella es idempotente (`IF NOT EXISTS`), así que
-- reejecutarla contra la misma base es seguro y no hace nada.

CREATE TABLE IF NOT EXISTS rank_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  puuid TEXT NOT NULL,
  queue_type TEXT NOT NULL,
  tier TEXT,
  rank TEXT,
  league_points INTEGER,
  wins INTEGER NOT NULL,
  losses INTEGER NOT NULL,
  -- ISO 8601 UTC (siempre `...Z`). Orden lexicográfico == orden
  -- cronológico, por eso las consultas ordenan por esta columna TEXT
  -- directamente sin conversión.
  observed_at TEXT NOT NULL,
  source TEXT NOT NULL,

  -- Idempotencia (encargo cierre §16): dos disparos del cron/overview que
  -- reintenten LA MISMA observación (mismo instante exacto) no pueden
  -- duplicar fila — `INSERT OR IGNORE` en el repositorio la descarta en
  -- silencio. El caso de dos escrituras casi-simultáneas con timestamps
  -- de milisegundo distintos ya lo evita la política de deduplicación de
  -- `dedupe.ts` (solo se escribe si el estado cambió o venció el
  -- heartbeat de 6h); una fila redundante residual sería inofensiva
  -- (misma tier/division → nunca una transición falsa, nunca un peak
  -- falso). No se montan locks distribuidos para un caso así.
  UNIQUE (puuid, queue_type, observed_at)
);

-- El índice implícito de la restricción UNIQUE de arriba
-- (puuid, queue_type, observed_at) ya cubre el único patrón de consulta
-- real: snapshots de una cuenta+cola ordenados por tiempo (listado
-- reciente, primero observado, último, dedupe, peak). No se añade un
-- segundo índice — sería redundante (encargo §31, nunca sobreindexar).
