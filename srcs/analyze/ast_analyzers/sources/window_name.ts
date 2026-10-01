import * as t from "@babel/types";

export function isWindowName(
  node: t.MemberExpression | t.OptionalMemberExpression,
): boolean {
  // window|self|top|parent|globalThis["name"] = truc
  // window|self|top|parent|globalThis.name = truc
  const isSimpleNameAssignment =
    (t.isIdentifier(node.object, { name: "window" }) ||
      t.isIdentifier(node.object, { name: "self" }) ||
      t.isIdentifier(node.object, { name: "top" }) ||
      t.isIdentifier(node.object, { name: "parent" }) ||
      t.isIdentifier(node.object, { name: "globalThis" })) &&
    ((t.isIdentifier(node.property, { name: "name" }) && !node.computed) ||
      t.isStringLiteral(node.property, { value: "name" }));

  const obj = node.object;

  // whatever.window|self|top|parent|globalThis.name = truc
  // whatever["window|self|top|parent|globalThis"].name = truc
  // whatever.window|self|top|parent|globalThis["name"] = truc
  // whatever["window|self|top|parent|globalThis"]["name"] = truc
  const isComplexNameAssignment =
    (t.isMemberExpression(obj) || t.isOptionalMemberExpression(obj)) &&
    t.isIdentifier(obj.object) && // on se laisse la possibilité d'avoir un w.top.name par exemple, au lieu de contraindre à window. Voir si ça a une conséquence en terme de bruit.
    ((t.isIdentifier(obj.property, { name: "window" }) && !obj.computed) ||
      t.isStringLiteral(obj.property, { value: "window" }) ||
      (t.isIdentifier(obj.property, { name: "self" }) && !obj.computed) ||
      t.isStringLiteral(obj.property, { value: "self" }) ||
      (t.isIdentifier(obj.property, { name: "top" }) && !obj.computed) ||
      t.isStringLiteral(obj.property, { value: "top" }) ||
      (t.isIdentifier(obj.property, { name: "parent" }) && !obj.computed) ||
      t.isStringLiteral(obj.property, { value: "parent" }) ||
      (t.isIdentifier(obj.property, { name: "globalThis" }) && !obj.computed) ||
      t.isStringLiteral(obj.property, { value: "globalThis" })) &&
    ((t.isIdentifier(node.property, { name: "name" }) && !node.computed) ||
      t.isStringLiteral(node.property, { value: "name" }));
  return isSimpleNameAssignment || isComplexNameAssignment;
}
