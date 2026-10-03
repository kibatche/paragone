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
  isValidPath,
} from "../cspt/cspt_utils";
import { LEAD_SCHEMA_VERSION } from "../../constants/lead";
import { SHA256 } from "bun";

export const ROBUST_PATHS_ANALYZER_NAME = "robust-paths";

const robustPathsAnalyzerBuilder = (
  args: AnalyzerParams,
  matchesReturn: AnalyzerMatch[],
): Visitor => {
  // du type "/api/admin/id"
  const handleStringLiteral = (path: NodePath<t.StringLiteral>) => {
    const node = path.node;
    if (!node.loc || node.start == null || node.end == null) return;
    // pas de match avec les imports du type import {x} from "/chemin/vers/module"
    if (path.findParent((p) => p.isImportDeclaration())) return;

    if (isValidPath(node.value)) {
      const match: AnalyzerMatch = {
        filePath: args.filePath,
        analyzerName: ROBUST_PATHS_ANALYZER_NAME,
        value: args.source.slice(node.start, node.end),
        start: node.loc.start,
        end: node.loc.end,
        leads: [
          {
            schemaVersion: LEAD_SCHEMA_VERSION,
            class: ["ROBUST_PATH"],
            hash: SHA256.hash(
              args.source.slice(node.start, node.end),
              "hex",
            ).toString(),
            analyzerName: ROBUST_PATHS_ANALYZER_NAME,
            reconstructed: node.value,
          },
        ],
      };
      matchesReturn.push(match);
    }
  };

  // du type "/admin/${e}/id"
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
    if (isValidPath(processedValue)) {
      const match: AnalyzerMatch = {
        filePath: args.filePath,
        analyzerName: ROBUST_PATHS_ANALYZER_NAME,
        value: args.source.slice(node.start, node.end),
        start: node.loc.start,
        end: node.loc.end,
        leads: [
          {
            schemaVersion: LEAD_SCHEMA_VERSION,
            class: ["ROBUST_PATH"],
            hash: SHA256.hash(
              args.source.slice(node.start, node.end),
              "hex",
            ).toString(),
            analyzerName: ROBUST_PATHS_ANALYZER_NAME,
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
        processedValue = processedValueEval.value;
      } else {
        processedValue = getBinaryExpressionStr(node);
      }
      if (isValidPath(processedValue)) {
        const match: AnalyzerMatch = {
          filePath: args.filePath,
          analyzerName: ROBUST_PATHS_ANALYZER_NAME,
          value: args.source.slice(node.start, node.end),
          start: node.loc.start,
          end: node.loc.end,
          leads: [
            {
              schemaVersion: LEAD_SCHEMA_VERSION,
              class: ["ROBUST_PATH"],
              hash: SHA256.hash(
                args.source.slice(node.start, node.end),
                "hex",
              ).toString(),
              analyzerName: ROBUST_PATHS_ANALYZER_NAME,
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
      if (isValidPath(processedValue)) {
        const match: AnalyzerMatch = {
          filePath: args.filePath,
          analyzerName: ROBUST_PATHS_ANALYZER_NAME,
          value: args.source.slice(node.start, node.end),
          start: node.loc.start,
          end: node.loc.end,
          leads: [
            {
              schemaVersion: LEAD_SCHEMA_VERSION,
              class: ["ROBUST_PATH"],
              hash: SHA256.hash(
                args.source.slice(node.start, node.end),
                "hex",
              ).toString(),
              analyzerName: ROBUST_PATHS_ANALYZER_NAME,
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

export { robustPathsAnalyzerBuilder };
