/**
 * @author [A likely boring stuff made by] Shevek
 * @desc document_write.ts : Appels `document.write(…)` et `document.writeln(…)` : chaque argument est
 *       écrit dans le flux du document et interprété comme du HTML.
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

export const DOCUMENT_WRITE_ANALYZER_NAME = "document-write";

const DOCUMENT_WRITE_METHODS = ["write", "writeln"];

export function isDocumentWriteCall(
  node: t.CallExpression | t.OptionalCallExpression,
): boolean {
  if (
    !t.isMemberExpression(node.callee) &&
    !t.isOptionalMemberExpression(node.callee)
  )
    return false;

  const callee = node.callee;
  const isWriteMethod =
    (t.isIdentifier(callee.property) &&
      !callee.computed &&
      DOCUMENT_WRITE_METHODS.includes(callee.property.name)) ||
    (t.isStringLiteral(callee.property) &&
      DOCUMENT_WRITE_METHODS.includes(callee.property.value));

  //document.write()
  //whatever.document.write() | iframe.contentDocument.write()
  const obj = callee.object;
  const isDocument =
    t.isIdentifier(obj, { name: "document" }) ||
    ((t.isMemberExpression(obj) || t.isOptionalMemberExpression(obj)) &&
      (((t.isIdentifier(obj.property, { name: "document" }) ||
        t.isIdentifier(obj.property, { name: "contentDocument" })) &&
        !obj.computed) ||
        t.isStringLiteral(obj.property, { value: "document" }) ||
        t.isStringLiteral(obj.property, { value: "contentDocument" })));

  return isWriteMethod && isDocument;
}

const documentWriteAnalyzerBuilder = (
  args: AnalyzerParams,
  matchesReturn: AnalyzerMatch[],
): Visitor => {
  const handleCallExpression = (
    path: NodePath<t.CallExpression | t.OptionalCallExpression>,
  ) => {
    const node = path.node;
    if (!node.loc || node.start == null || node.end == null) return;

    if (isDocumentWriteCall(node) && node.arguments.length >= 1) {
      const leads: Lead[] = [];
      path.get("arguments").forEach((argument, index) => {
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
        leads.push({
          schemaVersion: LEAD_SCHEMA_VERSION,
          class: ["XSS"],
          hash: hash,
          analyzerName: DOCUMENT_WRITE_ANALYZER_NAME,
          slot: { kind: "call-argument", index: index },
          reconstructed: reconstructed,
          taint: taint,
        });
      });
      const match: AnalyzerMatch = {
        filePath: args.filePath,
        analyzerName: DOCUMENT_WRITE_ANALYZER_NAME,
        value: args.source.slice(node.start, node.end),
        start: node.loc.start,
        end: node.loc.end,
        leads: leads,
      };

      matchesReturn.push(match);
    }
  };
  return {
    CallExpression: handleCallExpression,
    OptionalCallExpression: handleCallExpression,
  };
};

export { documentWriteAnalyzerBuilder };
