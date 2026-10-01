/**
 * @author [A likely boring stuff made by] Shevek
 * @desc outer_html.ts — Affectation à `outerHTML` : l'élément est remplacé par la valeur interprétée comme du HTML.
 */
import { type AnalyzerMatch, type AnalyzerParams } from "../../constants/types";
import { type Visitor } from "@babel/traverse";
import * as t from "@babel/types";
import {
  buildSinkContext,
  taintReport,
  normalizeNode,
} from "../../taint/taint_report";
import {
  getTaintTable,
  taintIdentifier,
} from "../../taint/set_identifier_value";
import { LEAD_SCHEMA_VERSION, type Lead } from "../../constants/lead";
import { processStringConcatenation } from "../cspt/cspt_utils";
import { SHA256 } from "bun";
import { randomBytes } from "crypto";

export const OUTER_HTML_ANALYZER_NAME = "outer-html";

export function isOuterHTMLAssignment(
  node: t.MemberExpression | t.OptionalMemberExpression,
): boolean {
  return (
    (t.isIdentifier(node.property, { name: "outerHTML" }) && !node.computed) ||
    t.isStringLiteral(node.property, { value: "outerHTML" })
  );
}

const outerHTMLAnalyzerBuilder = (
  args: AnalyzerParams,
  matchesReturn: AnalyzerMatch[],
): Visitor => {
  return {
    AssignmentExpression(path) {
      const node = path.node;
      if (!node.loc || node.start == null || node.end == null) return;

      const left = node.left;
      if (!t.isMemberExpression(left) && !t.isOptionalMemberExpression(left))
        return;

      if (isOuterHTMLAssignment(left)) {
        const reconstructed = processStringConcatenation(
          path.get("right").node,
        );
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
          analyzerName: OUTER_HTML_ANALYZER_NAME,
          slot: { kind: "assignment-expression-right" },
          reconstructed: reconstructed,
          taint: taint,
        });
        const match: AnalyzerMatch = {
          filePath: args.filePath,
          analyzerName: OUTER_HTML_ANALYZER_NAME,
          value: args.source.slice(node.start, node.end),
          start: node.loc.start,
          end: node.loc.end,
          leads: leads,
        };

        matchesReturn.push(match);
      }
    },
  };
};

export { outerHTMLAnalyzerBuilder };
