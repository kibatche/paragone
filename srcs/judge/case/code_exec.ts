/**
 * @author [A likely boring stuff made by] Shevek
 * @desc case/code_exec.ts — Ligne du dossier propre à CODE_EXEC : par quel point la valeur est exécutée.
 */

import { EVAL_ANALYZER_NAME } from "../../analyze/ast_analyzers/code_exec/eval";
import { FUNCTION_CONSTRUCTOR_ANALYZER_NAME } from "../../analyze/ast_analyzers/code_exec/function_constructor";
import { STRING_TIMER_ANALYZER_NAME } from "../../analyze/ast_analyzers/code_exec/string_timer";
import { DYNAMIC_IMPORT_ANALYZER_NAME } from "../../analyze/ast_analyzers/code_exec/dynamic_import";
import { SCRIPT_ELEMENT_ANALYZER_NAME } from "../../analyze/ast_analyzers/code_exec/script_element";
import { WORKER_ANALYZER_NAME } from "../../analyze/ast_analyzers/code_exec/worker";
import { LODASH_TEMPLATE_ANALYZER_NAME } from "../../analyze/ast_analyzers/code_exec/lodash_template";
import { JQUERY_ANALYZER_NAME } from "../../analyze/ast_analyzers/xss/jquery";
import type { JudgeRequest } from "../constants";
import type { CodeExecLines } from "../wording/types";

/** Ligne de dossier de chaque analyzer CODE_EXEC. */
const CODE_EXEC_LINE_BY_ANALYZER: Record<
  string,
  Exclude<keyof CodeExecLines, "otherSink">
> = {
  [EVAL_ANALYZER_NAME]: "evalCall",
  [FUNCTION_CONSTRUCTOR_ANALYZER_NAME]: "functionConstructor",
  [STRING_TIMER_ANALYZER_NAME]: "stringTimer",
  [DYNAMIC_IMPORT_ANALYZER_NAME]: "dynamicImport",
  [SCRIPT_ELEMENT_ANALYZER_NAME]: "scriptElement",
  [WORKER_ANALYZER_NAME]: "worker",
  [LODASH_TEMPLATE_ANALYZER_NAME]: "lodashTemplate",
  [JQUERY_ANALYZER_NAME]: "jquery",
};

/** @brief Lignes CODE_EXEC du dossier. */
export function codeExecLines(
  request: JudgeRequest,
  lines: CodeExecLines,
): string[] {
  const analyzer = request.lead.analyzerName;
  const line = CODE_EXEC_LINE_BY_ANALYZER[analyzer];
  if (line) return [lines[line]];
  return [lines.otherSink(analyzer)];
}
