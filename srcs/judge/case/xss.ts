/**
 * @author [A likely boring stuff made by] Shevek
 * @desc case/xss.ts : Ligne du dossier propre à XSS : par quel point la valeur est insérée comme HTML.
 */

import { INNER_HTML_ANALYZER_NAME } from "../../analyze/ast_analyzers/xss/inner_html";
import { DANGEROUS_HTML_ANALYZER_NAME } from "../../analyze/ast_analyzers/xss/react_dangerously_set_inner_html";
import { OUTER_HTML_ANALYZER_NAME } from "../../analyze/ast_analyzers/xss/outer_html";
import { DOCUMENT_WRITE_ANALYZER_NAME } from "../../analyze/ast_analyzers/xss/document_write";
import { INSERT_ADJACENT_HTML_ANALYZER_NAME } from "../../analyze/ast_analyzers/xss/insert_adjacent_html";
import { SRCDOC_ANALYZER_NAME } from "../../analyze/ast_analyzers/xss/srcdoc";
import { CREATE_CONTEXTUAL_FRAGMENT_ANALYZER_NAME } from "../../analyze/ast_analyzers/xss/create_contextual_fragment";
import { PARSE_FROM_STRING_ANALYZER_NAME } from "../../analyze/ast_analyzers/xss/parse_from_string";
import { SET_HTML_UNSAFE_ANALYZER_NAME } from "../../analyze/ast_analyzers/xss/set_html_unsafe";
import { JQUERY_ANALYZER_NAME } from "../../analyze/ast_analyzers/xss/jquery";
import { INNER_HTML_PROPERTY_ANALYZER_NAME } from "../../analyze/ast_analyzers/xss/innerhtml_property";
import { HTML_PROPERTY_CALL_ANALYZER_NAME } from "../../analyze/ast_analyzers/xss/html_property_call";
import { ANGULAR_BYPASS_ANALYZER_NAME } from "../../analyze/ast_analyzers/xss/angular_bypass";
import { UNSAFE_HTML_WRAPPER_ANALYZER_NAME } from "../../analyze/ast_analyzers/xss/unsafe_html_wrapper";
import { CREATE_OBJECT_URL_ANALYZER_NAME } from "../../analyze/ast_analyzers/xss/create_object_url";
import type { JudgeRequest } from "../constants";
import type { XssLines } from "../wording/types";

/** Ligne de dossier de chaque analyzer XSS. */
const XSS_LINE_BY_ANALYZER: Record<
  string,
  Exclude<keyof XssLines, "otherSink">
> = {
  [INNER_HTML_ANALYZER_NAME]: "innerHtml",
  [DANGEROUS_HTML_ANALYZER_NAME]: "reactDangerouslySetInnerHtml",
  [OUTER_HTML_ANALYZER_NAME]: "outerHtml",
  [DOCUMENT_WRITE_ANALYZER_NAME]: "documentWrite",
  [INSERT_ADJACENT_HTML_ANALYZER_NAME]: "insertAdjacentHtml",
  [SRCDOC_ANALYZER_NAME]: "srcdoc",
  [CREATE_CONTEXTUAL_FRAGMENT_ANALYZER_NAME]: "createContextualFragment",
  [PARSE_FROM_STRING_ANALYZER_NAME]: "parseFromString",
  [SET_HTML_UNSAFE_ANALYZER_NAME]: "setHtmlUnsafe",
  [JQUERY_ANALYZER_NAME]: "jquery",
  [INNER_HTML_PROPERTY_ANALYZER_NAME]: "innerHtmlProperty",
  [HTML_PROPERTY_CALL_ANALYZER_NAME]: "htmlPropertyCall",
  [ANGULAR_BYPASS_ANALYZER_NAME]: "angularBypass",
  [UNSAFE_HTML_WRAPPER_ANALYZER_NAME]: "unsafeHtmlWrapper",
  [CREATE_OBJECT_URL_ANALYZER_NAME]: "createObjectUrl",
};

/** @brief Lignes XSS du dossier. */
export function xssLines(request: JudgeRequest, lines: XssLines): string[] {
  const analyzer = request.lead.analyzerName;
  const line = XSS_LINE_BY_ANALYZER[analyzer];
  if (line) return [lines[line]];
  return [lines.otherSink(analyzer)];
}
