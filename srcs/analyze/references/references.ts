/**
 * @author [A likely boring stuff made by] kbtch_ + Shevek
 * @desc references.ts : Références documentaires par analyzer, affichées dans le dossier d'un lead.
 *       Chaque URL a été lue lors de la vérification des consignes du juge (table
 *       `COMMONS/js-analyzer-agent/SOURCES_CONSIGNES.md`) ; un analyzer sans source lue n'en a aucune.
 */

import { ADD_EVENT_LISTENER_ANALYZER_NAME } from "../ast_analyzers/web_message/add_event_listener";
import { ANGULAR_BYPASS_ANALYZER_NAME } from "../ast_analyzers/xss/angular_bypass";
import { CREATE_CONTEXTUAL_FRAGMENT_ANALYZER_NAME } from "../ast_analyzers/xss/create_contextual_fragment";
import { CREATE_OBJECT_URL_ANALYZER_NAME } from "../ast_analyzers/xss/create_object_url";
import { DANGEROUS_HTML_ANALYZER_NAME } from "../ast_analyzers/xss/react_dangerously_set_inner_html";
import { DOCUMENT_WRITE_ANALYZER_NAME } from "../ast_analyzers/xss/document_write";
import { DYNAMIC_IMPORT_ANALYZER_NAME } from "../ast_analyzers/code_exec/dynamic_import";
import { EVAL_ANALYZER_NAME } from "../ast_analyzers/code_exec/eval";
import { FUNCTION_CONSTRUCTOR_ANALYZER_NAME } from "../ast_analyzers/code_exec/function_constructor";
import { HTML_PROPERTY_CALL_ANALYZER_NAME } from "../ast_analyzers/xss/html_property_call";
import { INNER_HTML_ANALYZER_NAME } from "../ast_analyzers/xss/inner_html";
import { INNER_HTML_PROPERTY_ANALYZER_NAME } from "../ast_analyzers/xss/innerhtml_property";
import { INSERT_ADJACENT_HTML_ANALYZER_NAME } from "../ast_analyzers/xss/insert_adjacent_html";
import { JQUERY_ANALYZER_NAME } from "../ast_analyzers/xss/jquery";
import { LOCATION_ANALYZER_NAME } from "../ast_analyzers/open_redirect/location";
import { LODASH_TEMPLATE_ANALYZER_NAME } from "../ast_analyzers/code_exec/lodash_template";
import { ONHASHCHANGE_ANALYZER_NAME } from "../ast_analyzers/web_message/onhashchange";
import { ONMESSAGE_ANALYZER_NAME } from "../ast_analyzers/web_message/onmessage";
import { OUTER_HTML_ANALYZER_NAME } from "../ast_analyzers/xss/outer_html";
import { PARSE_FROM_STRING_ANALYZER_NAME } from "../ast_analyzers/xss/parse_from_string";
import { POSTMESSAGE_ANALYZER_NAME } from "../ast_analyzers/web_message/postmessage";
import { SCRIPT_ELEMENT_ANALYZER_NAME } from "../ast_analyzers/code_exec/script_element";
import { SET_HTML_UNSAFE_ANALYZER_NAME } from "../ast_analyzers/xss/set_html_unsafe";
import { SPA_NAVIGATION_ANALYZER_NAME } from "../ast_analyzers/open_redirect/spa_navigation";
import { SRCDOC_ANALYZER_NAME } from "../ast_analyzers/xss/srcdoc";
import { STRING_TIMER_ANALYZER_NAME } from "../ast_analyzers/code_exec/string_timer";
import { UNSAFE_HTML_WRAPPER_ANALYZER_NAME } from "../ast_analyzers/xss/unsafe_html_wrapper";
import { WINDOW_OPEN_ANALYZER_NAME } from "../ast_analyzers/open_redirect/window_open";
import { WORKER_ANALYZER_NAME } from "../ast_analyzers/code_exec/worker";

/** Un document de référence : son titre et son adresse. */
export interface Reference {
  label: string;
  url: string;
}

const MDN_API = "https://developer.mozilla.org/en-US/docs/Web/API";
const MDN_JS =
  "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference";
const HTML_SPEC = "https://html.spec.whatwg.org/multipage";

const MDN_INNER_HTML: Reference = {
  label: "MDN : Element.innerHTML, « Security considerations »",
  url: `${MDN_API}/Element/innerHTML`,
};
const HTML_PARSING: Reference = {
  label: "HTML Standard § 13.2 : parsing, modes de script du parseur",
  url: `${HTML_SPEC}/parsing.html`,
};
const HTML_DYNAMIC_MARKUP: Reference = {
  label: "HTML Standard § 8.4-8.5 : insertion dynamique de balisage",
  url: `${HTML_SPEC}/dynamic-markup-insertion.html`,
};
const MDN_POST_MESSAGE: Reference = {
  label: "MDN : Window.postMessage",
  url: `${MDN_API}/Window/postMessage`,
};
const MDN_JAVASCRIPT_SCHEME: Reference = {
  label: "MDN : le schéma javascript:",
  url: "https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Schemes/javascript",
};
const JQUERY_HTML: Reference = {
  label: "jQuery : .html()",
  url: "https://api.jquery.com/html/",
};
const JQUERY_GET_SCRIPT: Reference = {
  label: "jQuery : jQuery.getScript",
  url: "https://api.jquery.com/jQuery.getScript/",
};
const JQUERY_GLOBAL_EVAL: Reference = {
  label: "jQuery : jQuery.globalEval",
  url: "https://api.jquery.com/jQuery.globalEval/",
};

