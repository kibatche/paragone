import * as t from "@babel/types";

const sessionStoragePropertiesWrite = new Set<string>([
  "setItem",
  "removeItem",
  "clear",
]);
// const sessionStoragePropertiesRead = new Set<string>(["getItem", "key"])

function isSessionStoragePropertyWrite(property: t.Node, computed: boolean) {
  if (
    t.isIdentifier(property) &&
    computed === false &&
    sessionStoragePropertiesWrite.has(property.name)
  )
    return true;
  else if (
    t.isStringLiteral(property) &&
    sessionStoragePropertiesWrite.has(property.value)
  )
    return true;
  return false;
}

function isSessionStoragePropertyRead(property: t.Node, computed: boolean) {
  void computed;
  if (
    t.isIdentifier(property) &&
    !sessionStoragePropertiesWrite.has(property.name)
  )
    return true;
  else if (
    t.isStringLiteral(property) &&
    !sessionStoragePropertiesWrite.has(property.value)
  )
    return true;
  return false;
}

export function isSessionStorageWriteCall(
  node: t.CallExpression | t.OptionalCallExpression,
): boolean {
  const callee = node.callee;
  if (!t.isMemberExpression(callee) && !t.isOptionalMemberExpression(callee))
    return false;
  const obj = callee.object;
  return (
    (t.isIdentifier(obj, { name: "sessionStorage" }) &&
      isSessionStoragePropertyWrite(callee.property, callee.computed)) ||
    ((t.isMemberExpression(obj) || t.isOptionalMemberExpression(obj)) &&
      ((t.isIdentifier(obj.property, { name: "sessionStorage" }) &&
        !obj.computed) ||
        t.isStringLiteral(obj.property, { value: "sessionStorage" })) &&
      isSessionStoragePropertyWrite(callee.property, callee.computed))
  );
}

export function isSessionStorageReadCall(
  node: t.CallExpression | t.OptionalCallExpression,
): boolean {
  const callee = node.callee;
  if (!t.isMemberExpression(callee) && !t.isOptionalMemberExpression(callee))
    return false;
  const obj = callee.object;
  return (
    (t.isIdentifier(obj, { name: "sessionStorage" }) &&
      isSessionStoragePropertyRead(callee.property, callee.computed)) ||
    ((t.isMemberExpression(obj) || t.isOptionalMemberExpression(obj)) &&
      ((t.isIdentifier(obj.property, { name: "sessionStorage" }) &&
        !obj.computed) ||
        t.isStringLiteral(obj.property, { value: "sessionStorage" })) &&
      isSessionStoragePropertyRead(callee.property, callee.computed))
  );
}
