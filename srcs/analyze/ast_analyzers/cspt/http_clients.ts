import { type AnalyzerMatch, type AnalyzerParams } from "../../constants/types";
import { NodePath, type Visitor } from "@babel/traverse";
import * as t from "@babel/types";
import { isValidPath, processStringConcatenation } from "./cspt_utils";
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

export const HTTP_CLIENTS_ANALYZER_NAME = "http-clients";
export const FETCH_ANALYZER_NAME = "fetch";
export const AXIOS_ANALYZER_NAME = "axios";
export const REQUEST_ANALYZER_NAME = "request";
export const KY_ANALYZER_NAME = "ky";

const HTTP_METHODS = new Set([
  "post",
  "delete",
  "get",
  "put",
  "patch",
  "head",
  "options",
  "request",
  "ajax",
]);

/** Analyseurs dont le callee est un client HTTP nommé, donc porteur d'options de requête. */
const NAMED_HTTP_CLIENTS = new Set<string>([
  FETCH_ANALYZER_NAME,
  AXIOS_ANALYZER_NAME,
  KY_ANALYZER_NAME,
  REQUEST_ANALYZER_NAME,
]);

function createHttpMethodMatch(
  args: AnalyzerParams,
  path: NodePath<t.CallExpression | t.OptionalCallExpression>,
  analyzerName: string,
  request: LeadRequest,
  leads: Lead[],
): AnalyzerMatch {
  const node = path.node;
  return {
    filePath: args.filePath,
    analyzerName: analyzerName,
    value: args.source.slice(node.start!, node.end!),
    start: node.loc!.start,
    end: node.loc!.end,
    leads: leads,
  };
}

export function isHttpMethodCallExpression(
  node: t.CallExpression | t.OptionalCallExpression,
) {
  return (
    (t.isMemberExpression(node.callee) ||
      t.isOptionalMemberExpression(node.callee)) &&
    ((t.isIdentifier(node.callee.property) &&
      !node.callee.computed &&
      HTTP_METHODS.has(node.callee.property.name)) ||
      (t.isStringLiteral(node.callee.property) &&
        HTTP_METHODS.has(node.callee.property.value)))
  );
}

export function isRequestCallExpression(
  node: t.CallExpression | t.OptionalCallExpression,
) {
  return (
    ((t.isMemberExpression(node.callee) ||
      t.isOptionalMemberExpression(node.callee)) &&
      ((t.isIdentifier(node.callee.property) &&
        !node.callee.computed &&
        HTTP_METHODS.has(node.callee.property.name)) ||
        (t.isStringLiteral(node.callee.property) &&
          HTTP_METHODS.has(node.callee.property.value))) &&
      t.isIdentifier(node.callee.object, { name: "request" })) ||
    t.isIdentifier(node.callee, { name: "request" })
  );
}

export function isAxiosCallExpression(
  node: t.CallExpression | t.OptionalCallExpression,
) {
  return (
    ((t.isMemberExpression(node.callee) ||
      t.isOptionalMemberExpression(node.callee)) &&
      ((t.isIdentifier(node.callee.property) &&
        !node.callee.computed &&
        HTTP_METHODS.has(node.callee.property.name)) ||
        (t.isStringLiteral(node.callee.property) &&
          HTTP_METHODS.has(node.callee.property.value))) &&
      t.isIdentifier(node.callee.object, { name: "axios" })) ||
    t.isIdentifier(node.callee, { name: "axios" })
  );
}

export function isKyCallExpression(
  node: t.CallExpression | t.OptionalCallExpression,
) {
  return (
    ((t.isMemberExpression(node.callee) ||
      t.isOptionalMemberExpression(node.callee)) &&
      ((t.isIdentifier(node.callee.property) &&
        !node.callee.computed &&
        HTTP_METHODS.has(node.callee.property.name)) ||
        (t.isStringLiteral(node.callee.property) &&
          HTTP_METHODS.has(node.callee.property.value))) &&
      t.isIdentifier(node.callee.object, { name: "ky" })) ||
    t.isIdentifier(node.callee, { name: "ky" })
  );
}

export function isFetchCall(node: t.CallExpression | t.OptionalCallExpression) {
  return (
    ((t.isMemberExpression(node.callee) ||
      t.isOptionalMemberExpression(node.callee)) &&
      ((t.isIdentifier(node.callee.property, { name: "fetch" }) &&
        !node.callee.computed) ||
        t.isStringLiteral(node.callee.property, { value: "fetch" }))) ||
    t.isIdentifier(node.callee, { name: "fetch" })
  );
}

