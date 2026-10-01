/**
 * @author [A likely boring stuff made by] Shevek
 * @desc innerhtml_property.ts — Propriété d'objet `innerHTML:` / `outerHTML:` : forme compilée de `v-html`
 *       (Vue 3, props de vnode) et de `domProps: { innerHTML }` (Vue 2). Le rendu l'affecte à l'élément.
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

export const INNER_HTML_PROPERTY_ANALYZER_NAME = "innerhtml-property";

const HTML_PROPERTY_KEYS = ["innerHTML", "outerHTML"];

const innerHTMLPropertyAnalyzerBuilder = (
  args: AnalyzerParams,
  matchesReturn: AnalyzerMatch[],
): Visitor => {
  const handleObjectExpression = (path: NodePath<t.ObjectExpression>) => {
    const node = path.node;
    if (!node.loc || node.start == null || node.end == null) return;

    const leads: Lead[] = [];
    path.get("properties").forEach((property, index) => {
      if (!property.isObjectProperty()) return;
      const keyName = getPropertyKeyName(property);
      if (!keyName || !HTML_PROPERTY_KEYS.includes(keyName)) return;

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
        analyzerName: INNER_HTML_PROPERTY_ANALYZER_NAME,
        slot: { kind: "object-property", index: index, key: keyName },
        reconstructed: reconstructed,
        taint: taint,
      });
    });
    if (leads.length === 0) return;

    const match: AnalyzerMatch = {
      filePath: args.filePath,
      analyzerName: INNER_HTML_PROPERTY_ANALYZER_NAME,
      value: args.source.slice(node.start, node.end),
      start: node.loc.start,
      end: node.loc.end,
      leads: leads,
    };
    matchesReturn.push(match);
  };
  return { ObjectExpression: handleObjectExpression };
};

export { innerHTMLPropertyAnalyzerBuilder };
