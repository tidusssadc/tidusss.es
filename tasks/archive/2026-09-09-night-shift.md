# 2026-09-09 — Night Shift: histórico de rango + Encuentros PRO/STREAMER

**Rama:** `night-shift/2026-09-09` · **Base:** `c6c29d9` · **Cierre:** `10575c4` · **Sin merge a `main`.**

## Objetivo

Sesión autónoma multifase sobre `/competitivo`: persistencia de rango/LP (diseño + V1 +
UI de evolución), Encuentros PRO/STREAMER V1 reutilizando el Identity Registry, hardening de
coste Riot y accesibilidad. Después: dejar la feature de histórico OPERATIVA o 100% preparada
para aprovisionamiento humano de D1 + scheduler.

## Resultado

- `src/lib/rank-history/` completo (dominio → repositorio → adaptador D1), `GET /api/riot/rank-history`,
  `POST /api/riot/rank-snapshot-cron` (camino ligero: solo ACCOUNT-V1 + LEAGUE-V4), `RankEvolution.astro`,
  `migrations/0001_rank_snapshots.sql` (con `UNIQUE` de idempotencia). Tests verdes.
- Encuentros PRO/STREAMER V1: badge en `MatchExpanded` por PUUID exacto, +0 llamadas Riot.
- Bug crítico corregido: el cron llamaba a `getRiotOverview` entero (arrastraba hasta 30 Match-V5).
- `docs/operations/rank-history.md` (runbook), `.github/workflows/rank-snapshot.yml` (scheduler, inerte hasta merge),
  `.env.example` (`RANK_SNAPSHOT_CRON_SECRET`).

## Pendiente (decisión / acción humana)

- Aprovisionar D1 `tidusss-competitive` + binding `DB` + migración + secreto → `docs/operations/rank-history.md`.
- Mergear la rama a `main` (activa el scheduler).

## Detalle completo

Journal fase a fase: **`docs/night-shift/2026-09-09.md`**.
