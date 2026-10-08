/**
 * @author [A likely boring stuff made by] Shevek
 * @desc seed.ts : Base jetable pour les tests : un dossier temporaire devient le dossier courant avant
 *       tout import de `db/` et la config y est chargée (`config.paragone_project_path`), puis un corpus y est scanné.
 */

import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * @brief Crée un projet jetable et s'y place. À appeler avant tout import de `db/`.
 * @return Le dossier du projet.
 */
export async function enterTempProject(): Promise<string> {
  const root = mkdtempSync(join(tmpdir(), "paragone-test-"));
  mkdirSync(join(root, ".paragone"));
  process.chdir(root);
  const { loadConfig } = await import("../../config/config");
  await loadConfig({ paragone_project_path: root });
  return root;
}

/**
 * @brief Refuse de continuer si `db/` a été importé avant `enterTempProject`, ce qui pointerait les
 *        tests vers la vraie base du projet.
 * @throws si le dossier du projet servi par `db/` n'est pas le dossier courant.
 */
export async function assertIsolated(): Promise<void> {
  const { getProjectInfo } = await import("../db");
  const { root } = getProjectInfo();
  if (root === process.cwd()) return;
  throw new Error(
    `Error [assertIsolated]: db/ pointe vers ${root} et non vers le dossier jetable ${process.cwd()} : lancer les tests avec \`bun run test\` (--isolate).`,
  );
}

/** @brief Analyse chaque .js du dossier, par chemin, et inscrit les résultats en base. */
export async function seedCorpus(dir: string): Promise<void> {
  const { analyzeFile } = await import("../../analyze/analyzer");
  const { saveFileScan } = await import("../scan");
  const paths = [
    ...new Bun.Glob("**/*.js").scanSync({ cwd: dir, absolute: true }),
  ].sort();
  for (const path of paths) {
    const text = await Bun.file(path).text();
    saveFileScan({
      path,
      sha256: new Bun.CryptoHasher("sha256").update(text).digest("hex"),
      status: "ok",
      matches: await analyzeFile(path),
    });
  }
}
