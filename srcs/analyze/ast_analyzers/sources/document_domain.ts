import * as t from "@babel/types";

export function isDocumentDomainRead(
  node: t.MemberExpression | t.OptionalMemberExpression,
): boolean {
  return (
    (t.isIdentifier(node.object, { name: "document" }) &&
      (t.isIdentifier(node.property, { name: "domain" }) ||
        t.isStringLiteral(node.property, { value: "domain" }))) ||
    ((t.isMemberExpression(node.object) ||
      t.isOptionalMemberExpression(node.object)) &&
      (t.isIdentifier(node.object.property, { name: "document" }) ||
        t.isStringLiteral(node.object.property, { value: "document" })) &&
      (t.isIdentifier(node.property, { name: "domain" }) ||
        t.isStringLiteral(node.property, { value: "domain" })))
  );
}