/** Références par nom d'analyzer. Un analyzer absent n'a aucune source lue. */
export const ANALYZER_REFERENCES: Record<string, readonly Reference[]> = {
  [INNER_HTML_ANALYZER_NAME]: [MDN_INNER_HTML, HTML_PARSING],
  [INNER_HTML_PROPERTY_ANALYZER_NAME]: [MDN_INNER_HTML, HTML_PARSING],
  [OUTER_HTML_ANALYZER_NAME]: [MDN_INNER_HTML, HTML_PARSING],
  [INSERT_ADJACENT_HTML_ANALYZER_NAME]: [MDN_INNER_HTML, HTML_PARSING],
  [HTML_PROPERTY_CALL_ANALYZER_NAME]: [MDN_INNER_HTML],
  [CREATE_CONTEXTUAL_FRAGMENT_ANALYZER_NAME]: [
    {
      label: "MDN : Range.createContextualFragment",
      url: `${MDN_API}/Range/createContextualFragment`,
    },
    HTML_DYNAMIC_MARKUP,
  ],
  [PARSE_FROM_STRING_ANALYZER_NAME]: [HTML_DYNAMIC_MARKUP],
  [SET_HTML_UNSAFE_ANALYZER_NAME]: [HTML_DYNAMIC_MARKUP],
  [DOCUMENT_WRITE_ANALYZER_NAME]: [HTML_DYNAMIC_MARKUP, HTML_PARSING],
  [SRCDOC_ANALYZER_NAME]: [
    {
      label: "MDN : <iframe>, srcdoc et sandbox",
      url: "https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe",
    },
    {
      label: "HTML Standard : iframe, sandbox",
      url: `${HTML_SPEC}/iframe-embed-object.html`,
    },
    {
      label: "HTML Standard : navigation, about:srcdoc",
      url: `${HTML_SPEC}/browsing-the-web.html`,
    },
  ],
  [DANGEROUS_HTML_ANALYZER_NAME]: [
    {
      label: "React : composants communs, dangerouslySetInnerHTML",
      url: "https://react.dev/reference/react-dom/components/common",
    },
  ],
  [UNSAFE_HTML_WRAPPER_ANALYZER_NAME]: [
    {
      label: "lit : directives, unsafeHTML",
      url: "https://lit.dev/docs/api/directives/",
    },
    {
      label: "Handlebars : utilitaires, SafeString",
      url: "https://handlebarsjs.com/api-reference/utilities.html",
    },
    {
      label: "Vue : directives intégrées, v-html",
      url: "https://vuejs.org/api/built-in-directives.html",
    },
  ],
  [ANGULAR_BYPASS_ANALYZER_NAME]: [
    {
      label: "Angular : sécurité, bypassSecurityTrust*",
      url: "https://angular.dev/best-practices/security",
    },
    {
      label: "AngularJS : src/ng/sce.js ($sce.trustAs / parseAs)",
      url: "https://raw.githubusercontent.com/angular/angular.js/master/src/ng/sce.js",
    },
  ],
  [JQUERY_ANALYZER_NAME]: [JQUERY_HTML, JQUERY_GET_SCRIPT, JQUERY_GLOBAL_EVAL],
  [CREATE_OBJECT_URL_ANALYZER_NAME]: [
    {
      label: "MDN : URL.createObjectURL",
      url: `${MDN_API}/URL/createObjectURL_static`,
    },
    {
      label: "MDN : le schéma blob:",
      url: "https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Schemes/blob",
    },
  ],
  [EVAL_ANALYZER_NAME]: [
    { label: "MDN : eval()", url: `${MDN_JS}/Global_Objects/eval` },
  ],
  [FUNCTION_CONSTRUCTOR_ANALYZER_NAME]: [
    {
      label: "MDN : Function()",
      url: `${MDN_JS}/Global_Objects/Function/Function`,
    },
  ],
  [STRING_TIMER_ANALYZER_NAME]: [
    { label: "MDN : setTimeout", url: `${MDN_API}/Window/setTimeout` },
  ],
  [DYNAMIC_IMPORT_ANALYZER_NAME]: [
    { label: "MDN : import()", url: `${MDN_JS}/Operators/import` },
  ],
  [SCRIPT_ELEMENT_ANALYZER_NAME]: [
    {
      label: "HTML Standard : scripting, l'élément script",
      url: `${HTML_SPEC}/scripting.html`,
    },
  ],
  [WORKER_ANALYZER_NAME]: [
    { label: "MDN : Worker()", url: `${MDN_API}/Worker/Worker` },
  ],
  [LODASH_TEMPLATE_ANALYZER_NAME]: [
    {
      label: "lodash : _.template",
      url: "https://lodash.com/docs/4.17.15#template",
    },
  ],
  [LOCATION_ANALYZER_NAME]: [MDN_JAVASCRIPT_SCHEME],
  [WINDOW_OPEN_ANALYZER_NAME]: [
    { label: "MDN : Window.open", url: `${MDN_API}/Window/open` },
    MDN_JAVASCRIPT_SCHEME,
  ],
  [SPA_NAVIGATION_ANALYZER_NAME]: [
    { label: "MDN : History.pushState", url: `${MDN_API}/History/pushState` },
  ],
  [POSTMESSAGE_ANALYZER_NAME]: [MDN_POST_MESSAGE],
  [ONMESSAGE_ANALYZER_NAME]: [MDN_POST_MESSAGE],
  [ADD_EVENT_LISTENER_ANALYZER_NAME]: [MDN_POST_MESSAGE],
  [ONHASHCHANGE_ANALYZER_NAME]: [
    {
      label: "MDN : l'événement hashchange",
      url: `${MDN_API}/Window/hashchange_event`,
    },
  ],
};
