import {
  type AnalyzerMatch,
  type AnalyzerParams,
} from "../../../constants/types";
import { NodePath, type Visitor } from "@babel/traverse";
import * as t from "@babel/types";
import { LEAD_SCHEMA_VERSION } from "../../../constants/lead";
import { SHA256 } from "bun";

export const REGEX_MATCH_ANALYZER_NAME = "regex-match";

const regexMatchAnalyzerBuilder = (
  args: AnalyzerParams,
  matchesReturn: AnalyzerMatch[],
): Visitor => {
  const handleCallExpression = (
    path: NodePath<t.CallExpression | t.OptionalCallExpression>,
  ) => {
    const node = path.node;
    if (!node.loc || node.start == null || node.end == null) return;
    const callee = node.callee;

    if (!t.isMemberExpression(callee) && !t.isOptionalMemberExpression(callee))
      return;

    // Check for whatever.match() calls
    const isMatchCall =
      node.arguments.length > 0 &&
      ((t.isIdentifier(callee.property, { name: "match" }) &&
        !callee.computed) ||
        t.isStringLiteral(callee.property, { value: "match" })) &&
      t.isRegExpLiteral(node.arguments[0]); // On ne met pas le string literal, un tel tests x.match('foo') n'a pas vraiment de sens.

    // check for anyregex.test|exec(whatever)
    const isTestExecCall =
      node.arguments.length > 0 &&
      t.isRegExpLiteral(callee.object) &&
      ((t.isIdentifier(callee.property, { name: "test" }) &&
        !callee.computed) ||
        t.isStringLiteral(callee.property, { value: "test" }) ||
        (t.isIdentifier(callee.property, { name: "exec" }) &&
          !callee.computed) ||
        t.isStringLiteral(callee.property, { value: "exec" }));

    if (isMatchCall || isTestExecCall) {
      const match: AnalyzerMatch = {
        filePath: args.filePath,
        analyzerName: REGEX_MATCH_ANALYZER_NAME,
        value: args.source.slice(node.start, node.end),
        start: node.loc.start,
        end: node.loc.end,
        leads: [
          {
            schemaVersion: LEAD_SCHEMA_VERSION,
            class: ["REGEX_MATCH_INVENTORY"],
            hash: SHA256.hash(
              args.source.slice(node.start, node.end),
              "hex",
            ).toString(),
            analyzerName: REGEX_MATCH_ANALYZER_NAME,
            reconstructed: args.source.slice(node.start, node.end),
          },
        ],
      };
      matchesReturn.push(match);
    }
  };
  return {
    CallExpression: handleCallExpression,
    OptionalCallExpression: handleCallExpression,
  };
};

export { regexMatchAnalyzerBuilder };
