import type { AnalyzerMatch, AnalyzerParams } from "../../constants/types";
import { NodePath } from "@babel/traverse";
import type { Visitor } from "@babel/traverse";
import * as t from "@babel/types";
import type { BinaryExpression } from "@babel/types";
import {
  getBinaryExpressionStr,
  getConcatCallExprStr,
  getTemplateLiteralStr,
  isConcatCallExpr,
} from "../cspt/cspt_utils";
import { LEAD_SCHEMA_VERSION } from "../../constants/lead";
import { SHA256 } from "bun";
import {
  HOSTNAME_REGEX,
  IANA_TLD,
  UNWANTED_VALS,
} from "../../constants/iana_tld";

export const HOSTNAME_ANALYZER_NAME = "hostname";

function unwanted(val: string): boolean {
  return (
    UNWANTED_VALS.some((unval) => val.includes(unval)) ||
    val.startsWith("react.") ||
    val === "https://" ||
    val === "http://"
  );
}

function isValidDomain(value: string) {
  if (!value) return false;
  if (value.startsWith("https://") || value.startsWith("http://")) return true;
  if (HOSTNAME_REGEX.test(value)) {
    const h = value.split(".").at(-1)?.toUpperCase();
    if (!h || !IANA_TLD.has(h)) return false;
    return true;
  }
  return false;
}

const hostnameAnalyzerBuilder = (
  args: AnalyzerParams,
  matchesReturn: AnalyzerMatch[],
): Visitor => {
  const handleStringLiteral = (path: NodePath<t.StringLiteral>) => {
    const node = path.node;
    if (!node.loc || node.start == null || node.end == null) return;

    if (isValidDomain(node.value) && unwanted(node.value) === false) {
      const match: AnalyzerMatch = {
        filePath: args.filePath,
        analyzerName: HOSTNAME_ANALYZER_NAME,
        value: args.source.slice(node.start, node.end),
        start: node.loc.start,
        end: node.loc.end,
        leads: [
          {
            schemaVersion: LEAD_SCHEMA_VERSION,
            class: ["HOSTNAME_INVENTORY"],
            hash: SHA256.hash(
              args.source.slice(node.start, node.end),
              "hex",
            ).toString(),
            analyzerName: HOSTNAME_ANALYZER_NAME,
            reconstructed: node.value,
          },
        ],
      };
      matchesReturn.push(match);
    }
  };

  const handleTemplateLiteral = (path: NodePath<t.TemplateLiteral>) => {
    const node = path.node;
    if (!node.loc || node.start == null || node.end == null) return;

    const processedValueEval = path.evaluate();
    let processedValue;
    if (processedValueEval.confident == true) {
      processedValue = processedValueEval.value;
    } else {
      processedValue = getTemplateLiteralStr(node);
    }
    if (isValidDomain(processedValue) && unwanted(processedValue) === false) {
      const match: AnalyzerMatch = {
        filePath: args.filePath,
        analyzerName: HOSTNAME_ANALYZER_NAME,
        value: args.source.slice(node.start, node.end),
        start: node.loc.start,
        end: node.loc.end,
        leads: [
          {
            schemaVersion: LEAD_SCHEMA_VERSION,
            class: ["HOSTNAME_INVENTORY"],
            hash: SHA256.hash(
              args.source.slice(node.start, node.end),
              "hex",
            ).toString(),
            analyzerName: HOSTNAME_ANALYZER_NAME,
            reconstructed: processedValue,
          },
        ],
      };
      matchesReturn.push(match);
    }
  };

  const handleBinaryExpression = (path: NodePath<BinaryExpression>) => {
    const node = path.node;
    if (!node.loc || node.start == null || node.end == null) return;

    if (node.operator === "+") {
      let processedValue;
      const processedValueEval = path.evaluate();
      if (processedValueEval.confident == true) {
        processedValue = String(processedValueEval.value);
      } else {
        processedValue = getBinaryExpressionStr(node);
      }
      if (isValidDomain(processedValue) && unwanted(processedValue) === false) {
        const match: AnalyzerMatch = {
          filePath: args.filePath,
          analyzerName: HOSTNAME_ANALYZER_NAME,
          value: args.source.slice(node.start, node.end),
          start: node.loc.start,
          end: node.loc.end,
          leads: [
            {
              schemaVersion: LEAD_SCHEMA_VERSION,
              class: ["HOSTNAME_INVENTORY"],
              hash: SHA256.hash(
                args.source.slice(node.start, node.end),
                "hex",
              ).toString(),
              analyzerName: HOSTNAME_ANALYZER_NAME,
              reconstructed: processedValue,
            },
          ],
        };
        matchesReturn.push(match);
      }
    }
  };

  const handleCallExpression = (
    path: NodePath<t.CallExpression | t.OptionalCallExpression>,
  ) => {
    const node = path.node;
    if (!node.loc || node.start == null || node.end == null) return;

    if (
      !t.isMemberExpression(node.callee) &&
      !t.isOptionalMemberExpression(node.callee)
    )
      return;

    if (isConcatCallExpr(node)) {
      let processedValue;
      const processedValueEval = path.evaluate();
      if (processedValueEval.confident == true) {
        processedValue = processedValueEval.value;
      } else {
        processedValue = getConcatCallExprStr(node);
      }
      if (isValidDomain(processedValue) && unwanted(processedValue) === false) {
        const match: AnalyzerMatch = {
          filePath: args.filePath,
          analyzerName: HOSTNAME_ANALYZER_NAME,
          value: args.source.slice(node.start, node.end),
          start: node.loc.start,
          end: node.loc.end,
          leads: [
            {
              schemaVersion: LEAD_SCHEMA_VERSION,
              class: ["HOSTNAME_INVENTORY"],
              hash: SHA256.hash(
                args.source.slice(node.start, node.end),
                "hex",
              ).toString(),
              analyzerName: HOSTNAME_ANALYZER_NAME,
              reconstructed: processedValue,
            },
          ],
        };
        matchesReturn.push(match);
      }
    }
  };
  return {
    StringLiteral: handleStringLiteral,
    TemplateLiteral: handleTemplateLiteral,
    BinaryExpression: handleBinaryExpression,
    CallExpression: handleCallExpression,
    OptionalCallExpression: handleCallExpression,
  };
};

export { hostnameAnalyzerBuilder };