function getHTTPMethod(
  path: NodePath<t.CallExpression | t.OptionalCallExpression>,
  analyzerName: string,
): string {
  switch (analyzerName) {
    case KY_ANALYZER_NAME:
    case AXIOS_ANALYZER_NAME:
    case REQUEST_ANALYZER_NAME:
    case HTTP_CLIENTS_ANALYZER_NAME: {
      if (t.isIdentifier(path.node.callee)) {
        const args = path.get("arguments");
        if (args.length == 1) return "GET";
      }
      const prop = (
        path.node.callee as t.MemberExpression | t.OptionalMemberExpression
      ).property;
      if (t.isIdentifier(prop)) {
        return prop.name;
      } else if (t.isStringLiteral(prop)) {
        return prop.value;
      }
      return "UNKNOWN_METHOD";
    }
    case FETCH_ANALYZER_NAME: {
      const args = path.get("arguments");
      if (args.length == 1) return "GET";
      const options = args[1];
      if (options && t.isObjectExpression(options.node)) {
        const props = (options as NodePath<t.ObjectExpression>).get(
          "properties",
        );
        for (const prop of props) {
          if (
            prop.isObjectProperty() &&
            t.isIdentifier(prop.node.key) &&
            !prop.node.computed &&
            prop.node.key.name === "method"
          ) {
            if (t.isStringLiteral(prop.node.value))
              return prop.node.value.value;
            return "UNKNOWN OPTION VALUE";
          }
        }
        return "GET";
      }
      return "UNKNOWN_METHOD";
    }
    default:
      return "UNKNOWN_METHOD";
  }
}

/**
 * @brief Aplatit les options passées au client HTTP en couples chaîne → chaîne.
 * @return Un objet nu.
 */
function getHTTPClientOptions(
  path: NodePath<t.CallExpression | t.OptionalCallExpression>,
): Record<string, string> {
  const args = path.get("arguments");
  const options: Record<string, string> = {};
  args.forEach((arg, i) => {
    if (i === 0) return;
    if (t.isObjectExpression(arg.node)) {
      const props = (arg as NodePath<t.ObjectExpression>).get("properties");
      for (const prop of props) {
        if (prop.isObjectProperty() && t.isIdentifier(prop.node.key)) {
          options[`${prop.node.key.name} (arguments[${i}])`] = prop
            .get("value")
            .toString();
        }
      }
    }
  });
  return options;
}

const httpMethodsAnalyzerBuilder = (
  args: AnalyzerParams,
  matchesReturn: AnalyzerMatch[],
): Visitor => {
  const handleCallExpression = (
    path: NodePath<t.CallExpression | t.OptionalCallExpression>,
  ) => {
    const node = path.node;
    if (!node.loc || node.start == null || node.end == null) return;

    let analyzerName;
    if (isFetchCall(node)) analyzerName = FETCH_ANALYZER_NAME;
    else if (isAxiosCallExpression(node)) analyzerName = AXIOS_ANALYZER_NAME;
    else if (isRequestCallExpression(node))
      analyzerName = REQUEST_ANALYZER_NAME;
    else if (isKyCallExpression(node)) analyzerName = KY_ANALYZER_NAME;
    else if (isHttpMethodCallExpression(node))
      analyzerName = HTTP_CLIENTS_ANALYZER_NAME;
    else return;

    let hasValidPath = false;
    const leads: Lead[] = [];
    path.get("arguments").forEach((argument, index) => {
      const reconstructed = processStringConcatenation(argument.node);
      if (!isValidPath(reconstructed)) return;

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
      hasValidPath = true;
      leads.push({
        schemaVersion: LEAD_SCHEMA_VERSION,
        class: ["CSPT"],
        hash: hash,
        analyzerName: analyzerName,
        slot: { kind: "call-argument", index: index },
        reconstructed: reconstructed,
        taint: taint,
      });
    });

    if (!hasValidPath) return;

    const request: LeadRequest = {
      method: getHTTPMethod(path, analyzerName).toUpperCase(),
      options: NAMED_HTTP_CLIENTS.has(analyzerName)
        ? getHTTPClientOptions(path)
        : {},
    };
    for (const lead of leads) lead.request = request;
    matchesReturn.push(
      createHttpMethodMatch(args, path, analyzerName, request, leads),
    );
  };
  return {
    CallExpression: handleCallExpression,
    OptionalCallExpression: handleCallExpression,
  };
};

export { httpMethodsAnalyzerBuilder };
