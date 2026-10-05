/**
 * @author [A likely boring stuff made by] Shevek
 * @desc script_element.ts : Élément `<script>` construit à la main : `s = document.createElement("script")`
 *       puis `s.src = url` (script chargé) ou `s.text = code` / `s.textContent = code` (script en ligne).
 *       Seules les affectations dont le receveur vient de `createElement("script")` comptent : un `.text =`
 *       nu vise surtout `<a>` ou `<option>`.
 */
import { type AnalyzerMatch, type AnalyzerParams } from "../../constants/types";
import { NodePath, type Visitor } from "@babel/traverse";
import * as t from "@babel/types";
import { processStringConcatenation } from "../cspt/cspt_utils";
import {
  getTaintTable,
  taintIdentifier,
} from "../../taint/set_identifier_value";
import {
  buildSinkContext,
  taintReport,
  normalizeNode,
} from "../../taint/taint_report";
import { LEAD_SCHEMA_VERSION, type Lead } from "../../constants/lead";
import { SHA256 } from "bun";
import { randomBytes } from "crypto";

export const SCRIPT_ELEMENT_ANALYZER_NAME = "script-element";

const SCRIPT_CODE_PROPERTIES = ["src", "text", "textContent", "innerText"];

//document.createElement("script") | whatever.createElement("SCRIPT")
export function isCreateScriptElementCall(
  node: t.Node | null | undefined,
): boolean {
  if (!t.isCallExpression(node) && !t.isOptionalCallExpression(node))
    return false;
  if (
    !t.isMemberExpression(node.callee) &&
    !t.isOptionalMemberExpression(node.callee)
  )
    return false;
  const isCreateElement =
    (t.isIdentifier(node.callee.property, { name: "createElement" }) &&
      !node.callee.computed) ||
    t.isStringLiteral(node.callee.property, { value: "createElement" });
  const tag = node.arguments[0];
  return (
    isCreateElement &&
    t.isStringLiteral(tag) &&
    tag.value.toLowerCase() === "script"
  );
}

/**
 * @brief Vrai si l'identifiant est lié à un `createElement("script")` : à sa déclaration
 *        (`var s = …`) ou par une affectation ultérieure (`s = …`), fréquente en code minifié.
 */
function isScriptElementIdentifier(
  path: NodePath<t.Node>,
  name: string,
): boolean {
  const binding = path.scope.getBinding(name);
  if (!binding) return false;
  if (
    binding.path.isVariableDeclarator() &&
    isCreateScriptElementCall(binding.path.node.init)
  )
    return true;
  return binding.constantViolations.some(
    (violation) =>
      violation.isAssignmentExpression() &&
      isCreateScriptElementCall(violation.node.right),
  );
}

export function isScriptElementAssignment(
  path: NodePath<t.AssignmentExpression>,
): boolean {
  const left = path.node.left;
  if (!t.isMemberExpression(left) && !t.isOptionalMemberExpression(left))
    return false;
  const isCodeProperty =
    (t.isIdentifier(left.property) &&
      !left.computed &&
      SCRIPT_CODE_PROPERTIES.includes(left.property.name)) ||
    (t.isStringLiteral(left.property) &&
      SCRIPT_CODE_PROPERTIES.includes(left.property.value));
  if (!isCodeProperty) return false;

  //(s = document.createElement("script")).src = x
  const obj = left.object;
  if (t.isAssignmentExpression(obj))
    return isCreateScriptElementCall(obj.right);
  return t.isIdentifier(obj) && isScriptElementIdentifier(path, obj.name);
}

const scriptElementAnalyzerBuilder = (
  args: AnalyzerParams,
  matchesReturn: AnalyzerMatch[],
): Visitor => {
  const handleAssignment = (path: NodePath<t.AssignmentExpression>) => {
    const node = path.node;
    if (!node.loc || node.start == null || node.end == null) return;
    if (!isScriptElementAssignment(path)) return;

    const reconstructed = processStringConcatenation(path.get("right").node);
    const rootId = taintIdentifier(path.get("right"));
    const taint = taintReport(
      rootId,
      getTaintTable(),
      args.source,
      buildSinkContext(path.get("right"), path),
    );
    if (!taint) return;
    const normalizedNode = normalizeNode(
      rootId,
      getTaintTable(),
      buildSinkContext(path.get("right"), path),
    );
    const hash = SHA256.hash(
      normalizedNode ?? randomBytes(256).toString(),
      "hex",
    ).toString();
    const leads: Lead[] = [];
    leads.push({
      schemaVersion: LEAD_SCHEMA_VERSION,
      class: ["CODE_EXEC"],
      hash: hash,
      analyzerName: SCRIPT_ELEMENT_ANALYZER_NAME,
      slot: { kind: "assignment-expression-right" },
      reconstructed: reconstructed,
      taint: taint,
    });
    const match: AnalyzerMatch = {
      filePath: args.filePath,
      analyzerName: SCRIPT_ELEMENT_ANALYZER_NAME,
      value: args.source.slice(node.start, node.end),
      start: node.loc.start,
      end: node.loc.end,
      leads: leads,
    };

    matchesReturn.push(match);
  };
  return { AssignmentExpression: handleAssignment };
};

export { scriptElementAnalyzerBuilder };
