/**
 * @author [A likely boring stuff made by] Shevek
 * @desc create_object_url.ts — Appels `URL.createObjectURL(blob)` : l'URL `blob:` produite est servie avec
 *       l'origine de la page. Un Blob de type `text/html` ouvert ou chargé en iframe s'exécute dans cette origine.
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

export const CREATE_OBJECT_URL_ANALYZER_NAME = "create-object-url";

const URL_OBJECT_NAMES = ["URL", "webkitURL"];

export function isCreateObjectURLCall(
  node: t.CallExpression | t.OptionalCallExpression,
): boolean {
  if (
    !t.isMemberExpression(node.callee) &&
    !t.isOptionalMemberExpression(node.callee)
  )
    return false;
  const callee = node.callee;
  const isCreateObjectURL =
    (t.isIdentifier(callee.property, { name: "createObjectURL" }) &&
      !callee.computed) ||
    t.isStringLiteral(callee.property, { value: "createObjectURL" });

  //URL.createObjectURL() | window.URL.createObjectURL()
  const obj = callee.object;
  const isURLObject =
    (t.isIdentifier(obj) && URL_OBJECT_NAMES.includes(obj.name)) ||
    ((t.isMemberExpression(obj) || t.isOptionalMemberExpression(obj)) &&
      ((t.isIdentifier(obj.property) &&
        !obj.computed &&
        URL_OBJECT_NAMES.includes(obj.property.name)) ||
        (t.isStringLiteral(obj.property) &&
          URL_OBJECT_NAMES.includes(obj.property.value))));

  return isCreateObjectURL && isURLObject;
}

const createObjectURLAnalyzerBuilder = (
  args: AnalyzerParams,
  matchesReturn: AnalyzerMatch[],
): Visitor => {
  const handleCallExpression = (
    path: NodePath<t.CallExpression | t.OptionalCallExpression>,
  ) => {
    const node = path.node;
    if (!node.loc || node.start == null || node.end == null) return;
    if (!isCreateObjectURLCall(node) || node.arguments.length < 1) return;

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
      analyzerName: CREATE_OBJECT_URL_ANALYZER_NAME,
      slot: { kind: "call-argument", index: 0 },
      reconstructed: reconstructed,
      taint: taint,
    });
    const match: AnalyzerMatch = {
      filePath: args.filePath,
      analyzerName: CREATE_OBJECT_URL_ANALYZER_NAME,
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

export { createObjectURLAnalyzerBuilder };
