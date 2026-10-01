/**
 * @author [A likely boring stuff made by] kbtch_ + Shevek
 * @desc scan.ts — passe AST sur chaque fichier du corpus, dans l'ordre des chemins : matches et
 *       leads inscrits en base, un fichier par transaction. Incrémental : un fichier dont
 *       l'empreinte n'a pas changé est sauté.
 */
import { SHA256 } from "bun";
import {
  cleanUnwantedPath,
  isMarkupContent,
} from "../paths/clean_unwanted_paths.ts";
import { countRows, getFileSha256, saveFileScan } from "../db/scan.ts";
import { log, logEvent } from "../cli/log/log.ts";
import { analyzeFile } from "../analyze/analyzer.ts";
import type { FileOutcome, ScanSummary } from "./types.ts";
import { config } from "../config/config.ts";

/**
 * @brief Analyse un fichier et l'inscrit en base.
 * @param reset Réanalyse même si l'empreinte est inchangée.
 * @return L'état du fichier, et le nombre de leads ajoutés.
 */
async function scanFile(
  path: string,
): Promise<{ outcome: FileOutcome; added: number }> {
  const content = await Bun.file(path).text();
  const sha256 = SHA256.hash(content, "hex").toString();
  
  if (getFileSha256(path) === sha256)
    return { outcome: "unchanged", added: 0 };

  if (isMarkupContent(content)) {
    saveFileScan({ path, sha256, status: "not_js", matches: [] });
    return { outcome: "not_js", added: 0 };
  }

  try {
    const matches = await analyzeFile(path);
    const added = saveFileScan({ path, sha256, status: "ok", matches });
    
    return { outcome: "ok", added };
  } catch (e) {
    if (!(e instanceof SyntaxError)) throw e;
    
    log(`[scan] ⚠️  ${path} : ${e.message}`);
    
    saveFileScan({
      path,
      sha256,
      status: "parse_error",
      error: e.message,
      matches: [],
    });
    
    return { outcome: "parse_error", added: 0 };
  }
}

/**
 * @brief Scanne tout le corpus de `config.analyze`.
 * @param onProgress Appelé après chaque fichier.
 */
export async function ensureScan(
  onProgress?: (done: number, total: number, file: string) => void,
): Promise<ScanSummary> {
  
  log(`[scan] ${config.analyze}${config.reset ? " (forcé)" : ""} …`);
  
  const paths = [...(await cleanUnwantedPath(config.analyze))].sort();
  
  const summary: ScanSummary = {
    files: paths.length,
    scanned: 0,
    unchanged: 0,
    notJs: 0,
    parseErrors: 0,
    addedLeads: 0,
  };
 
  let done = 0;
  
  for (const path of paths) {
    const { outcome, added } = await scanFile(path);
    summary.addedLeads += added;
    if (outcome === "unchanged") summary.unchanged++;
    else if (outcome === "not_js") summary.notJs++;
    else if (outcome === "parse_error") summary.parseErrors++;
    else summary.scanned++;
    done++;
    onProgress?.(done, paths.length, path);
  }
  
  log(
    `[scan] terminé : ${summary.files} fichiers — ${summary.scanned} analysés, ` +
      `${summary.unchanged} inchangés, ${summary.notJs} non-JS, ${summary.parseErrors} en erreur de parsing ; ` +
      `${summary.addedLeads} leads ajoutés (${countRows("leads")} en base).`,
  );
  
  logEvent("scan", { analyze: config.analyze, ...summary });
  
  return summary;
}
