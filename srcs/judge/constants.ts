/**
 * @author [A likely boring stuff made by] Shevek
 * @desc constants.ts : Vocabulaire du juge (scores, motifs de rejet, langues, analyzers par classe), la requête qu'il
 *       reçoit pour un lead, et les budgets de mise en forme du dossier.
 */

import type { ImpactClass, Lead } from "../analyze/constants/lead";
import {
  AXIOS_ANALYZER_NAME,
  FETCH_ANALYZER_NAME,
  HTTP_CLIENTS_ANALYZER_NAME,
  KY_ANALYZER_NAME,
  REQUEST_ANALYZER_NAME,
} from "../analyze/ast_analyzers/cspt/http_clients";
import { URL_IN_OBJECT_EXPR_ANALYZER_NAME } from "../analyze/ast_analyzers/cspt/url_object_expression";
import { PATH_ATTRIBUTE_ASSIGNMENT_ANALYZER_NAME } from "../analyze/ast_analyzers/cspt/path_attribute_assignment";
import { SPA_NAVIGATION_ANALYZER_NAME } from "../analyze/ast_analyzers/open_redirect/spa_navigation";
import { LOCATION_ANALYZER_NAME } from "../analyze/ast_analyzers/open_redirect/location";
import { WINDOW_OPEN_ANALYZER_NAME } from "../analyze/ast_analyzers/open_redirect/window_open";
import { INNER_HTML_ANALYZER_NAME } from "../analyze/ast_analyzers/xss/inner_html";
import { DANGEROUS_HTML_ANALYZER_NAME } from "../analyze/ast_analyzers/xss/react_dangerously_set_inner_html";
import { OUTER_HTML_ANALYZER_NAME } from "../analyze/ast_analyzers/xss/outer_html";
import { DOCUMENT_WRITE_ANALYZER_NAME } from "../analyze/ast_analyzers/xss/document_write";
import { INSERT_ADJACENT_HTML_ANALYZER_NAME } from "../analyze/ast_analyzers/xss/insert_adjacent_html";
import { SRCDOC_ANALYZER_NAME } from "../analyze/ast_analyzers/xss/srcdoc";
import { CREATE_CONTEXTUAL_FRAGMENT_ANALYZER_NAME } from "../analyze/ast_analyzers/xss/create_contextual_fragment";
import { PARSE_FROM_STRING_ANALYZER_NAME } from "../analyze/ast_analyzers/xss/parse_from_string";
import { SET_HTML_UNSAFE_ANALYZER_NAME } from "../analyze/ast_analyzers/xss/set_html_unsafe";
import { JQUERY_ANALYZER_NAME } from "../analyze/ast_analyzers/xss/jquery";
import { INNER_HTML_PROPERTY_ANALYZER_NAME } from "../analyze/ast_analyzers/xss/innerhtml_property";
import { HTML_PROPERTY_CALL_ANALYZER_NAME } from "../analyze/ast_analyzers/xss/html_property_call";
import { ANGULAR_BYPASS_ANALYZER_NAME } from "../analyze/ast_analyzers/xss/angular_bypass";
import { UNSAFE_HTML_WRAPPER_ANALYZER_NAME } from "../analyze/ast_analyzers/xss/unsafe_html_wrapper";
import { CREATE_OBJECT_URL_ANALYZER_NAME } from "../analyze/ast_analyzers/xss/create_object_url";
import { EVAL_ANALYZER_NAME } from "../analyze/ast_analyzers/code_exec/eval";
import { FUNCTION_CONSTRUCTOR_ANALYZER_NAME } from "../analyze/ast_analyzers/code_exec/function_constructor";
import { STRING_TIMER_ANALYZER_NAME } from "../analyze/ast_analyzers/code_exec/string_timer";
import { DYNAMIC_IMPORT_ANALYZER_NAME } from "../analyze/ast_analyzers/code_exec/dynamic_import";
import { SCRIPT_ELEMENT_ANALYZER_NAME } from "../analyze/ast_analyzers/code_exec/script_element";
import { WORKER_ANALYZER_NAME } from "../analyze/ast_analyzers/code_exec/worker";
import { LODASH_TEMPLATE_ANALYZER_NAME } from "../analyze/ast_analyzers/code_exec/lodash_template";
import { POSTMESSAGE_ANALYZER_NAME } from "../analyze/ast_analyzers/web_message/postmessage";
import { ONMESSAGE_ANALYZER_NAME } from "../analyze/ast_analyzers/web_message/onmessage";
import { ONHASHCHANGE_ANALYZER_NAME } from "../analyze/ast_analyzers/web_message/onhashchange";
import { ADD_EVENT_LISTENER_ANALYZER_NAME } from "../analyze/ast_analyzers/web_message/add_event_listener";

/** Un lead à juger et ce qu'il faut pour relire son code. */
export interface JudgeRequest {
  /** Id du lead en base. */
  id: string;
  /** Chemin du fichier embelli. Les numéros de ligne s'y rapportent. */
  filePath: string;
  line: number;
  column: number;
  lead: Lead;
}

/** Les verdicts du juge, du plus au moins prioritaire pour un humain. */
export const JUDGE_SCORES = ["HIGH", "MEDIUM", "IN_DEPTH", "REJECT"] as const;
export type JudgeScore = (typeof JUDGE_SCORES)[number];

