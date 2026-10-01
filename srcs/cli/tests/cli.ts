/**
 * @author [A likely boring stuff made by] Shevek
 * @desc cli.ts — Lance la vraie CLI dans un dossier donné, pour les tests, et rend son code de sortie et ses
 *       sorties.
 */

import { join } from "node:path";

export const CLI = join(import.meta.dir, "..", "..", "..", "paragone.ts");

export function runIn(cwd: string, args: string[]) {
  const result = Bun.spawnSync([process.execPath, CLI, ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    code: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}
