/**
 * @description Ce fichier contient les utilitaires servant à traiter les valeurs contenant potentiellement une URL/URI dynamique
 */
import type { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import { type ReconstructibleNode } from "../../taint/taint_report";

function isHighEntropy(str: string, threshold = 4.9): boolean {
  const freq: Record<string, number> = {};
  for (const char of str) {
    freq[char] = (freq[char] || 0) + 1;
  }

  let entropy = 0;
  const len = str.length;

  for (const compte of Object.values(freq)) {
    const p = compte / len;
    entropy -= p * Math.log2(p);
  }

  return entropy >= threshold;
}

// most logic stolen from https://github.com/BishopFox/jsluice
// all credit to them

const hostnamesToExclude = new Set(["www.w3.org", "reactjs.org"]);

function containsAny(str: string, chars: string): boolean {
  return chars.split("").some((char) => str.includes(char));
}

function hasPrefix(str: string, prefix: string): boolean {
  return str.startsWith(prefix);
}

export function getPropertyKeyName(
  property: NodePath<t.ObjectProperty>,
): string | undefined {
  const key = property.get("key");
  if (key.isIdentifier() && !property.node.computed) return key.node.name;
  if (key.isStringLiteral()) return key.node.value;
  return undefined;
}

export function isReconstructible(
  value: NodePath<t.Node>,
): value is NodePath<ReconstructibleNode> {
  const node = value.node;
  if (t.isCallExpression(node) || t.isOptionalCallExpression(node))
    return isConcatCallExpr(node);
  return (
    t.isStringLiteral(node) ||
    t.isTemplateLiteral(node) ||
    t.isBinaryExpression(node) ||
    t.isCallExpression(node) ||
    t.isOptionalCallExpression(node)
  );
}

export function isValidPath(value: string): boolean {
  // Check if path starts with a letter or forward slash
  if (!/^[a-zA-Z/]/.test(value)) {
    return false;
  }

  // Check if path contains at least one letter
  if (!/[a-zA-Z]/.test(value)) {
    return false;
  }

  // Basic path-like check
  if (!value.includes("/")) {
    return false;
  }

  // Exclude strings with special characters
  if (containsAny(value, " ()!<>'\"`{}^$,")) {
    return false;
  }

  // Exclude paths that are just "./" or "../"
  if (/^\.\.?\/?$/.test(value)) {
    return false;
  }

  // Exclude paths that end with a slash and have no actual path content
  if (/^[^/]*\/$/.test(value)) {
    return false;
  }

  // Check if at least one path segment is longer than 3 characters
  const parts = value.split("/").filter(Boolean);
  if (!parts.some((part) => part.length >= 3)) {
    return false;
  }

  // If all parts are just "EXPR", it's not a valid path
  if (
    parts.every(
      (part) =>
        part.startsWith("EXPR") ||
        (part.startsWith("EXPR") && part.endsWith("EXPR")),
    )
  ) {
    return false;
  }

  // Paths starting with slash are likely valid
  if (hasPrefix(value, "/") && !value.startsWith("//")) {
    return true;
  }

  // Try to parse as URL first
  if (value.includes("://") || value.startsWith("//")) {
    try {
      const url = new URL(value.startsWith("//") ? `http:${value}` : value);

      // Check scheme
      const scheme = url.protocol.toLowerCase().replace(":", "");
      if (scheme !== "http" && scheme !== "https") {
        return false;
      }

      if (hostnamesToExclude.has(url.hostname)) {
        return false;
      }

      // Check hostname
      if (url.hostname.split(".").length > 1) {
        return true;
      }

      // Check query parameters
      if (url.searchParams.toString()) {
        return true;
      }

      // Check for file extension
      if (containsAny(url.pathname, ".")) {
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  const isHostname =
    value.includes(".") && value.indexOf(".") < value.indexOf("/");

  try {
    let url: URL | null = null;
    if (isHostname) {
      url = new URL(`https://${value}`);
    } else {
      url = new URL(value, "http://randombase.com");
    }

    if (hostnamesToExclude.has(url.hostname)) {
      return false;
    }

    if (
      isHostname &&
      (url.pathname === "" || url.pathname === "/") &&
      url.search === "" &&
      url.hash === ""
    ) {
      return false;
    }
  } catch (e) {
    void e;
  }

  // For relative paths, check if they have a valid structure
  if (parts.length === 0) {
    return false;
  }

  // Check if any part contains a dot (potential file extension)
  if (containsAny(value, ".")) {
    return true;
  }

  // Check if it has query parameters
  if (value.includes("?")) {
    return true;
  }

  if (isHighEntropy(value)) {
    return false;
  }

  // If it has multiple segments, it's likely a path
  return true;
}

export function processStringConcatenation(node: t.Node): string {
  if (!node) return "";
  if (t.isBinaryExpression(node) && node.operator === "+") {
    const left = processStringConcatenation(node.left as t.BinaryExpression);
    const right = processStringConcatenation(node.right as t.BinaryExpression);
    return left + right;
  } else if (t.isStringLiteral(node)) {
    return node.value;
  } else if (
    (t.isCallExpression(node) || t.isOptionalCallExpression(node)) &&
    isConcatCallExpr(node)
  ) {
    return getConcatCallExprStr(node);
  } else if (t.isTemplateLiteral(node)) {
    return getTemplateLiteralStr(node);
  }
  return "EXPR";
}

export function getTemplateLiteralStr(node: t.TemplateLiteral) {
  return node.quasis
    .map((q) => {
      return q.value.cooked ?? q.value.raw;
    })
    .join("EXPR");
}

export function getBinaryExpressionStr(node: t.BinaryExpression) {
  return processStringConcatenation(node);
}

export function isConcatCallExpr(
  node: t.CallExpression | t.OptionalCallExpression,
) {
  if (
    !t.isMemberExpression(node.callee) &&
    !t.isOptionalMemberExpression(node.callee)
  )
    return false;
  return (
    (t.isIdentifier(node.callee.property, { name: "concat" }) &&
      !node.callee.computed) ||
    t.isStringLiteral(node.callee.property, { value: "concat" })
  );
}

export function getConcatCallExprStr(
  node: t.CallExpression | t.OptionalCallExpression,
) {
  if (
    !t.isMemberExpression(node.callee) &&
    !t.isOptionalMemberExpression(node.callee)
  )
    return "";
  const base = processStringConcatenation(
    node.callee.object as t.CallExpression,
  );
  const argumentStr = node.arguments
    .map((a) => {
      return t.isStringLiteral(a) ||
        t.isTemplateLiteral(a) ||
        t.isCallExpression(a) ||
        t.isBinaryExpression(a)
        ? processStringConcatenation(a)
        : "EXPR";
    })
    .join("");
  return base + argumentStr;
}
