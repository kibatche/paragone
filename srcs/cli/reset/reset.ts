import { rmSync } from "node:fs"
import { PARAGONE_DIR } from "../../config/constants"
import { config } from "../../config/config";


/** @brief Confirme un --reset destructif (reset). */
export function confirmReset(): boolean {
    if (config.noninteractive === true) return true
    const a =
        (
            prompt(
                `Cette action détruira TOUS les fichiers et dossiers de .paragone. Confirmer ? (o/n) [n]: `,
            ) ?? ""
        )
            .trim()
            .toLowerCase() || "n";
    return a.startsWith("o") || a.startsWith("y");
}

export function destroyParagoneDir() {
    try {
        rmSync(PARAGONE_DIR, { force: true, recursive: true })
    } catch (e) {
        console.error("[ERROR]", e)
    }
}