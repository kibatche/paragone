/**
 * @author [A likely boring stuff made by] Shevek
 * @desc editor.ts — Ouvre un fichier du projet dans l'éditeur local (VSCodium par défaut), à la
 *       ligne et à la colonne d'un lead. Le chemin vient toujours de la base, jamais du client.
 */
import { execFile } from "node:child_process";
import { DEFAULT_EDITOR_COMMAND, EDITOR_COMMAND_ENV } from "./constants";

/**
 * @brief Arguments de `--goto` : `fichier:ligne:colonne`, colonne 1-indexée comme l'attend
 *        l'éditeur, alors que Babel la donne 0-indexée.
 */
export function gotoArgs(file: string, line: number, column: number): string[] {
  return ["--goto", `${file}:${line}:${column + 1}`];
}

/** @brief Commande de l'éditeur : la variable d'environnement si posée, sinon `codium`. */
export function editorCommand(): string {
  return process.env[EDITOR_COMMAND_ENV] || DEFAULT_EDITOR_COMMAND;
}

/**
 * @brief Lance l'éditeur sans shell ; la promesse se résout quand la commande a rendu la main.
 * @throws si la commande est introuvable ou échoue, avec la commande et sa sortie d'erreur.
 */
export function openInEditor(
  file: string,
  line: number,
  column: number,
): Promise<void> {
  const command = editorCommand();
  return new Promise((resolvePromise, reject) => {
    execFile(
      command,
      gotoArgs(file, line, column),
      (error, _stdout, stderr) => {
        if (!error) return resolvePromise();
        reject(
          new Error(
            `Error [openInEditor]: ${command} a échoué sur ${file}:${line} — ${stderr || error.message}`,
            { cause: error },
          ),
        );
      },
    );
  });
}
