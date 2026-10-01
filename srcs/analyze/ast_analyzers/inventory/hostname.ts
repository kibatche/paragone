import { IANA_TLD } from "../../constants/iana_tld";
import { LEAD_SCHEMA_VERSION } from "../../constants/lead";
import { type AnalyzerMatch, type AnalyzerParams } from "../../constants/types";
import { type Visitor } from "@babel/traverse";
import { SHA256 } from "bun";

export const HOSTNAME_ANALYZER_NAME = "hostname";

// Regex pattern to match hostnames
// Matches:
// - Domain names with subdomains (e.g. sub.example.com)
// - Allows only letters, numbers, hyphens, and dots
// - Each label must start and end with a letter or number
// - Labels cannot start or end with hyphens
const HOSTNAME_REGEX = new RegExp(
  `^(?!.*\\.(js|ts|jsx|tsx|html|css|json|md|txt|xml|yaml|yml|svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot|otf|mp4|webm|mp3|wav|pdf|zip|tar|gz|rar|7z|sql|db|sqlite|env|log|lock|map|min|bundle|config|conf|ini|toml|lock|pem|key|crt|cer|p12|pfx|bak|tmp|temp)$)[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])*\\.[a-zA-Z]{2,4}$`,
  "i",
);

const hostnameAnalyzerBuilder = (
  args: AnalyzerParams,
  matchesReturn: AnalyzerMatch[],
): Visitor => {
  return {
    StringLiteral(path) {
      const node = path.node;
      if (!node.loc || node.start == null || node.end == null) return;

      if (HOSTNAME_REGEX.test(node.value)) {
        // ajout d'un vrai check de hostname via la liste IANA. Elimine énormément de bruit.
        const h = node.value.split(".").at(-1)?.toUpperCase();
        if (!h || !IANA_TLD.has(h)) return;
        try {
          new URL(`https://${node.value}`);
        } catch {
          return;
        }

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

        if (
          node.value.includes("www.w3.org") ||
          node.value.startsWith("react.")
        ) {
          return;
        }

        matchesReturn.push(match);
      }
    },
  };
};

export { hostnameAnalyzerBuilder };
