/**
 * @author [A likely boring stuff made by] Shevek
 * @desc parse_from_string.ts — Appels `new DOMParser().parseFromString(html, "text/html")` : la chaîne est
 *       analysée comme un document HTML. Un nœud de ce document réinséré dans la page porte le contenu
 *       tel quel ; c'est aussi le terrain des mutations mXSS (analyse, sérialisation, réanalyse).
 */
import { type AnalyzerMatch, type AnalyzerParams } from "../../constants/types";
import { NodePath, type Visitor } from "@babel/traverse";
import * as t from "@babel/types";
import { type Lead, LEAD_SCHEMA_VERSION } from "../../constants/lead";
import {
  taintIdentifier,
  getTaintTable,
} from "../../taint/set_identifier_value";
import {
  taintReport,
  buildSinkContext,
  normalizeNode,
} from "../../taint/taint_report";
import { processStringConcatenation } from "../cspt/cspt_utils";
import { SHA256 } from "bun";
import { randomBytes } from "crypto";

export const PARSE_FROM_STRING_ANALYZER_NAME = "parse-from-string";

const HTML_MIME_TYPE = "text/html";

// parseFromString(x, "text/html") — le type MIME est un littéral en pratique. Un type non littéral
// n'est pas tranchable ici : il est gardé, le juge lit l'appel.
export function isParseFromStringHTMLCall(
  node: t.CallExpression | t.OptionalCallExpression,
): boolean {
  if (
    !t.isMemberExpression(node.callee) &&
    !t.isOptionalMemberExpression(node.callee)
  )
    return false;
  const isParseFromString =
    (t.isIdentifier(node.callee.property, { name: "parseFromString" }) &&
      !node.callee.computed) ||
    t.isStringLiteral(node.callee.property, { value: "parseFromString" });
  if (!isParseFromString || node.arguments.length < 2) return false;

  const mimeType = node.arguments[1];
  return !t.isStringLiteral(mimeType) || mimeType.value === HTML_MIME_TYPE;
}

const parseFromStringAnalyzerBuilder = (
  args: AnalyzerParams,
  matchesReturn: AnalyzerMatch[],
): Visitor => {
  const handleCallExpression = (
    path: NodePath<t.CallExpression | t.OptionalCallExpression>,
  ) => {
    const node = path.node;
    if (!node.loc || node.start == null || node.end == null) return;
    if (!isParseFromStringHTMLCall(node)) return;

    const argument = path.get("arguments")[0]!;
    const reconstructed = processStringConcatenation(argument.node);
    const rootId = taintIdentifier(argument);
    const taint = taintReport(
      rootId,
      getTaintTable(),
      args.source,
      buildSinkContext(argument, path),
    );
    if (!taint) return;
    const normalizedNode = normalizeNode(
      rootId,
      getTaintTable(),
      buildSinkContext(argument, path),
    );
    const hash = SHA256.hash(
      normalizedNode ?? randomBytes(256).toString(),
      "hex",
    ).toString();
    const leads: Lead[] = [];
    leads.push({
      schemaVersion: LEAD_SCHEMA_VERSION,
      class: ["XSS"],
      hash: hash,
      analyzerName: PARSE_FROM_STRING_ANALYZER_NAME,
      slot: { kind: "call-argument", index: 0 },
      reconstructed: reconstructed,
      taint: taint,
    });
    const match: AnalyzerMatch = {
      filePath: args.filePath,
      analyzerName: PARSE_FROM_STRING_ANALYZER_NAME,
      value: args.source.slice(node.start, node.end),
      start: node.loc.start,
      end: node.loc.end,
      leads: leads,
    };

    matchesReturn.push(match);
  };
  return {
    CallExpression: handleCallExpression,
    OptionalCallExpression: handleCallExpression,
  };
};

export { parseFromStringAnalyzerBuilder };
