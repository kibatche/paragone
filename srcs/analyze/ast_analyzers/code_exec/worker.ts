/**
 * @author [A likely boring stuff made by] Shevek
 * @desc worker.ts — `new Worker(url)` et `new SharedWorker(url)` : le script chargé depuis cette URL
 *       s'exécute dans un worker de l'origine de la page.
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

export const WORKER_ANALYZER_NAME = "worker";

const WORKER_CLASSES = ["Worker", "SharedWorker"];

//new Worker() | new window.Worker()
export function isWorkerConstruction(node: t.NewExpression): boolean {
  const callee = node.callee;
  if (t.isIdentifier(callee)) return WORKER_CLASSES.includes(callee.name);
  if (!t.isMemberExpression(callee) && !t.isOptionalMemberExpression(callee))
    return false;
  return (
    (t.isIdentifier(callee.property) &&
      !callee.computed &&
      WORKER_CLASSES.includes(callee.property.name)) ||
    (t.isStringLiteral(callee.property) &&
      WORKER_CLASSES.includes(callee.property.value))
  );
}

const workerAnalyzerBuilder = (
  args: AnalyzerParams,
  matchesReturn: AnalyzerMatch[],
): Visitor => {
  const handle = (path: NodePath<t.NewExpression>) => {
    const node = path.node;
    if (!node.loc || node.start == null || node.end == null) return;
    if (!isWorkerConstruction(node) || node.arguments.length < 1) return;

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
      class: ["CODE_EXEC"],
      hash: hash,
      analyzerName: WORKER_ANALYZER_NAME,
      slot: { kind: "call-argument", index: 0 },
      reconstructed: reconstructed,
      taint: taint,
    });
    const match: AnalyzerMatch = {
      filePath: args.filePath,
      analyzerName: WORKER_ANALYZER_NAME,
      value: args.source.slice(node.start, node.end),
      start: node.loc.start,
      end: node.loc.end,
      leads: leads,
    };

    matchesReturn.push(match);
  };
  return { NewExpression: handle };
};

export { workerAnalyzerBuilder };
