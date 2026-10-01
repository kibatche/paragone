import { type AnalyzerMatch, type AnalyzerParams } from "../../constants/types";
import { NodePath, type Visitor } from "@babel/traverse";
import * as t from "@babel/types";
import {
  getPropertyKeyName,
  isValidPath,
  processStringConcatenation,
} from "./cspt_utils";
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
  type Lead,
  type LeadRequest,
  LEAD_SCHEMA_VERSION,
} from "../../constants/lead";
import { SHA256 } from "bun";
import { randomBytes } from "crypto";

export const URL_IN_OBJECT_EXPR_ANALYZER_NAME = "url-in-object-expression";

const URL_IN_OBJECT_EXPR_KEY = new Set([
  "url",
  "path",
  "endpoint",
  "uri",
  "route",
  "query",
  "src",
  "href",
]);

/**
 * Clés de l'objet de configuration qui décrivent la requête plutôt que sa cible.
 *
 * `credentials` et `withCredentials` sont ce qui atteste que la requête détournée portera la
 * session de la victime ; sans elles, la primitive est plus faible. Elles vivent dans le MÊME objet
 * que l'URL, donc rien n'oblige à sortir du porteur pour les lire.
 */
const REQUEST_DESCRIPTION_KEY = new Set([
  "method",
  "credentials",
  "withCredentials",
]);

function createUrlObjectExpressionMatch(
  args: AnalyzerParams,
  path: NodePath<t.ObjectExpression>,
  leads: Lead[],
): AnalyzerMatch {
  const node = path.node;
  return {
    filePath: args.filePath,
    analyzerName: URL_IN_OBJECT_EXPR_ANALYZER_NAME,
    value: args.source.slice(node.start!, node.end!),
    start: node.loc!.start,
    end: node.loc!.end,
    leads: leads,
  };
}

/**
 * @brief Lit la description de la requête dans les autres propriétés du même objet.
 * @return La méthode, en majuscules quand elle est littérale, et les options de crédentiels.
 */
function readRequestDescription(
  path: NodePath<t.ObjectExpression>,
): LeadRequest {
  const request: LeadRequest = { method: "UNKNOWN_METHOD", options: {} };
  for (const property of path.get("properties")) {
    if (!property.isObjectProperty()) continue;
    const keyName = getPropertyKeyName(property);
    if (!keyName || !REQUEST_DESCRIPTION_KEY.has(keyName)) continue;

    const value = property.get("value");
    if (keyName === "method" && value.isStringLiteral()) {
      request.method = value.node.value.toUpperCase();
      continue;
    }
    if (keyName !== "method") request.options[keyName] = value.toString();
  }
  return request;
}

const urlInObjectExpressionAnalyzerBuilder = (
  args: AnalyzerParams,
  matchesReturn: AnalyzerMatch[],
): Visitor => {
  const handleObjectExpression = (path: NodePath<t.ObjectExpression>) => {
    const node = path.node;
    if (!node.loc || node.start == null || node.end == null) return;

    let hasValidPath = false;
    const leads: Lead[] = [];
    path.get("properties").forEach((property, index) => {
      if (!property.isObjectProperty()) return;
      const keyName = getPropertyKeyName(property);
      if (!keyName || !URL_IN_OBJECT_EXPR_KEY.has(keyName)) return;

      const value = property.get("value");
      const reconstructed = processStringConcatenation(value.node);
      if (!isValidPath(reconstructed)) return;
      hasValidPath = true;

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
        class: ["CSPT", "OPEN_REDIRECT"],
        hash: hash,
        analyzerName: URL_IN_OBJECT_EXPR_ANALYZER_NAME,
        slot: { kind: "object-property", index: index, key: keyName },
        reconstructed: reconstructed,
        taint: taint,
      });
    });
    if (!hasValidPath) return;

    // Lue une seule fois, après le match : elle est identique pour toutes les clés du même objet.
    const request = readRequestDescription(path);
    for (const lead of leads) lead.request = request;
    matchesReturn.push(createUrlObjectExpressionMatch(args, path, leads));
  };
  return { ObjectExpression: handleObjectExpression };
};

export { urlInObjectExpressionAnalyzerBuilder };
