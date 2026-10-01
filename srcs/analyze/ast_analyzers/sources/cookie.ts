import * as t from "@babel/types";

export function isCookieRead(
  node: t.MemberExpression | t.OptionalMemberExpression,
): boolean {
  return (
    (t.isIdentifier(node.object) &&
      (t.isIdentifier(node.property, { name: "cookie" }) ||
        t.isStringLiteral(node.property, { value: "cookie" }))) ||
    ((t.isMemberExpression(node.object) ||
      t.isOptionalMemberExpression(node.object)) &&
      (t.isIdentifier(node.object.property) ||
        t.isStringLiteral(node.object.property)) &&
      (t.isIdentifier(node.property, { name: "cookie" }) ||
        t.isStringLiteral(node.property, { value: "cookie" })))
  );
}
