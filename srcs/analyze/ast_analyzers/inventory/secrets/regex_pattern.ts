import {
  type AnalyzerMatch,
  type AnalyzerParams,
} from "../../../constants/types";
import { type Visitor } from "@babel/traverse";
import * as t from "@babel/types";
import { LEAD_SCHEMA_VERSION } from "../../../constants/lead";
import { SHA256 } from "bun";
export const REGEX_ANALYZER_NAME = "regex-pattern";

const regexAnalyzerBuilder = (
  args: AnalyzerParams,
  matchesReturn: AnalyzerMatch[],
): Visitor => {
  return {
    RegExpLiteral(path) {
      // Check if this is a regex literal
      const node = path.node;
      if (!node.loc || node.start == null || node.end == null) return;
      const match: AnalyzerMatch = {
        filePath: args.filePath,
        analyzerName: REGEX_ANALYZER_NAME,
        value: args.source.slice(node.start, node.end),
        start: node.loc.start,
        end: node.loc.end,
        leads: [
          {
            schemaVersion: LEAD_SCHEMA_VERSION,
            class: ["REGEX_PATTERN_INVENTORY"],
            hash: SHA256.hash(
              args.source.slice(node.start, node.end),
              "hex",
            ).toString(),
            analyzerName: REGEX_ANALYZER_NAME,
            reconstructed: args.source.slice(node.start, node.end),
          },
        ],
      };
      matchesReturn.push(match);
    },
    NewExpression(path) {
      const node = path.node;
      // On test le constructeur avec RegExp.
      /**@todo Ne prend PAS en compte les construction du type new window.RegExp par exemple, qui passeront donc à l'as. Demander
       * à claudo les autres cas qui peuvent passer à côté aussi. Pour l'instant, on garde cette faiblesse. */
      if (t.isIdentifier(node.callee, { name: "RegExp" })) {
        if (!node.loc || node.start == null || node.end == null) return;
        // Check if the first argument is a string literal
        if (node.arguments.length > 0 && t.isStringLiteral(node.arguments[0])) {
          const match: AnalyzerMatch = {
            filePath: args.filePath,
            analyzerName: REGEX_ANALYZER_NAME,
            value: args.source.slice(node.start, node.end),
            start: node.loc.start,
            end: node.loc.end,
            leads: [
              {
                schemaVersion: LEAD_SCHEMA_VERSION,
                class: ["REGEX_PATTERN_INVENTORY"],
                hash: SHA256.hash(
                  args.source.slice(node.start, node.end),
                  "hex",
                ).toString(),
                analyzerName: REGEX_ANALYZER_NAME,
                reconstructed: args.source.slice(node.start, node.end),
              },
            ],
          };
          matchesReturn.push(match);
        }
      }
    },
  };
};

export { regexAnalyzerBuilder };
