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

export const LOCATION_ANALYZER_NAME = "location";

// Common location properties and methods
const LOCATION_PROPERTIES = [
  "href",
  "protocol",
  "host",
  "hostname",
  "port",
  "pathname",
  "search",
  "hash",
  "origin",
];

export function isLocationAssignment(
  node: t.MemberExpression | t.OptionalMemberExpression,
): boolean {
  const obj = node.object;
  const base =
    t.isIdentifier(obj, { name: "location" }) ||
    ((t.isMemberExpression(obj) || t.isOptionalMemberExpression(obj)) &&
      ((t.isIdentifier(obj.property, { name: "location" }) && !obj.computed) ||
        t.isStringLiteral(obj.property, { value: "location" })));

  const okProp =
    (t.isIdentifier(node.property) &&
      !node.computed &&
      LOCATION_PROPERTIES.includes(node.property.name)) ||
    (t.isStringLiteral(node.property) &&
      LOCATION_PROPERTIES.includes(node.property.value));

  return base && okProp;
}

const locationAnalyzerBuilder = (
  args: AnalyzerParams,
  matchesReturn: AnalyzerMatch[],
): Visitor => {
  const handleAssignment = (path: NodePath<t.AssignmentExpression>) => {
    const node = path.node;
    if (!node.loc || node.start == null || node.end == null) return;

    // On est obligé de faire cela afin de pouvoir accéder à ) node.left.object au cas où on a
    // whatever.location.href = truc.
    // href, dans ce cas, reste une propriété de left, mais par contre location dvient une propriété de l'objet "whatever"
    // Cela semble inutilement compliqué mais les check de type ts nous obligent à faire cela.
    const left = node.left;
    if (!t.isMemberExpression(left) && !t.isOptionalMemberExpression(left))
      return;

    // Check for location assignments - only on the left side
    if (isLocationAssignment(left)) {
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
        class: ["OPEN_REDIRECT"],
        hash: hash,
        analyzerName: LOCATION_ANALYZER_NAME,
        slot: { kind: "assignment-expression-right" },
        reconstructed: reconstructed,
        taint: taint,
      });

      const match: AnalyzerMatch = {
        filePath: args.filePath,
        analyzerName: LOCATION_ANALYZER_NAME,
        value: args.source.slice(node.start, node.end),
        start: node.loc.start,
        end: node.loc.end,
        leads: leads,
      };

      matchesReturn.push(match);
      return; // Return early to prevent double detection
    }
  };

  return { AssignmentExpression: handleAssignment };
};

export { locationAnalyzerBuilder };
