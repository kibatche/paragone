/**
 * @author [A likely boring stuff made by] Shevek
 * @desc lodash_template.ts : `_.template(source)` : lodash compile le gabarit en fonction par `Function`, et
 *       les blocs `<% … %>` sont du JavaScript. Une source de gabarit contrôlée est une exécution de code.
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

export const LODASH_TEMPLATE_ANALYZER_NAME = "lodash-template";

const LODASH_NAMES = ["_", "lodash"];

//_.template() | lodash.template()
export function isLodashTemplateCall(
  node: t.CallExpression | t.OptionalCallExpression,
): boolean {
  if (
    !t.isMemberExpression(node.callee) &&
    !t.isOptionalMemberExpression(node.callee)
  )
    return false;
  const callee = node.callee;
  const isLodash =
    t.isIdentifier(callee.object) && LODASH_NAMES.includes(callee.object.name);
  const isTemplate =
    (t.isIdentifier(callee.property, { name: "template" }) &&
      !callee.computed) ||
    t.isStringLiteral(callee.property, { value: "template" });
  return isLodash && isTemplate;
}

const lodashTemplateAnalyzerBuilder = (
  args: AnalyzerParams,
  matchesReturn: AnalyzerMatch[],
): Visitor => {
  const handle = (
    path: NodePath<t.CallExpression | t.OptionalCallExpression>,
  ) => {
    const node = path.node;
    if (!node.loc || node.start == null || node.end == null) return;
    if (!isLodashTemplateCall(node) || node.arguments.length < 1) return;

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
      analyzerName: LODASH_TEMPLATE_ANALYZER_NAME,
      slot: { kind: "call-argument", index: 0 },
      reconstructed: reconstructed,
      taint: taint,
    });
    const match: AnalyzerMatch = {
      filePath: args.filePath,
      analyzerName: LODASH_TEMPLATE_ANALYZER_NAME,
      value: args.source.slice(node.start, node.end),
      start: node.loc.start,
      end: node.loc.end,
      leads: leads,
    };

    matchesReturn.push(match);
  };
  return { CallExpression: handle, OptionalCallExpression: handle };
};

export { lodashTemplateAnalyzerBuilder };
