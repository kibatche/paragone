/**
 * @author [A likely boring stuff made by] Shevek
 * @desc string_timer.ts : `setTimeout(x, …)` et `setInterval(x, …)` dont le premier argument est une chaîne
 *       construite sur place : elle y est évaluée comme du code, à la manière d'`eval`.
 */
import { type AnalyzerMatch, type AnalyzerParams } from "../../constants/types";
import { NodePath, type Visitor } from "@babel/traverse";
import * as t from "@babel/types";
import {
  isReconstructible,
  processStringConcatenation,
} from "../cspt/cspt_utils";
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

export const STRING_TIMER_ANALYZER_NAME = "string-timer";

const TIMER_FUNCTIONS = ["setTimeout", "setInterval"];

//setTimeout() | window.setTimeout() | window["setInterval"]()
export function isTimerCall(
  node: t.CallExpression | t.OptionalCallExpression,
): boolean {
  const callee = node.callee;
  if (t.isIdentifier(callee)) return TIMER_FUNCTIONS.includes(callee.name);
  if (!t.isMemberExpression(callee) && !t.isOptionalMemberExpression(callee))
    return false;
  return (
    (t.isIdentifier(callee.property) &&
      !callee.computed &&
      TIMER_FUNCTIONS.includes(callee.property.name)) ||
    (t.isStringLiteral(callee.property) &&
      TIMER_FUNCTIONS.includes(callee.property.value))
  );
}

const stringTimerAnalyzerBuilder = (
  args: AnalyzerParams,
  matchesReturn: AnalyzerMatch[],
): Visitor => {
  const handle = (
    path: NodePath<t.CallExpression | t.OptionalCallExpression>,
  ) => {
    const node = path.node;
    if (!node.loc || node.start == null || node.end == null) return;
    if (!isTimerCall(node) || node.arguments.length < 1) return;
    const argument = path.get("arguments")[0]!;
    // setTimeout("a" + x), setTimeout(`${x}`) : une chaîne construite sur place. Une référence (`setTimeout(t, 0)`,
    // `setTimeout(this.update, 300)`) désigne presque toujours une fonction en code compilé.
    if (!isReconstructible(argument)) return;

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
      class: ["CODE_EXEC"],
      hash: hash,
      analyzerName: STRING_TIMER_ANALYZER_NAME,
      slot: { kind: "call-argument", index: 0 },
      reconstructed: reconstructed,
      taint: taint,
    });
    const match: AnalyzerMatch = {
      filePath: args.filePath,
      analyzerName: STRING_TIMER_ANALYZER_NAME,
      value: args.source.slice(node.start, node.end),
      start: node.loc.start,
      end: node.loc.end,
      leads: leads,
    };

    matchesReturn.push(match);
  };
  return { CallExpression: handle, OptionalCallExpression: handle };
};

export { stringTimerAnalyzerBuilder };
