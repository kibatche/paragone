/**
 * @author [A likely boring stuff made by] Shevek
 * @desc spa_navigation.ts : Navigation d'application monopage : `router.push|replace|navigate|navigateByUrl(x)`
 *       (vue-router, Angular, Next), `navigate(x)` (react-router) et `history.pushState|replaceState(s, t, url)`.
 *       La valeur choisit la route, donc les vues et les appels d'API qui la suivent.
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

export const SPA_NAVIGATION_ANALYZER_NAME = "spa-navigation";

const ROUTER_NAMES = ["router", "$router"];
const ROUTER_METHODS = ["push", "replace", "navigate", "navigateByUrl"];
const HISTORY_METHODS = ["pushState", "replaceState"];
const NAVIGATE_FUNCTION = "navigate";

// history.pushState(state, title, url) : l'URL est le troisième argument.
const HISTORY_URL_INDEX = 2;

function getPropertyName(
  node: t.MemberExpression | t.OptionalMemberExpression,
): string | undefined {
  if (t.isIdentifier(node.property) && !node.computed)
    return node.property.name;
  if (t.isStringLiteral(node.property)) return node.property.value;
  return undefined;
}

//router | this.$router | this.router | whatever.router
function isNamedReceiver(node: t.Node, names: string[]): boolean {
  if (t.isIdentifier(node)) return names.includes(node.name);
  if (!t.isMemberExpression(node) && !t.isOptionalMemberExpression(node))
    return false;
  const name = getPropertyName(node);
  return name !== undefined && names.includes(name);
}

/** @return Le rang de l'URL de navigation, ou undefined si l'appel ne navigue pas. */
export function getNavigationUrlIndex(
  node: t.CallExpression | t.OptionalCallExpression,
): number | undefined {
  //navigate(x)
  if (t.isIdentifier(node.callee, { name: NAVIGATE_FUNCTION }))
    return node.arguments.length >= 1 ? 0 : undefined;
  if (
    !t.isMemberExpression(node.callee) &&
    !t.isOptionalMemberExpression(node.callee)
  )
    return undefined;

  const method = getPropertyName(node.callee);
  if (!method) return undefined;
  if (
    ROUTER_METHODS.includes(method) &&
    isNamedReceiver(node.callee.object, ROUTER_NAMES)
  )
    return node.arguments.length >= 1 ? 0 : undefined;
  if (
    HISTORY_METHODS.includes(method) &&
    isNamedReceiver(node.callee.object, ["history"])
  )
    return node.arguments.length > HISTORY_URL_INDEX
      ? HISTORY_URL_INDEX
      : undefined;
  return undefined;
}

const spaNavigationAnalyzerBuilder = (
  args: AnalyzerParams,
  matchesReturn: AnalyzerMatch[],
): Visitor => {
  const handleCallExpression = (
    path: NodePath<t.CallExpression | t.OptionalCallExpression>,
  ) => {
    const node = path.node;
    if (!node.loc || node.start == null || node.end == null) return;

    const urlIndex = getNavigationUrlIndex(node);
    if (urlIndex === undefined) return;

    const argument = path.get("arguments")[urlIndex]!;
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
      class: ["CSPT", "OPEN_REDIRECT"],
      hash: hash,
      analyzerName: SPA_NAVIGATION_ANALYZER_NAME,
      slot: { kind: "call-argument", index: urlIndex },
      reconstructed: reconstructed,
      taint: taint,
    });
    const match: AnalyzerMatch = {
      filePath: args.filePath,
      analyzerName: SPA_NAVIGATION_ANALYZER_NAME,
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

export { spaNavigationAnalyzerBuilder };
