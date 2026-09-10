# Operación — Histórico de rango (Rank/LP)

Runbook para dejar OPERATIVO el histórico de rango de `/competitivo`
(`RankEvolution`). Mientras no se completen los pasos 1–5, la feature se
degrada sola sin romper nada: el endpoint responde `available:false` y el
bloque de la web no aparece.

**Stack real:** Cloudflare Pages (integración Git con
`github.com/tidusssadc/tidusss.es`), Pages Functions en `functions/`, sin
`wrangler.toml`. Variables y bindings se configuran en el **Dashboard de
Cloudflare**. `wrangler` se usa solo puntualmente vía `npx` (no es una
dependencia del proyecto).

Cada paso indica si es **[COMANDO]** (lo ejecutas tú en una terminal, con
`wrangler` autenticado) o **[DASHBOARD]** (clic en Cloudflare / GitHub).

---

## Resumen de piezas

| Pieza | Qué hace | Estado |
|---|---|---|
| `migrations/0001_rank_snapshots.sql` | Schema de la tabla `rank_snapshots` | listo, sin aplicar |
| Binding D1 `DB` | Da acceso a la base desde las Functions | **pendiente [DASHBOARD]** |
| `GET /api/riot/rank-history` | Lectura pública (solo lee D1, nunca escribe) | desplegado |
| `POST /api/riot/rank-snapshot-cron` | Observa rango y guarda snapshot si procede | desplegado |
| `RANK_SNAPSHOT_CRON_SECRET` | Protege el POST de arriba | **pendiente [DASHBOARD]** |
| `.github/workflows/rank-snapshot.yml` | Dispara el POST cada 30 min | en la rama; se activa al mergear a `main` |
| `RANK_SNAPSHOT_CRON_SECRET` (secret de repo GitHub) | Lo usa el workflow | **pendiente [DASHBOARD GitHub]** |

---

## 1. Crear la base D1 · [COMANDO]

```bash
npx wrangler d1 create tidusss-competitive
```

`wrangler` pedirá autenticación la primera vez (`wrangler login`, abre el
navegador). La salida incluye un `database_id` — cópialo para el paso 2.

> Solo una base. El nombre `tidusss-competitive` es deliberadamente
> genérico: si más adelante hay otras tablas competitivas, viven aquí, no
> en una base nueva.

## 2. Enlazar la base como binding `DB` · [DASHBOARD]

Cloudflare Dashboard → **Workers & Pages** → proyecto **tidusss-es** →
**Settings** → **Bindings** (o **Functions** → **D1 database bindings**
según versión del panel) → **Add binding**:

- **Variable name:** `DB`  ← exacto, el código busca `env.DB`
- **D1 database:** `tidusss-competitive`
- Entorno: **Production** (y **Preview** si quieres probarlo en las
  previews de rama).

Guarda. **Vuelve a desplegar** después (los bindings se aplican al
siguiente deployment, no retroactivamente): un push a `main`, o Dashboard
→ Deployments → último → **Retry deployment**.

## 3. Aplicar la migración · [COMANDO]

```bash
npx wrangler d1 execute tidusss-competitive --remote --file=migrations/0001_rank_snapshots.sql
```

`--remote` = contra la base real de Cloudflare (sin `--remote` iría a una
copia local de Miniflare). La migración es idempotente (`CREATE TABLE IF
NOT EXISTS` + `UNIQUE`): reejecutarla no rompe nada.

Verifica:

```bash
npx wrangler d1 execute tidusss-competitive --remote --command "SELECT name FROM sqlite_master WHERE type='table';"
```

Debe listar `rank_snapshots`.

## 4. Crear el secreto del cron · [DASHBOARD]

Genera un valor aleatorio largo (en tu terminal, **no lo commitees**):

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

- **Cloudflare** Dashboard → **tidusss-es** → **Settings** → **Environment
  variables** → **Add variable**:
  - Nombre: `RANK_SNAPSHOT_CRON_SECRET`
  - Valor: el generado
  - **Encrypt** (márcalo como secreto)
  - Entorno: **Production**
  - Vuelve a desplegar.

- **GitHub** → repo `tidusss.es` → **Settings** → **Secrets and variables**
  → **Actions** → **New repository secret**:
  - Nombre: `RANK_SNAPSHOT_CRON_SECRET`
  - Valor: **el mismo** valor.

El secreto vive solo server-side (Cloudflare) y en GitHub Actions (que lo
enmascara en los logs). Nunca entra al bundle del cliente ni al repo.

## 5. Activar el scheduler · [DASHBOARD GitHub, al mergear]

`.github/workflows/rank-snapshot.yml` ya está en la rama. Los workflows
programados **solo corren desde la rama por defecto** (`main`), así que se
activa cuando esta rama se mergea. Nada se dispara antes de tiempo.

Tras el merge: GitHub → **Actions** → "rank snapshot" → debería aparecer y
correr cada 30 min. Puedes lanzarlo a mano con **Run workflow**
(`workflow_dispatch`).

> **Por qué GitHub Actions y no un Worker con Cron Trigger:** el proyecto
> ya vive en GitHub, no tiene infraestructura de Workers ni `wrangler.toml`,
> y el POST protegido ya está construido y probado. Un workflow programado
> = cero recursos nuevos en Cloudflare, versionado, y se apaga borrando o
> deshabilitando el archivo. El _jitter_ de GitHub Actions (los cron
> pueden retrasarse minutos bajo carga) es irrelevante aquí: el heartbeat
> del histórico es de 6 h y las visitas a `/competitivo` también observan
> el rango de forma oportunista, así que un run tarde o saltado no deja
> hueco real. Si algún día se quiere precisión de reloj, la alternativa
> está más abajo.

