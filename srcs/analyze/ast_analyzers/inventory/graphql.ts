import { LEAD_SCHEMA_VERSION } from "../../constants/lead";
import { type AnalyzerMatch, type AnalyzerParams } from "../../constants/types";
import { type Visitor } from "@babel/traverse";
import { SHA256 } from "bun";

// This regex matches the start of GraphQL queries and mutations
// It allows:
// - Queries starting with 'query' or 'mutation'
// - Optional operation names
// - Leading whitespace
const GRAPHQL_REGEX =
  /(query|mutation|type|fragment|subscription|directive|input|enum|interface|union|scalar|object|list|nonnull)/;

// Checks if a string is a valid GraphQL operation
function isValidGraphQLOperation(str: string): boolean {
  // Basic validation of GraphQL structure
  const trimmed = str.trim();

  // Must start with query or mutation
  if (
    !trimmed.startsWith("query") &&
    !trimmed.startsWith("mutation") &&
    !trimmed.startsWith("type") &&
    !trimmed.startsWith("fragment") &&
    !trimmed.startsWith("subscription") &&
    !trimmed.startsWith("input") &&
    !trimmed.startsWith("enum") &&
    !trimmed.startsWith("interface") &&
    !trimmed.startsWith("union") &&
    !trimmed.startsWith("scalar") &&
    !trimmed.startsWith("object") &&
    !trimmed.startsWith("list") &&
    !trimmed.startsWith("nonnull")
  ) {
    return false;
  }

  // Must contain at least one field selection
  if (!trimmed.includes("}") || !trimmed.match(/(?<!\$){/)) {
    return false;
  }

  // Check for balanced braces
  let braceCount = 0;
  for (const char of trimmed) {
    if (char === "{") braceCount++;
    if (char === "}") braceCount--;
    if (braceCount < 0) {
      return false;
    }
  }

  if (braceCount !== 0) {
    return false;
  }

  return trimmed.includes("{") && trimmed.includes("}");
}

export const GRAPHQL_ANALYZER_NAME = "graphql";

const graphqlAnalyzerBuilder = (
  args: AnalyzerParams,
  matchesReturn: AnalyzerMatch[],
): Visitor => {
  return {
    StringLiteral(path) {
      const node = path.node;
      if (!node.loc) return;
      if (!isValidGraphQLOperation(node.value)) {
        return;
      }
      if (GRAPHQL_REGEX.test(node.value)) {
        const match: AnalyzerMatch = {
          filePath: args.filePath,
          analyzerName: GRAPHQL_ANALYZER_NAME,
          value: node.value,
          start: node.loc.start,
          end: node.loc.end,
          leads: [
            {
              schemaVersion: LEAD_SCHEMA_VERSION,
              class: ["GRAPHQL_INVENTORY"],
              hash: SHA256.hash(node.value, "hex").toString(),
              analyzerName: GRAPHQL_ANALYZER_NAME,
              reconstructed: node.value,
            },
          ],
        };

        matchesReturn.push(match);
      }
    },
    TemplateLiteral(path) {
      const node = path.node;
      if (!node.loc || node.start == null || node.end == null) return;
      const rawValue = args.source
        .slice(node.start, node.end)
        .replaceAll("`", "");

      if (!isValidGraphQLOperation(rawValue)) {
        return;
      }

      if (GRAPHQL_REGEX.test(rawValue)) {
        const match: AnalyzerMatch = {
          filePath: args.filePath,
          analyzerName: GRAPHQL_ANALYZER_NAME,
          value: rawValue,
          start: node.loc.start,
          end: node.loc.end,
          leads: [
            {
              schemaVersion: LEAD_SCHEMA_VERSION,
              class: ["GRAPHQL_INVENTORY"],
              hash: SHA256.hash(rawValue, "hex").toString(),
              analyzerName: GRAPHQL_ANALYZER_NAME,
              reconstructed: rawValue,
            },
          ],
        };
        matchesReturn.push(match);
      }
    },
  };
};

export { graphqlAnalyzerBuilder };
