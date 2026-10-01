import * as t from "@babel/types";

const localStoragePropertiesWrite = new Set<string>([
  "setItem",
  "removeItem",
  "clear",
]);
// const localStoragePropertiesRead = new Set<string>(["getItem", "key"])

export function isLocalStoragePropertyWrite(
  property: t.Node,
  computed: boolean,
) {
  if (
    t.isIdentifier(property) &&
    computed === false &&
    localStoragePropertiesWrite.has(property.name)
  )
    return true;
  else if (
    t.isStringLiteral(property) &&
    localStoragePropertiesWrite.has(property.value)
  )
    return true;
  return false;
}

export function isLocalStoragePropertyRead(
  property: t.Node,
  computed: boolean,
) {
  void computed;
  if (
    t.isIdentifier(property) &&
    !localStoragePropertiesWrite.has(property.name)
  )
    return true;
  else if (
    t.isStringLiteral(property) &&
    !localStoragePropertiesWrite.has(property.value)
  )
    return true;
  return false;
}

export function isLocalStorageWriteCall(
  node: t.CallExpression | t.OptionalCallExpression,
): boolean {
  const callee = node.callee;
  if (!t.isMemberExpression(callee) && !t.isOptionalMemberExpression(callee))
    return false;
  const obj = callee.object;
  return (
    (t.isIdentifier(obj, { name: "localStorage" }) &&
      isLocalStoragePropertyWrite(callee.property, callee.computed)) ||
    ((t.isMemberExpression(obj) || t.isOptionalMemberExpression(obj)) &&
      ((t.isIdentifier(obj.property, { name: "localStorage" }) &&
        !obj.computed) ||
        t.isStringLiteral(obj.property, { value: "localStorage" })) &&
      isLocalStoragePropertyWrite(callee.property, callee.computed))
  );
}

export function isLocalStorageReadCall(
  node: t.CallExpression | t.OptionalCallExpression,
): boolean {
  const callee = node.callee;
  if (!t.isMemberExpression(callee) && !t.isOptionalMemberExpression(callee))
    return false;
  const obj = callee.object;
  return (
    (t.isIdentifier(obj, { name: "localStorage" }) &&
      isLocalStoragePropertyRead(callee.property, callee.computed)) ||
    ((t.isMemberExpression(obj) || t.isOptionalMemberExpression(obj)) &&
      ((t.isIdentifier(obj.property, { name: "localStorage" }) &&
        !obj.computed) ||
        t.isStringLiteral(obj.property, { value: "localStorage" })) &&
      isLocalStoragePropertyRead(callee.property, callee.computed))
  );
}
