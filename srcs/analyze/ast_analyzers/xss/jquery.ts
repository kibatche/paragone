/**
 * @author [A likely boring stuff made by] Shevek
 * @desc jquery.ts : Méthodes jQuery qui interprètent du HTML ou du code, seulement quand la chaîne d'appels
 *       remonte à `$(…)` / `jQuery(…)` ou à `$.x` / `jQuery.x` : `.append`, `.after`, `.before`,
 *       `.replaceWith` existent aussi sur le DOM natif, où une chaîne est insérée comme texte.
 */
import { type AnalyzerMatch, type AnalyzerParams } from "../../constants/types";
import { NodePath, type Visitor } from "@babel/traverse";
import * as t from "@babel/types";
import {
  type Lead,
  type LeadClass,
  LEAD_SCHEMA_VERSION,
} from "../../constants/lead";
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

export const JQUERY_ANALYZER_NAME = "jquery";

const JQUERY_NAMES = ["$", "jQuery"];

// $(…).html(x) : `.html()` sans argument est une lecture.
const JQUERY_HTML_SETTERS = [
  "html",
  "append",
  "prepend",
  "after",
  "before",
  "replaceWith",
  "wrap",
  "wrapAll",
  "wrapInner",
];

// $.parseHTML(x) interprète du HTML ; $.globalEval(x) et $.getScript(url) exécutent du code.
const JQUERY_STATIC_SINKS: Record<string, LeadClass> = {
  parseHTML: "XSS",
  globalEval: "CODE_EXEC",
  getScript: "CODE_EXEC",
};

// $(…).attr("href", x) : un `javascript:` s'exécute au clic ou au chargement.
const JQUERY_URL_ATTRIBUTES = ["href", "src"];

/** Ce que l'appel jQuery fait de ses arguments. */
interface JQuerySink {
  cls: LeadClass;
  argumentIndexes: number[];
}

function getPropertyName(
  node: t.MemberExpression | t.OptionalMemberExpression,
): string | undefined {
  if (t.isIdentifier(node.property) && !node.computed)
    return node.property.name;
  if (t.isStringLiteral(node.property)) return node.property.value;
  return undefined;
}

function isJQueryIdentifier(node: t.Node): boolean {
  return t.isIdentifier(node) && JQUERY_NAMES.includes(node.name);
}

/**
 * @brief Vrai si la chaîne d'appels remonte à `$(…)` ou `jQuery(…)`.
 *
 * `$(el).find(".a").html(x)` : on descend `callee.object` d'appel en appel jusqu'à la racine.
 */
export function isJQueryInstance(node: t.Node): boolean {
  let current = node;
  while (t.isCallExpression(current) || t.isOptionalCallExpression(current)) {
    if (isJQueryIdentifier(current.callee)) return true;
    if (
      !t.isMemberExpression(current.callee) &&
      !t.isOptionalMemberExpression(current.callee)
    )
      return false;
    current = current.callee.object;
  }
  return false;
}

function allArgumentIndexes(
  node: t.CallExpression | t.OptionalCallExpression,
): number[] {
  return node.arguments.map((_, index) => index);
}

/** @return Le sink jQuery de l'appel, ou undefined si ce n'en est pas un. */
export function getJQuerySink(
  node: t.CallExpression | t.OptionalCallExpression,
): JQuerySink | undefined {
  if (
    !t.isMemberExpression(node.callee) &&
    !t.isOptionalMemberExpression(node.callee)
  )
    return undefined;
  const method = getPropertyName(node.callee);
  if (!method || node.arguments.length < 1) return undefined;

  //$.parseHTML(x) | jQuery.globalEval(x)
  if (isJQueryIdentifier(node.callee.object)) {
    const cls = JQUERY_STATIC_SINKS[method];
    return cls ? { cls: cls, argumentIndexes: [0] } : undefined;
  }

  if (!isJQueryInstance(node.callee.object)) return undefined;

  if (method === "html")
    return node.arguments.length === 1
      ? { cls: "XSS", argumentIndexes: [0] }
      : undefined;
  if (JQUERY_HTML_SETTERS.includes(method))
    return { cls: "XSS", argumentIndexes: allArgumentIndexes(node) };

  //$(…).attr("href", x)
  const attribute = node.arguments[0];
  if (
    method === "attr" &&
    node.arguments.length >= 2 &&
    t.isStringLiteral(attribute) &&
    JQUERY_URL_ATTRIBUTES.includes(attribute.value)
  ) {
    return { cls: "XSS", argumentIndexes: [1] };
  }
  return undefined;
}

const jqueryAnalyzerBuilder = (
  args: AnalyzerParams,
  matchesReturn: AnalyzerMatch[],
): Visitor => {
  const handleCallExpression = (
    path: NodePath<t.CallExpression | t.OptionalCallExpression>,
  ) => {
    const node = path.node;
    if (!node.loc || node.start == null || node.end == null) return;

    const sink = getJQuerySink(node);
    if (!sink) return;

    const leads: Lead[] = [];
    path.get("arguments").forEach((argument, index) => {
      if (!sink.argumentIndexes.includes(index)) return;
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
      leads.push({
        schemaVersion: LEAD_SCHEMA_VERSION,
        class: [sink.cls],
        hash: hash,
        analyzerName: JQUERY_ANALYZER_NAME,
        slot: { kind: "call-argument", index: index },
        reconstructed: reconstructed,
        taint: taint,
      });
    });
    const match: AnalyzerMatch = {
      filePath: args.filePath,
      analyzerName: JQUERY_ANALYZER_NAME,
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

export { jqueryAnalyzerBuilder };
