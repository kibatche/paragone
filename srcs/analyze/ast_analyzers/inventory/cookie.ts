import { type AnalyzerMatch, type AnalyzerParams } from "../../constants/types";
import { NodePath, type Visitor } from "@babel/traverse";
import * as t from "@babel/types";
import { isCookieRead } from "../sources/cookie";
import { LEAD_SCHEMA_VERSION } from "../../constants/lead";
import { SHA256 } from "bun";

export const COOKIE_READ_ANALYZER_NAME = "cookie-read";
export const COOKIE_ASSIGN_ANALYZER_NAME = "cookie-assignment";

export function isCookieAssignment(
  node: t.MemberExpression | t.OptionalMemberExpression,
): boolean {
  return (
    (t.isIdentifier(node.object) &&
      ((t.isIdentifier(node.property, { name: "cookie" }) && !node.computed) ||
        t.isStringLiteral(node.property, { value: "cookie" }))) ||
    ((t.isMemberExpression(node.object) ||
      t.isOptionalMemberExpression(node.object)) &&
      (t.isIdentifier(node.object.property) ||
        t.isStringLiteral(node.object.property)) &&
      (t.isIdentifier(node.property, { name: "cookie" }) ||
        t.isStringLiteral(node.property, { value: "cookie" })))
  );
}

const cookieAnalyzerBuilder = (
  args: AnalyzerParams,
  matchesReturn: AnalyzerMatch[],
): Visitor => {
  const handleAssignment = (path: NodePath<t.AssignmentExpression>) => {
    const node = path.node;
    if (!node.loc || node.start == null || node.end == null) return;

    // On est obligé de faire cela afin de pouvoir accéder à node.left.object au cas où on a
    // whatever.document.cookie = truc.
    // cookie, dans ce cas, reste une propriété de left, mais par contre document dvient une propriété de l'objet "whatever"
    // Cela semble inutilement compliqué mais les check de type ts nous obligent à faire cela.
    const left = node.left;
    if (!t.isMemberExpression(left) && !t.isOptionalMemberExpression(left))
      return;

    if (isCookieAssignment(left)) {
      const match: AnalyzerMatch = {
        filePath: args.filePath,
        analyzerName: COOKIE_ASSIGN_ANALYZER_NAME,
        value: args.source.slice(node.start, node.end),
        start: node.loc.start,
        end: node.loc.end,
        leads: [
          {
            schemaVersion: LEAD_SCHEMA_VERSION,
            class: ["COOKIE_INVENTORY"],
            hash: SHA256.hash(
              args.source.slice(node.start, node.end),
              "hex",
            ).toString(),
            analyzerName: COOKIE_ASSIGN_ANALYZER_NAME,
            reconstructed: args.source.slice(node.start, node.end),
          },
        ],
      };

      matchesReturn.push(match);
    }
  };

  const handleMemberExpression = (
    path: NodePath<t.MemberExpression | t.OptionalMemberExpression>,
  ) => {
    const node = path.node;
    if (!node.loc || node.start == null || node.end == null) return;

    // On teste si le parent est une affectation et si le noeud courant est à gauche dudit parent retrouvé
    if (
      path.findParent(
        (p) => p.isAssignmentExpression() && p.node.left === path.node,
      )
    )
      return;

    // Check for cookie reads
    if (isCookieRead(node)) {
      const match: AnalyzerMatch = {
        filePath: args.filePath,
        analyzerName: COOKIE_READ_ANALYZER_NAME,
        value: args.source.slice(node.start, node.end),
        start: node.loc.start,
        end: node.loc.end,
        leads: [
          {
            schemaVersion: LEAD_SCHEMA_VERSION,
            class: ["COOKIE_INVENTORY"],
            hash: SHA256.hash(
              args.source.slice(node.start, node.end),
              "hex",
            ).toString(),
            analyzerName: COOKIE_READ_ANALYZER_NAME,
            reconstructed: args.source.slice(node.start, node.end),
          },
        ],
      };

      matchesReturn.push(match);
    }
  };
  return {
    AssignmentExpression: handleAssignment,
    MemberExpression: handleMemberExpression,
    OptionalMemberExpression: handleMemberExpression,
  };
};

export { cookieAnalyzerBuilder };
