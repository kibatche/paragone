/**
 * @author [A likely boring stuff made by] Shevek
 * @desc dynamic_import.ts : `import(x)` dont la source n'est pas un littéral : le module chargé depuis cette
 *       URL s'exécute dans l'origine de la page. Babel 8 le représente par un `ImportExpression`.
 */
import { type AnalyzerMatch, type AnalyzerParams } from "../../constants/types";
import { NodePath, type Visitor } from "@babel/traverse";
import * as t from "@babel/types";
import { processStringConcatenation } from "../cspt/cspt_utils";
import {
  getTaintTable,
  taintIdentifier,
} from "../../taint/set_identifier_value";
import {
  buildSinkContext,
  taintReport,
  normalizeNode,
} from "../../taint/taint_report";
import { LEAD_SCHEMA_VERSION, type Lead } from "../../constants/lead";
import { SHA256 } from "bun";
import { randomBytes } from "crypto";

export const DYNAMIC_IMPORT_ANALYZER_NAME = "dynamic-import";

// import("./chunk.js") et import(`./chunk.js`) sont les imports de chunks du bundler : aucune valeur externe.
export function isLiteralImportSource(node: t.Node): boolean {
  return (
    t.isStringLiteral(node) ||
    (t.isTemplateLiteral(node) && node.expressions.length === 0)
  );
}

const dynamicImportAnalyzerBuilder = (
  args: AnalyzerParams,
  matchesReturn: AnalyzerMatch[],
): Visitor => {
  const handle = (path: NodePath<t.ImportExpression>) => {
    const node = path.node;
    if (!node.loc || node.start == null || node.end == null) return;
    if (isLiteralImportSource(node.source)) return;

    const source = path.get("source");
    const reconstructed = processStringConcatenation(source.node);
    const rootId = taintIdentifier(source);
    const taint = taintReport(
      rootId,
      getTaintTable(),
      args.source,
      buildSinkContext(source, path),
    );
    if (!taint) return;
    const normalizedNode = normalizeNode(
      rootId,
      getTaintTable(),
      buildSinkContext(source, path),
    );
    const hash = SHA256.hash(
      normalizedNode ?? randomBytes(256).toString(),
      "hex",
    ).toString();
    const leads: Lead[] = [];
    leads.push({
      schemaVersion: LEAD_SCHEMA_VERSION,
      class: ["CODE_EXEC"],
      hash: hash,
      analyzerName: DYNAMIC_IMPORT_ANALYZER_NAME,
      slot: { kind: "call-argument", index: 0 },
      reconstructed: reconstructed,
      taint: taint,
    });
    const match: AnalyzerMatch = {
      filePath: args.filePath,
      analyzerName: DYNAMIC_IMPORT_ANALYZER_NAME,
      value: args.source.slice(node.start, node.end),
      start: node.loc.start,
      end: node.loc.end,
      leads: leads,
    };

    matchesReturn.push(match);
  };
  return { ImportExpression: handle };
};

export { dynamicImportAnalyzerBuilder };
