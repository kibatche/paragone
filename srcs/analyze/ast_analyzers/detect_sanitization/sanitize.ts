/**
 * @author [A likely boring stuff made by] kbtch_
 * @desc sanitize.ts : Permet de détecter l'emploi de désinfecteur durant la teinte d'une valeur de telle façon à le remonter au juge.
 */
import * as t from "@babel/types";

//.sanitize, .escape, .escapeHtml, .escapeExpression, .sanitizeUrl, .encodeURIComponent
//escapeRegExp, ni encodeURI, ni htmlEscape, ni encodeHTML
const SANITIZE_METHODS = [
  "sanitize",
  "escape",
  "escapeHtml",
  "escapeExpression",
  "sanitizeUrl",
  "encodeURIComponent",
  "escapeRegExp",
  "encodeURI",
  "htmlEscape",
  "encodeHTML",
];

export function getSanitizeCall(
  node: t.CallExpression | t.OptionalCallExpression,
): string {
  if (
    !t.isMemberExpression(node.callee) &&
    !t.isOptionalMemberExpression(node.callee)
  )
    return "";

  const callee = node.callee;

  if (
    t.isIdentifier(callee.property) &&
    !callee.computed &&
    SANITIZE_METHODS.includes(callee.property.name)
  )
    return callee.property.name;
  else if (
    t.isStringLiteral(callee.property) &&
    SANITIZE_METHODS.includes(callee.property.value)
  )
    return callee.property.value;
  return "";
}
