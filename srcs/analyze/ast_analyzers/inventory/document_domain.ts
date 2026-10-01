import { type AnalyzerMatch, type AnalyzerParams } from "../../constants/types";
import { NodePath, type Visitor } from "@babel/traverse";
import * as t from "@babel/types";
import { isDocumentDomainRead } from "../sources/document_domain";
import { LEAD_SCHEMA_VERSION } from "../../constants/lead";
import { SHA256 } from "bun";

export const DOCUMENT_DOMAIN_READ_ANALYZER_NAME = "document-domain-read";
export const DOCUMENT_DOMAIN_ASSIGN_ANALYZER_NAME =
  "document-domain-assignment";

export function isDocumentDomainAssignment(
  node: t.MemberExpression | t.OptionalMemberExpression,
): boolean {
  return (
    (t.isIdentifier(node.object, { name: "document" }) &&
      (t.isIdentifier(node.property, { name: "domain" }) ||
        t.isStringLiteral(node.property, { value: "domain" }))) ||
    ((t.isMemberExpression(node.object) ||
      t.isOptionalMemberExpression(node.object)) &&
      (t.isIdentifier(node.object.property, { name: "document" }) ||
        t.isStringLiteral(node.object.property, { value: "document" })) &&
      (t.isIdentifier(node.property, { name: "domain" }) ||
        t.isStringLiteral(node.property, { value: "domain" })))
  );
}

const documentDomainAnalyzerBuilder = (
  args: AnalyzerParams,
  matchesReturn: AnalyzerMatch[],
): Visitor => {
  const handleAssignment = (path: NodePath<t.AssignmentExpression>) => {
    const node = path.node;
    if (!node.loc || node.start == null || node.end == null) return;
    const left = node.left;
    if (!t.isMemberExpression(left) && !t.isOptionalMemberExpression(left))
      return;

    // Check if this is a document.domain assignment
    if (isDocumentDomainAssignment(left)) {
      const match: AnalyzerMatch = {
        filePath: args.filePath,
        analyzerName: DOCUMENT_DOMAIN_ASSIGN_ANALYZER_NAME,
        value: args.source.slice(node.start, node.end),
        start: node.loc.start,
        end: node.loc.end,
        leads: [
          {
            schemaVersion: LEAD_SCHEMA_VERSION,
            class: ["DOCUMENT_DOMAIN_INVENTORY"],
            hash: SHA256.hash(
              args.source.slice(node.start, node.end),
              "hex",
            ).toString(),
            analyzerName: DOCUMENT_DOMAIN_ASSIGN_ANALYZER_NAME,
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

    if (isDocumentDomainRead(node)) {
      const match: AnalyzerMatch = {
        filePath: args.filePath,
        analyzerName: DOCUMENT_DOMAIN_READ_ANALYZER_NAME,
        value: args.source.slice(node.start, node.end),
        start: node.loc.start,
        end: node.loc.end,
        leads: [
          {
            schemaVersion: LEAD_SCHEMA_VERSION,
            class: ["DOCUMENT_DOMAIN_INVENTORY"],
            hash: SHA256.hash(
              args.source.slice(node.start, node.end),
              "hex",
            ).toString(),
            analyzerName: DOCUMENT_DOMAIN_READ_ANALYZER_NAME,
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

export { documentDomainAnalyzerBuilder };
