/**
 * @author [A likely boring stuff made by] Shevek
 * @desc srcdoc.ts — Contenu d'iframe `srcdoc` : affectation `iframe.srcdoc = …` et propriété d'objet
 *       `srcdoc:` / `srcDoc:` (props React compilées). La valeur devient le document HTML de l'iframe.
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
import {
  getPropertyKeyName,
  processStringConcatenation,
} from "../cspt/cspt_utils";
import { SHA256 } from "bun";
import { randomBytes } from "crypto";

export const SRCDOC_ANALYZER_NAME = "srcdoc";

const SRCDOC_KEYS = ["srcdoc", "srcDoc"];

export function isSrcdocAssignment(
  node: t.MemberExpression | t.OptionalMemberExpression,
): boolean {
  return (
    (t.isIdentifier(node.property) &&
      !node.computed &&
      SRCDOC_KEYS.includes(node.property.name)) ||
    (t.isStringLiteral(node.property) &&
      SRCDOC_KEYS.includes(node.property.value))
  );
}

const srcdocAnalyzerBuilder = (
  args: AnalyzerParams,
  matchesReturn: AnalyzerMatch[],
): Visitor => {
  const handleAssignment = (path: NodePath<t.AssignmentExpression>) => {
    const node = path.node;
    if (!node.loc || node.start == null || node.end == null) return;

    const left = node.left;
    if (!t.isMemberExpression(left) && !t.isOptionalMemberExpression(left))
      return;
    if (!isSrcdocAssignment(left)) return;

    const reconstructed = processStringConcatenation(path.get("right").node);
    const rootId = taintIdentifier(path.get("right"));
    const taint = taintReport(
      rootId,
      getTaintTable(),
      args.source,
      buildSinkContext(path.get("right"), path),
    );
    if (!taint) return;
    const normalizedNode = normalizeNode(
      rootId,
      getTaintTable(),
      buildSinkContext(path.get("right"), path),
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
      analyzerName: SRCDOC_ANALYZER_NAME,
      slot: { kind: "assignment-expression-right" },
      reconstructed: reconstructed,
      taint: taint,
    });
    const match: AnalyzerMatch = {
      filePath: args.filePath,
      analyzerName: SRCDOC_ANALYZER_NAME,
      value: args.source.slice(node.start, node.end),
      start: node.loc.start,
      end: node.loc.end,
      leads: leads,
    };

    matchesReturn.push(match);
  };

  const handleObjectExpression = (path: NodePath<t.ObjectExpression>) => {
    const node = path.node;
    if (!node.loc || node.start == null || node.end == null) return;

    const leads: Lead[] = [];
    path.get("properties").forEach((property, index) => {
      if (!property.isObjectProperty()) return;
      const keyName = getPropertyKeyName(property);
      if (!keyName || !SRCDOC_KEYS.includes(keyName)) return;

      const value = property.get("value");
      const reconstructed = processStringConcatenation(value.node);
      const rootId = taintIdentifier(value);
      const taint = taintReport(
        rootId,
        getTaintTable(),
        args.source,
        buildSinkContext(value, property),
      );
      if (!taint) return;
      const normalizedNode = normalizeNode(
        rootId,
        getTaintTable(),
        buildSinkContext(value, property),
      );
      const hash = SHA256.hash(
        normalizedNode ?? randomBytes(256).toString(),
        "hex",
      ).toString();
      leads.push({
        schemaVersion: LEAD_SCHEMA_VERSION,
        class: ["XSS"],
        hash: hash,
        analyzerName: SRCDOC_ANALYZER_NAME,
        slot: { kind: "object-property", index: index, key: keyName },
        reconstructed: reconstructed,
        taint: taint,
      });
    });
    if (leads.length === 0) return;

    const match: AnalyzerMatch = {
      filePath: args.filePath,
      analyzerName: SRCDOC_ANALYZER_NAME,
      value: args.source.slice(node.start, node.end),
      start: node.loc.start,
      end: node.loc.end,
      leads: leads,
    };
    matchesReturn.push(match);
  };
  return {
    AssignmentExpression: handleAssignment,
    ObjectExpression: handleObjectExpression,
  };
};

export { srcdocAnalyzerBuilder };
