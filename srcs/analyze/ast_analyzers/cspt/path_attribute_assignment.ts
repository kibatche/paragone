/**
 * @author [A likely boring stuff made by] Shevek
 * @desc path_attribute_assignment.ts : Affectation `el.src = "/…" + x` ou `el.href = \`/…${x}\`` : un chemin
 *       ancré à la racine du site. La valeur choisit la ressource chargée (CSPT) ; placée en tête du chemin,
 *       elle peut en faire une URL `//hôte` relative au protocole (OPEN_REDIRECT).
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
import { isValidPath, processStringConcatenation } from "./cspt_utils";
import { isLocationAssignment } from "../open_redirect/location";
import { SHA256 } from "bun";
import { randomBytes } from "crypto";

export const PATH_ATTRIBUTE_ASSIGNMENT_ANALYZER_NAME =
  "path-attribute-assignment";

const PATH_ATTRIBUTES = ["src", "href"];

const ROOT_PATH_PREFIX = "/";

export function isPathAttributeAssignment(
  node: t.MemberExpression | t.OptionalMemberExpression,
): boolean {
  const isPathAttribute =
    (t.isIdentifier(node.property) &&
      !node.computed &&
      PATH_ATTRIBUTES.includes(node.property.name)) ||
    (t.isStringLiteral(node.property) &&
      PATH_ATTRIBUTES.includes(node.property.value));
  // location.href = … relève de l'analyzer location.
  return isPathAttribute && !isLocationAssignment(node);
}

const pathAttributeAssignmentAnalyzerBuilder = (
  args: AnalyzerParams,
  matchesReturn: AnalyzerMatch[],
): Visitor => {
  const handleAssignment = (path: NodePath<t.AssignmentExpression>) => {
    const node = path.node;
    if (!node.loc || node.start == null || node.end == null) return;

    const left = node.left;
    if (!t.isMemberExpression(left) && !t.isOptionalMemberExpression(left))
      return;
    if (!isPathAttributeAssignment(left)) return;

    const reconstructed = processStringConcatenation(path.get("right").node);
    if (
      !reconstructed.startsWith(ROOT_PATH_PREFIX) ||
      !isValidPath(reconstructed)
    )
      return;

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
      class: ["CSPT", "OPEN_REDIRECT"],
      hash: hash,
      analyzerName: PATH_ATTRIBUTE_ASSIGNMENT_ANALYZER_NAME,
      slot: { kind: "assignment-expression-right" },
      reconstructed: reconstructed,
      taint: taint,
    });
    const match: AnalyzerMatch = {
      filePath: args.filePath,
      analyzerName: PATH_ATTRIBUTE_ASSIGNMENT_ANALYZER_NAME,
      value: args.source.slice(node.start, node.end),
      start: node.loc.start,
      end: node.loc.end,
      leads: leads,
    };

    matchesReturn.push(match);
  };
  return { AssignmentExpression: handleAssignment };
};

export { pathAttributeAssignmentAnalyzerBuilder };