## 6. Primer snapshot · [COMANDO], una vez, tras los pasos 1–4

Cuando D1 y el secreto ya estén en producción, registra el estado actual
lanzando el endpoint una vez a mano:

```bash
curl -s -X POST https://tidusss.es/api/riot/rank-snapshot-cron \
  -H "Authorization: Bearer PEGA_AQUI_EL_SECRETO"
```

Respuesta esperada (la primera vez):

```json
{ "ok": true, "data": {
  "observed": { "available": true, "tier": "MASTER", "rank": "I", "leaguePoints": 123, "wins": 200, "losses": 180, "stale": false },
  "recorded": true, "reason": "first-snapshot",
  "observedAt": "2026-09-10T09:00:00.000Z"
} }
```

> **NUNCA** insertes el primer dato con SQL a mano. El histórico empieza
> con un snapshot real de Riot, nunca reconstruido.

## 7. Verificar · [COMANDO]

```bash
# Lectura pública — tras el primer snapshot deja de ser available:false
curl -s https://tidusss.es/api/riot/rank-history | node -e "process.stdin.on('data',d=>console.log(JSON.stringify(JSON.parse(d),null,2)))"

# El cron rechaza sin/ con secreto incorrecto
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://tidusss.es/api/riot/rank-snapshot-cron            # 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://tidusss.es/api/riot/rank-snapshot-cron -H "Authorization: Bearer mal"  # 401
```

En la web: abre `/competitivo`. Con 1 snapshot el bloque muestra "rango
actual + Seguimiento desde…"; con 2+ aparece el sparkline y "Peak
observado".

Logs de producción:

```bash
npx wrangler pages deployment tail --project-name tidusss-es --environment production --search rank-snapshot-cron
```

---

## Rollback / desactivación

Ninguno es destructivo. En orden de reversibilidad:

1. **Parar de escribir:** GitHub → Actions → "rank snapshot" → **Disable
   workflow** (o borra el `.yml`). Las visitas a `/competitivo` siguen
   observando de forma oportunista; para parar también eso, ver punto 3.
2. **Ocultar el bloque de la web sin borrar datos:** Cloudflare → borra el
   binding `DB` (o la variable) y redeploya. `rank-history` vuelve a
   `available:false` y `RankEvolution` desaparece. Los datos siguen en D1
   intactos para cuando se reactive.
3. **Parar del todo la escritura oportunista:** quitar el binding `DB`
   (punto 2) ya lo hace — `functions/api/riot/overview.ts` corta antes de
   resolver nada si `!env.DB`.
4. **Borrar el histórico:** `npx wrangler d1 execute tidusss-competitive
   --remote --command "DELETE FROM rank_snapshots;"` (o `wrangler d1
   delete tidusss-competitive`). Solo si de verdad se quiere empezar de
   cero — no hay backfill posible después.

Nada de esto afecta al resto de `/competitivo` (01–05, Match History,
Timeline, Encuentros): el histórico siempre fue un extra desacoplado.

---

## Coste Riot del cron (crítico)

`POST /api/riot/rank-snapshot-cron` usa `getRiotRankObservation` — el
camino **ligero**:

| Llamada | Caché | Frecuencia real a 1 run / 30 min |
|---|---|---|
| `ACCOUNT-V1 /accounts/by-riot-id/{name}/{tag}` | 24 h | ~1 / día (compartida con todo `/api/riot/*`) |
| `LEAGUE-V4 /entries/by-puuid/{puuid}` | 10 min | ~1 / run → ~48 / día |

**NUNCA** llama a `SUMMONER-V4`, `MATCH-V5` (ids ni detalle), Match
Timeline ni Data Dragon. Hay un test de aislamiento
(`test/api/rank-snapshot-cron.test.ts`) que falla si una regresión
reintroduce cualquiera de ellas. ~48 llamadas `LEAGUE-V4` al día están muy
por debajo de cualquier límite de Riot (incluso una dev key: 100 req / 2
min).

La observación **oportunista** desde `/api/riot/overview` no añade coste:
reutiliza los datos que esa petición ya trajo para pintar la página.

Ambas vías (cron + oportunista) pasan por la misma deduplicación
(`src/lib/rank-history/dedupe.ts`): se escribe solo si tier/division/LP/
wins/losses cambiaron, o si pasaron 6 h desde el último snapshot. Una
`UNIQUE (puuid, queue_type, observed_at)` en la tabla + `INSERT OR IGNORE`
son el backstop de idempotencia para reintentos exactos.

---

## Alternativa al scheduler: Cloudflare Worker con Cron Trigger

Si se prefiere timing preciso dentro del ecosistema Cloudflare, en vez del
workflow de GitHub Actions:

`wrangler.toml` (proyecto Worker aparte, **no** el de Pages):

```toml
name = "tidusss-rank-snapshot-cron"
main = "index.js"
compatibility_date = "2025-01-01"

[triggers]
crons = ["*/30 * * * *"]
```

`index.js`:

```js
export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      fetch('https://tidusss.es/api/riot/rank-snapshot-cron', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.RANK_SNAPSHOT_CRON_SECRET}` },
      }),
    );
  },
};
```

```bash
npx wrangler deploy
npx wrangler secret put RANK_SNAPSHOT_CRON_SECRET   # pega el mismo valor
```

Este Worker no necesita binding D1 ni la API key de Riot: solo hace el
POST al endpoint ya protegido. Rollback = `npx wrangler delete`.
