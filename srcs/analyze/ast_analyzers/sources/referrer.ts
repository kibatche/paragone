import * as t from "@babel/types";

export const REFERRER_ANALYZER_NAME = "referrer";

export function isReferrerRead(
  node: t.MemberExpression | t.OptionalMemberExpression,
): boolean {
  return (
    (t.isIdentifier(node.object) &&
      (t.isIdentifier(node.property, { name: "referrer" }) ||
        t.isStringLiteral(node.property, { value: "referrer" }))) ||
    ((t.isMemberExpression(node.object) ||
      t.isOptionalMemberExpression(node.object)) &&
      (t.isIdentifier(node.object.property) ||
        t.isStringLiteral(node.object.property)) &&
      (t.isIdentifier(node.property, { name: "referrer" }) ||
        t.isStringLiteral(node.property, { value: "referrer" })))
  );
}

export function isReferrerAssignment(
  node: t.MemberExpression | t.OptionalMemberExpression,
): boolean {
  return (
    (t.isIdentifier(node.object) &&
      ((t.isIdentifier(node.property, { name: "referrer" }) &&
        !node.computed) ||
        t.isStringLiteral(node.property, { value: "referrer" }))) ||
    ((t.isMemberExpression(node.object) ||
      t.isOptionalMemberExpression(node.object)) &&
      (t.isIdentifier(node.object.property) ||
        t.isStringLiteral(node.object.property)) &&
      (t.isIdentifier(node.property, { name: "referrer" }) ||
        t.isStringLiteral(node.property, { value: "referrer" })))
  );
}
