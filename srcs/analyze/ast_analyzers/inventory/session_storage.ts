import { type AnalyzerMatch, type AnalyzerParams } from "../../constants/types";
import { NodePath, type Visitor } from "@babel/traverse";
import * as t from "@babel/types";
import {
  isSessionStorageReadCall,
  isSessionStorageWriteCall,
} from "../sources/session_storage";
import { LEAD_SCHEMA_VERSION } from "../../constants/lead";
import { SHA256 } from "bun";

export const SESSION_STORAGE_ANALYZER_NAME = "session-storage";

const sessionStorageAnalyzerBuilder = (
  args: AnalyzerParams,
  matchesReturn: AnalyzerMatch[],
): Visitor => {
  const handle = (
    path: NodePath<t.CallExpression | t.OptionalCallExpression>,
  ) => {
    const node = path.node;
    if (!node.loc || node.start == null || node.end == null) return;

    if (isSessionStorageReadCall(node) || isSessionStorageWriteCall(node)) {
      const match: AnalyzerMatch = {
        filePath: args.filePath,
        analyzerName: SESSION_STORAGE_ANALYZER_NAME,
        value: args.source.slice(node.start, node.end),
        start: node.loc.start,
        end: node.loc.end,
        leads: [
          {
            schemaVersion: LEAD_SCHEMA_VERSION,
            class: ["SESSION_STORAGE_INVENTORY"],
            hash: SHA256.hash(
              args.source.slice(node.start, node.end),
              "hex",
            ).toString(),
            analyzerName: SESSION_STORAGE_ANALYZER_NAME,
            reconstructed: args.source.slice(node.start, node.end),
          },
        ],
      };

      matchesReturn.push(match);
    }
  };
  return { CallExpression: handle, OptionalCallExpression: handle };
};

export { sessionStorageAnalyzerBuilder };
