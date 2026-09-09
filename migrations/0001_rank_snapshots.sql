-- Night Shift 2026-09-09 — histórico de rango observado (Solo/Duo).
--
-- NO se ejecuta automáticamente. Paso humano pendiente (ver
-- docs/night-shift/2026-09-09.md e informe de entrega):
--   1. wrangler d1 create tidusss-rank-history
--   2. Enlazar la base de datos resultante al proyecto de Cloudflare
--      Pages como binding `DB` (dashboard → Settings → Functions →
--      D1 database bindings, o wrangler.toml si el proyecto adopta uno).
--   3. wrangler d1 execute tidusss-rank-history --file=migrations/0001_rank_snapshots.sql --remote
--
-- Sin este paso, `src/lib/rank-history` se degrada honestamente: el
-- histórico se reporta como "no configurado", nunca se inventa ni se
-- simula con memoria (encargo Night Shift §15).

CREATE TABLE IF NOT EXISTS rank_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  puuid TEXT NOT NULL,
  queue_type TEXT NOT NULL,
  tier TEXT,
  rank TEXT,
  league_points INTEGER,
  wins INTEGER NOT NULL,
  losses INTEGER NOT NULL,
  observed_at TEXT NOT NULL,
  source TEXT NOT NULL
);

-- Único patrón de consulta real hoy: snapshots de una cuenta+cola
-- ordenados por tiempo (listado reciente, primero observado, dedupe).
-- Un solo índice cubre los tres — nunca sobreindexar (encargo §31).
CREATE INDEX IF NOT EXISTS idx_rank_snapshots_puuid_queue_observed
  ON rank_snapshots (puuid, queue_type, observed_at);
