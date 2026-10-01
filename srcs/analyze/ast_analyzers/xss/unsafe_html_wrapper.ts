/**
 * @author [A likely boring stuff made by] Shevek
 * @desc unsafe_html_wrapper.ts — Enveloppes qui marquent une chaîne comme HTML de confiance pour le moteur
 *       de gabarits : `unsafeHTML(x)` / `unsafeSVG(x)` (lit), `htmlSafe(x)` (Ember), `new SafeString(x)`
 *       (Handlebars, Ember). Le moteur l'insère ensuite sans échappement.
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

export const UNSAFE_HTML_WRAPPER_ANALYZER_NAME = "unsafe-html-wrapper";

const UNSAFE_HTML_FUNCTIONS = ["unsafeHTML", "unsafeSVG", "htmlSafe"];
const UNSAFE_HTML_CLASSES = ["SafeString"];

/**
 * @brief Nom de ce qui est appelé : `f(…)`, `x.f(…)` ou `x["f"](…)`.
 *
 * En bundle, un import nommé (`unsafeHTML`) est souvent renommé ; il survit quand il est lu comme
 * propriété d'un espace de noms (`Handlebars.SafeString`, `Ember.String.htmlSafe`).
 */
function getCalleeName(callee: t.Node): string | undefined {
  if (t.isIdentifier(callee)) return callee.name;
  if (!t.isMemberExpression(callee) && !t.isOptionalMemberExpression(callee))
    return undefined;
  if (t.isIdentifier(callee.property) && !callee.computed)
    return callee.property.name;
  if (t.isStringLiteral(callee.property)) return callee.property.value;
  return undefined;
}

export function isUnsafeHTMLWrapper(
  node: t.CallExpression | t.OptionalCallExpression | t.NewExpression,
): boolean {
  const name = getCalleeName(node.callee);
  if (!name || node.arguments.length < 1) return false;
  if (t.isNewExpression(node)) return UNSAFE_HTML_CLASSES.includes(name);
  return UNSAFE_HTML_FUNCTIONS.includes(name);
}

const unsafeHTMLWrapperAnalyzerBuilder = (
  args: AnalyzerParams,
  matchesReturn: AnalyzerMatch[],
): Visitor => {
  const handle = (
    path: NodePath<
      t.CallExpression | t.OptionalCallExpression | t.NewExpression
    >,
  ) => {
    const node = path.node;
    if (!node.loc || node.start == null || node.end == null) return;
    if (!isUnsafeHTMLWrapper(node)) return;

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
      analyzerName: UNSAFE_HTML_WRAPPER_ANALYZER_NAME,
      slot: { kind: "call-argument", index: 0 },
      reconstructed: reconstructed,
      taint: taint,
    });
    const match: AnalyzerMatch = {
      filePath: args.filePath,
      analyzerName: UNSAFE_HTML_WRAPPER_ANALYZER_NAME,
      value: args.source.slice(node.start, node.end),
      start: node.loc.start,
      end: node.loc.end,
      leads: leads,
    };

    matchesReturn.push(match);
  };
  return {
    CallExpression: handle,
    OptionalCallExpression: handle,
    NewExpression: handle,
  };
};

export { unsafeHTMLWrapperAnalyzerBuilder };
