import * as t from "@babel/types";

// Common location properties and methods
const LOCATION_PROPERTIES = [
  "href",
  "protocol",
  "host",
  "hostname",
  "port",
  "pathname",
  "search",
  "hash",
  "origin",
];

export function isLocationRead(
  node: t.MemberExpression | t.OptionalMemberExpression,
): boolean {
  const obj = node.object;
  const base =
    t.isIdentifier(obj, { name: "location" }) ||
    ((t.isMemberExpression(obj) || t.isOptionalMemberExpression(obj)) &&
      ((t.isIdentifier(obj.property, { name: "location" }) && !obj.computed) ||
        t.isStringLiteral(obj.property, { value: "location" })));
  const okProp =
    (t.isIdentifier(node.property) &&
      !node.computed &&
      LOCATION_PROPERTIES.includes(node.property.name)) ||
    (t.isStringLiteral(node.property) &&
      LOCATION_PROPERTIES.includes(node.property.value));

  return base && okProp;
}
