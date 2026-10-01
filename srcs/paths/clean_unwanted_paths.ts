/**
 * @author [A likely boring stuff made by] kbtch_ + Shevek
 * @desc clean_unwanted_paths.ts — enlève les js/ts inintéressant pour l'analyse, et reconnaît un
 *       contenu qui n'est pas du JavaScript.
 */
import { glob } from "node:fs/promises";
import { lstatSync, statSync } from "node:fs";

export async function cleanUnwantedPath(analyze: string) {
  const paths = new Set<string>();
  
  if (lstatSync(analyze).isFile() === true ) {
    paths.add(analyze)
    return paths
  }
  for await (const path of glob([`${analyze}/**/*.ts`, `${analyze}/**/*.js`], {
    exclude: [
      `${analyze}/**/node_modules/*`,
      `${analyze}/**/*vendor*`,
      `${analyze}/**/third_party/`,
      `${analyze}/**/bower_components/*`,
      `${analyze}/**/dist/*`,
      `${analyze}/**/*.inline.*`, //inline scripts grabbed by jxscout
    ],
  })) {
    if (isFile(path)) paths.add(path);
  }
  return paths;
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/** @brief Vrai si le contenu commence, espaces exclus, par une balise (`<!doctype`, `<html>`…). */
export function isMarkupContent(content: string): boolean {
  return content.trimStart().startsWith("<");
}
