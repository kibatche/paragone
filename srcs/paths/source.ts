/**
 * @author [A likely boring stuff made by] Shevek
 * @desc source.ts — Lecture du fichier source d'un lead. Le chemin vient de la base, jamais du client :
 *       c'est le fichier que le scan a enregistré pour ce lead.
 */

import { getLeadLocation } from "../db/queue";

/** Le texte entier d'un fichier et la ligne visée dans ce fichier. */
export interface SourceFile {
  file: string;
  targetLine: number;
  text: string;
}

/**
 * @brief Texte entier du fichier d'un lead, avec la ligne de son match.
 * @return null si le lead n'existe pas.
 * @throws si le fichier enregistré n'est plus lisible, avec son chemin et le lead.
 */
export async function readLeadSource(id: number): Promise<SourceFile | null> {
  const location = getLeadLocation(id);
  if (!location) return null;
  try {
    const text = await Bun.file(location.file).text();
    return { file: location.file, targetLine: location.line, text };
  } catch (error) {
    throw new Error(
      `Error [readLeadSource]: ${location.file} illisible (lead ${id}) : ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}
