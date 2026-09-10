import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Guardián de la documentación para agentes (encargo "PROJECT AGENT SYSTEM" §20).
 * Usa solo `node:fs`/`node:path` — infraestructura ya presente, sin dependencia nueva.
 *
 * 1. Todos los enlaces internos relativos de CLAUDE.md, docs/agent/**, tasks/** y
 *    las plantillas de .github/ resuelven a un archivo/carpeta real.
 * 2. Invariantes mínimas de contenido que, si se rompen, indican drift peligroso.
 */

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const DOC_FILES = [
  'CLAUDE.md',
  'README.md',
  'docs/agent/README.md',
  'docs/agent/PRODUCT.md',
  'docs/agent/ARCHITECTURE.md',
  'docs/agent/DESIGN.md',
  'docs/agent/CURRENT_STATE.md',
  'docs/agent/RULES.md',
  'docs/agent/WORKFLOW.md',
  'tasks/README.md',
  'tasks/current.md',
  'tasks/archive/README.md',
  'tasks/archive/2026-09-09-night-shift.md',
  '.github/pull_request_template.md',
  '.github/ISSUE_TEMPLATE/task.md',
];

const LINK_RE = /\[[^\]]*\]\(([^)]+)\)/g;

const isExternal = (target: string) =>
  /^(https?:|mailto:|#)/.test(target);

const collectLinks = (relPath: string): string[] => {
  const body = readFileSync(join(repoRoot, relPath), 'utf8');
  const out: string[] = [];
  for (const match of body.matchAll(LINK_RE)) {
    const raw = match[1]!.trim();
    if (isExternal(raw)) continue;
    // quita el ancla (#seccion) y comillas de title opcionales
    const target = raw.split('#')[0]!.split(/\s+/)[0]!.replace(/['"]/g, '');
    if (target) out.push(target);
  }
  return out;
};

test('todos los archivos de documentación de agente existen', () => {
  for (const f of DOC_FILES) {
    assert.ok(existsSync(join(repoRoot, f)), `falta ${f}`);
  }
});

test('todos los enlaces internos relativos de la documentación de agente resuelven', () => {
  const broken: string[] = [];
  for (const f of DOC_FILES) {
    const baseDir = dirname(join(repoRoot, f));
    for (const target of collectLinks(f)) {
      const resolved = resolve(baseDir, target);
      // acepta tanto el path exacto como el path con/sin barra final
      const ok =
        existsSync(resolved) ||
        (resolved.endsWith('/') && existsSync(resolved.slice(0, -1)));
      if (!ok) broken.push(`${f} → ${target}`);
    }
  }
  assert.deepEqual(broken, [], `enlaces rotos:\n${broken.join('\n')}`);
});

test('CLAUDE.md fija la identidad: Master EUW ADC main, y Lucian NO es OTP global', () => {
  const claude = readFileSync(join(repoRoot, 'CLAUDE.md'), 'utf8');
  assert.match(claude, /Master/);
  assert.match(claude, /ADC/);
  assert.match(claude, /OTP/i);
  assert.match(claude, /NO es/i);
});

test('CURRENT_STATE.md lleva "Last verified commit" y "Last verified date"', () => {
  const cs = readFileSync(join(repoRoot, 'docs/agent/CURRENT_STATE.md'), 'utf8');
  assert.match(cs, /Last verified commit/);
  assert.match(cs, /Last verified date/);
});

test('CURRENT_STATE.md refleja que D1 ya está aprovisionada y que el histórico empieza en el primer snapshot real', () => {
  const cs = readFileSync(join(repoRoot, 'docs/agent/CURRENT_STATE.md'), 'utf8');
  assert.match(cs, /D1/);
  assert.match(cs, /aprovisionad/i);
  // La regla dura de RULES.md §DATOS: el histórico nunca se reconstruye hacia atrás.
  assert.match(cs, /nunca se reconstruye|empieza en el primer snapshot real/i);
});

test('tasks/current.md sigue siendo una plantilla neutra (sin tarea activa commiteada)', () => {
  const cur = readFileSync(join(repoRoot, 'tasks/current.md'), 'utf8');
  assert.match(cur, /Plantilla neutra/i);
});

test('cada .md de docs/agent está referenciado desde CLAUDE.md o docs/agent/README.md', () => {
  const claude = readFileSync(join(repoRoot, 'CLAUDE.md'), 'utf8');
  const agentReadme = readFileSync(join(repoRoot, 'docs/agent/README.md'), 'utf8');
  const haystack = claude + '\n' + agentReadme;
  const agentDir = join(repoRoot, 'docs/agent');
  for (const name of readdirSync(agentDir)) {
    if (!name.endsWith('.md') || name === 'README.md') continue;
    if (!statSync(join(agentDir, name)).isFile()) continue;
    assert.ok(
      haystack.includes(name),
      `docs/agent/${name} no se enlaza desde CLAUDE.md ni docs/agent/README.md`,
    );
  }
});
