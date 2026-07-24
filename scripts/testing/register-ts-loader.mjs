/**
 * Se pasa a `node --import` para que los tests puedan importar los archivos
 * de dominio TAL CUAL están escritos, sin modificarlos: cuando un import
 * relativo extensionless falla con la resolución nativa de Node, reintenta
 * en dos formas, igual que Node ya hace para `.js`/`.mjs`:
 *   1. como archivo: `./types` -> `./types.ts`
 *   2. como directorio (barrel): `../league-laboratory` -> `../league-laboratory/index.ts`
 * Node 22+ ya ejecuta `.ts` de forma nativa (type-stripping) cuando la
 * extensión es explícita — este hook solo cubre la resolución de
 * especificadores extensionless, que es una convención ya establecida en
 * `src/domain` (barrels incluidos) y que no tiene sentido reescribir solo
 * para los tests.
 *
 * Usa `module.registerHooks()` (no el `module.register()` con hilo de
 * hooks aparte, marcado `@deprecated` en `@types/node`): al ser síncrono y
 * en el mismo proceso, no hace falta un segundo archivo cargado en un hilo
 * distinto. No es un transpilador ni un bundler: no reescribe código, solo
 * resuelve especificadores. Cero dependencias — solo la API nativa de Node.
 */
import { registerHooks } from 'node:module';

const KNOWN_EXTENSIONS = /\.(m|c)?[jt]sx?$|\.json$|\.node$/i;

registerHooks({
  resolve(specifier, context, nextResolve) {
    const isRelative =
      specifier.startsWith('./') || specifier.startsWith('../');
    const hasExtension = KNOWN_EXTENSIONS.test(specifier);
    if (!isRelative || hasExtension) {
      return nextResolve(specifier, context);
    }
    try {
      return nextResolve(specifier, context);
    } catch {
      try {
        return nextResolve(`${specifier}.ts`, context);
      } catch {
        return nextResolve(`${specifier}/index.ts`, context);
      }
    }
  },
});
