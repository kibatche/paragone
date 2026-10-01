import * as t from "@babel/types";

export const URL_SEARCH_PARAMS_ANALYZER_NAME = "url-search-params";

export function isURLSearchParams(node: t.NewExpression): boolean {
  const callee = node.callee;
  return (
    t.isIdentifier(callee, { name: "URLSearchParams" }) ||
    ((t.isMemberExpression(callee) || t.isOptionalMemberExpression(callee)) &&
      ((t.isIdentifier(callee.property, { name: "URLSearchParams" }) &&
        !callee.computed) ||
        t.isStringLiteral(callee.property, { value: "URLSearchParams" })))
  );
}
