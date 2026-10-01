import { type AnalyzerMatch, type AnalyzerParams } from "../../constants/types";
import { NodePath, type Visitor } from "@babel/traverse";
import * as t from "@babel/types";
import { getPropertyKeyName } from "../cspt/cspt_utils";
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

export const DANGEROUS_HTML_ANALYZER_NAME = "dangerouslySetInnerHTML";

const dangerousHtmlAnalyzerBuilder = (
  args: AnalyzerParams,
  matchesReturn: AnalyzerMatch[],
): Visitor => {
  // Handle object properties
  const handleObjectExpression = (path: NodePath<t.ObjectExpression>) => {
    const node = path.node;
    if (!node.loc || node.start == null || node.end == null) return;
    if (node.properties.length < 1) return;

    let isDangerouslySetInnerHTML = false;

    const leads: Lead[] = [];
    path.get("properties").forEach((property, index) => {
      if (!property.isObjectProperty()) return;

      const keyName = getPropertyKeyName(property);

      if (!keyName || keyName !== "dangerouslySetInnerHTML") return;

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

      isDangerouslySetInnerHTML = true;

      leads.push({
        schemaVersion: LEAD_SCHEMA_VERSION,
        class: ["XSS"],
        hash: hash,
        analyzerName: DANGEROUS_HTML_ANALYZER_NAME,
        slot: { kind: "object-property", index: index, key: keyName },
        reconstructed: reconstructed,
        taint: taint,
      });
    });

    if (isDangerouslySetInnerHTML) {
      const match: AnalyzerMatch = {
        filePath: args.filePath,
        analyzerName: DANGEROUS_HTML_ANALYZER_NAME,
        value: args.source.slice(node.start, node.end),
        start: node.loc.start,
        end: node.loc.end,
        leads: leads,
      };
      matchesReturn.push(match);
    }
  };

  // Handle JSX elements
  const handleJSXElement = (path: NodePath<t.JSXElement>) => {
    const node = path.node;
    if (!node.loc || node.start == null || node.end == null) return;

    let isDangerouslySetInnerHTML = false;
    const leads: Lead[] = [];
    path
      .get("openingElement")
      .get("attributes")
      .forEach((a) => {
        if (
          a.isJSXAttribute() &&
          t.isJSXIdentifier(a.node.name, { name: "dangerouslySetInnerHTML" })
        ) {
          const value = a.get("value");
          if (!value.isJSXExpressionContainer()) return;
          const expression = value.get("expression");
          if (!expression.isObjectExpression()) return;
          expression.get("properties").forEach((property, index) => {
            if (!property.isObjectProperty()) return;
            const keyName = getPropertyKeyName(property);
            if (!keyName || keyName !== "__html") return;

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
            isDangerouslySetInnerHTML = true;

            leads.push({
              schemaVersion: LEAD_SCHEMA_VERSION,
              class: ["XSS"],
              hash: hash,
              analyzerName: DANGEROUS_HTML_ANALYZER_NAME,
              slot: { kind: "object-property", index: index, key: keyName },
              reconstructed: reconstructed,
              taint: taint,
            });
          });
        }
      });

    if (isDangerouslySetInnerHTML) {
      const match: AnalyzerMatch = {
        filePath: args.filePath,
        analyzerName: DANGEROUS_HTML_ANALYZER_NAME,
        value: args.source.slice(node.start, node.end),
        start: node.loc.start,
        end: node.loc.end,
        leads: leads,
      };
      matchesReturn.push(match);
    }
  };
  return {
    ObjectExpression: handleObjectExpression,
    JSXElement: handleJSXElement,
  };
};

export { dangerousHtmlAnalyzerBuilder };