/** Motifs de rejet, communs à toutes les classes ; chaque classe les décrit à sa façon. */
export const REJECT_REASONS = [
  "LITERAL_SOURCE",
  "NOT_A_SINK",
  "VENDORED_LIB",
  "READ_ONLY",
  "SANITIZED",
] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

/** Langues dans lesquelles le dossier et les questions peuvent être rédigés. */
export const JUDGE_LANGUAGES = ["fr", "en"] as const;
export type JudgeLanguage = (typeof JUDGE_LANGUAGES)[number];
export const DEFAULT_JUDGE_LANGUAGE: JudgeLanguage = "fr";

/** Lignes de contexte de part et d'autre du sink. */
export const FUNCTION_WINDOW_LINES = 12;

/** Plafond de caractères de la fenêtre de contexte. Toute coupe est annoncée dans le texte. */
export const FUNCTION_WINDOW_MAX_CHARS = 4000;

/** Plafond de caractères d'une ligne de code citée. Un bundle embelli en garde de très longues. */
export const CODE_LINE_MAX_CHARS = 500;

/** Plafond d'origines rendues par dossier. */
export const FINDINGS_RENDERED_MAX = 12;

/** Clés d'options d'un client HTTP qui attestent une requête authentifiée. */
export const CREDENTIAL_KEYS = ["credentials", "withcredentials"];

/** Destination absolue : un schéma suivi de `//`, ou `//` seul (relatif au schéma). */
export const ABSOLUTE_URL_PREFIX = /^(?:[a-z][a-z0-9+.-]*:)?\/\//i;

/** Destination absolue dont l'hôte est complet : il est suivi d'un `/`, `?`, `#` ou `\`. */
export const ABSOLUTE_URL_PREFIX_WITH_HOST =
  /^(?:[a-z][a-z0-9+.-]*:)?\/\/[^/?#\\]+[/?#\\]/i;

/** Rangs des arguments de `postMessage(message, targetOrigin, transfer)`. */
export const POSTMESSAGE_DATA_INDEX = 0;
export const POSTMESSAGE_TARGET_ORIGIN_INDEX = 1;

/**
 * Analyzers qui produisent des leads de chaque classe d'impact. Un lead à deux classes (CSPT et
 * OPEN_REDIRECT) est jugé une fois par classe : son analyzer figure dans les deux listes.
 */
export const IMPACT_ANALYZERS: Record<ImpactClass, readonly string[]> = {
  CSPT: [
    HTTP_CLIENTS_ANALYZER_NAME,
    FETCH_ANALYZER_NAME,
    AXIOS_ANALYZER_NAME,
    REQUEST_ANALYZER_NAME,
    KY_ANALYZER_NAME,
    URL_IN_OBJECT_EXPR_ANALYZER_NAME,
    PATH_ATTRIBUTE_ASSIGNMENT_ANALYZER_NAME,
    SPA_NAVIGATION_ANALYZER_NAME,
  ],
  OPEN_REDIRECT: [
    LOCATION_ANALYZER_NAME,
    WINDOW_OPEN_ANALYZER_NAME,
    URL_IN_OBJECT_EXPR_ANALYZER_NAME,
    PATH_ATTRIBUTE_ASSIGNMENT_ANALYZER_NAME,
    SPA_NAVIGATION_ANALYZER_NAME,
  ],
  XSS: [
    INNER_HTML_ANALYZER_NAME,
    DANGEROUS_HTML_ANALYZER_NAME,
    OUTER_HTML_ANALYZER_NAME,
    DOCUMENT_WRITE_ANALYZER_NAME,
    INSERT_ADJACENT_HTML_ANALYZER_NAME,
    SRCDOC_ANALYZER_NAME,
    CREATE_CONTEXTUAL_FRAGMENT_ANALYZER_NAME,
    PARSE_FROM_STRING_ANALYZER_NAME,
    SET_HTML_UNSAFE_ANALYZER_NAME,
    JQUERY_ANALYZER_NAME,
    INNER_HTML_PROPERTY_ANALYZER_NAME,
    HTML_PROPERTY_CALL_ANALYZER_NAME,
    ANGULAR_BYPASS_ANALYZER_NAME,
    UNSAFE_HTML_WRAPPER_ANALYZER_NAME,
    CREATE_OBJECT_URL_ANALYZER_NAME,
  ],
  CODE_EXEC: [
    EVAL_ANALYZER_NAME,
    FUNCTION_CONSTRUCTOR_ANALYZER_NAME,
    STRING_TIMER_ANALYZER_NAME,
    DYNAMIC_IMPORT_ANALYZER_NAME,
    SCRIPT_ELEMENT_ANALYZER_NAME,
    WORKER_ANALYZER_NAME,
    LODASH_TEMPLATE_ANALYZER_NAME,
    JQUERY_ANALYZER_NAME,
  ],
  WEB_MESSAGE: [
    POSTMESSAGE_ANALYZER_NAME,
    ONMESSAGE_ANALYZER_NAME,
    ONHASHCHANGE_ANALYZER_NAME,
    ADD_EVENT_LISTENER_ANALYZER_NAME,
  ],
};
