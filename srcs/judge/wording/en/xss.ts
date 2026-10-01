/**
 * @author [A likely boring stuff made by] Shevek
 * @desc en/xss.ts — Rubric et lignes de dossier de la classe XSS, en anglais.
 */

import { INNER_HTML_ANALYZER_NAME } from "../../../analyze/ast_analyzers/xss/inner_html";
import { DANGEROUS_HTML_ANALYZER_NAME } from "../../../analyze/ast_analyzers/xss/react_dangerously_set_inner_html";
import { OUTER_HTML_ANALYZER_NAME } from "../../../analyze/ast_analyzers/xss/outer_html";
import { DOCUMENT_WRITE_ANALYZER_NAME } from "../../../analyze/ast_analyzers/xss/document_write";
import { INSERT_ADJACENT_HTML_ANALYZER_NAME } from "../../../analyze/ast_analyzers/xss/insert_adjacent_html";
import { SRCDOC_ANALYZER_NAME } from "../../../analyze/ast_analyzers/xss/srcdoc";
import { CREATE_CONTEXTUAL_FRAGMENT_ANALYZER_NAME } from "../../../analyze/ast_analyzers/xss/create_contextual_fragment";
import { PARSE_FROM_STRING_ANALYZER_NAME } from "../../../analyze/ast_analyzers/xss/parse_from_string";
import { SET_HTML_UNSAFE_ANALYZER_NAME } from "../../../analyze/ast_analyzers/xss/set_html_unsafe";
import { JQUERY_ANALYZER_NAME } from "../../../analyze/ast_analyzers/xss/jquery";
import { INNER_HTML_PROPERTY_ANALYZER_NAME } from "../../../analyze/ast_analyzers/xss/innerhtml_property";
import { HTML_PROPERTY_CALL_ANALYZER_NAME } from "../../../analyze/ast_analyzers/xss/html_property_call";
import { ANGULAR_BYPASS_ANALYZER_NAME } from "../../../analyze/ast_analyzers/xss/angular_bypass";
import { UNSAFE_HTML_WRAPPER_ANALYZER_NAME } from "../../../analyze/ast_analyzers/xss/unsafe_html_wrapper";
import { CREATE_OBJECT_URL_ANALYZER_NAME } from "../../../analyze/ast_analyzers/xss/create_object_url";
import type { ClassWording, XssLines } from "../types";

export const XSS: ClassWording<XssLines> = {
  rubric: {
    definition: [
      "You are a triage judge for the XSS class (client-side HTML or script injection).",
      "An XSS happens when a value is inserted into the document through a point that parses HTML: innerHTML or outerHTML, insertAdjacentHTML, document.write, React dangerouslySetInnerHTML, and their framework equivalents. If the attacker controls the value and no sanitiser stands in the way, they run JavaScript in the page's origin.",
      "What matters: (1) the value reaches the sink without going through a sanitiser (DOMPurify, sanitize, HTML encoding); (2) where it comes from: URL (location.hash, location.search), cross-window message, storage, server response injected back; (3) a fully literal string or a fixed application template is not an XSS.",
      "Do not merge three states: unarmed (value really inserted as HTML, no attacker source identified), unproven (the value comes from a parameter, an import or a server response: the code alone does not tell whether the attacker controls it), false positive (constant, fixed content, library, sanitised value). Only the false positive is rejected.",
    ].join("\n\n"),
    scoreQuestion: "What is the triage verdict for this XSS lead?",
    scores: {
      HIGH: "A controllable source (URL, message, storage) reaches the HTML sink with no visible sanitisation.",
      MEDIUM:
        "HTML insertion of likely external data (API response, stored user data) with no visible sanitisation, but the source is not shown to be reached.",
      IN_DEPTH:
        "Real HTML insertion whose origin cannot be shown statically (parameter, import, server data), or doubtful sanitisation. Escalate to a human; never reject for this reason alone.",
      REJECT:
        "Clear false positive only: constant value or fixed application template, library or framework code, a read rather than a write, or value sanitised before insertion.",
    },
    reasonQuestion:
      "Assuming this lead is a false positive to reject, what would be its single reason? Ignore this question if the verdict is not REJECT.",
    reasons: {
      LITERAL_SOURCE:
        "The inserted value is a constant or a fixed template written in the code.",
      NOT_A_SINK:
        "The point does not parse HTML (textContent, harmless attribute) or the receiver is not a DOM element.",
      VENDORED_LIB:
        "Third-party library or framework code (React, Angular, jQuery, internal rendering), not application code.",
      READ_ONLY: "Reading innerHTML or outerHTML, not writing it.",
      SANITIZED:
        "The value goes through a sanitiser (DOMPurify, sanitize, HTML encoding) before insertion.",
    },
  },
  lines: {
    innerHtml:
      "[Insertion] the value is assigned to innerHTML or outerHTML: it is parsed as HTML.",
    reactDangerouslySetInnerHtml:
      "[Insertion] the value goes through dangerouslySetInnerHTML (React): it is parsed as HTML, without escaping.",
    outerHtml:
      "[Insertion] the value is assigned to outerHTML: the element is replaced by the value parsed as HTML.",
    documentWrite:
      "[Insertion] the value is written by document.write or writeln: it is parsed as HTML, and a <script> written this way runs.",
    insertAdjacentHtml:
      "[Insertion] the value is the HTML of insertAdjacentHTML: it is parsed as HTML next to the element.",
    srcdoc:
      "[Insertion] the value is the srcdoc of an iframe: it becomes the iframe's HTML document.",
    createContextualFragment:
      "[Insertion] the value goes through createContextualFragment: it is parsed as HTML, and its <script> elements run when the fragment is inserted.",
    parseFromString:
      "[Insertion] the value is parsed by DOMParser.parseFromString as text/html: it is parsed as an HTML document separate from the page.",
    setHtmlUnsafe:
      "[Insertion] the value goes through setHTMLUnsafe or parseHTMLUnsafe: it is parsed as HTML without sanitization.",
    jquery:
      "[Insertion] the value goes through a jQuery method that parses HTML (html, append, prepend, after, before, replaceWith, wrap, parseHTML) or becomes an href/src attribute (a `javascript:` URL runs there).",
    innerHtmlProperty:
      "[Insertion] the value is the innerHTML or outerHTML property of a render object (v-html compiled by Vue, domProps): the framework assigns it to the element as HTML.",
    htmlPropertyCall:
      "[Insertion] the value follows the property name innerHTML, outerHTML or srcdoc in a call (Angular-compiled [innerHTML] binding, Renderer2.setProperty, Reflect.set): it is assigned as HTML.",
    angularBypass:
      "[Insertion] the value goes through bypassSecurityTrust* (Angular) or $sce.trustAs* (AngularJS), which mark it safe, or $sce.parseAs* (AngularJS), which evaluates it as an expression.",
    unsafeHtmlWrapper:
      "[Insertion] the value is wrapped as trusted HTML (lit unsafeHTML, Ember htmlSafe, Handlebars SafeString): the template engine inserts it without escaping.",
    createObjectUrl:
      "[Insertion] the value becomes a blob: URL through URL.createObjectURL: the URL points to the Blob content.",
    otherSink: (analyzer) => `[Insertion] sink "${analyzer}"`,
  },
  analyzerGuidance: {
    [INNER_HTML_ANALYZER_NAME]:
      "A <script> inserted through innerHTML does not run, but an event handler (<img src=x onerror=…>) does: the absence of <script> in the value is no protection.",
    [DANGEROUS_HTML_ANALYZER_NAME]:
      "React hands __html to the browser as is, like the underlying innerHTML property: same execution rules as innerHTML. Only the origin of __html and the presence of a sanitizer before it matter.",
    [OUTER_HTML_ANALYZER_NAME]:
      "Same execution rules as innerHTML: no <script>, but event handlers run.",
    [DOCUMENT_WRITE_ANALYZER_NAME]:
      "<script> elements written by document.write run, including a <script src> pointing at a chosen host; the specification lets the browser skip a script inserted this way, for instance a cross-origin one on a slow network. Called after load, document.write reopens the document and replaces all of its content.",
    [INSERT_ADJACENT_HTML_ANALYZER_NAME]:
      "Only the second argument is HTML; the first is a fixed position. Same execution rules as innerHTML.",
    [SRCDOC_ANALYZER_NAME]:
      "The value becomes the iframe's document, which takes the origin of the document that set srcdoc. Without a sandbox attribute, its scripts run in the page's origin. With sandbox: without allow-scripts, no script runs; without allow-same-origin, they run in an opaque origin, without access to the page; with both allow-scripts AND allow-same-origin, the document can remove the sandbox attribute itself, which then protects nothing.",
    [CREATE_CONTEXTUAL_FRAGMENT_ANALYZER_NAME]:
      "Unlike innerHTML, the fragment's <script> elements run when the fragment is inserted into the document. Check in the context that the fragment is inserted.",
    [PARSE_FROM_STRING_ANALYZER_NAME]:
      "The document produced by parseFromString is inert: no script or handler runs until one of its nodes is inserted back into the page. Look for that insertion in the context (appendChild, replaceWith, importNode, innerHTML of a node from the document); without it, this is not a sink. Sanitizing this document then serializing it again is the typical ground for mXSS mutations.",
    [SET_HTML_UNSAFE_ANALYZER_NAME]:
      'setHTMLUnsafe only sanitizes when the call passes a sanitizer option; its <script> elements only run when the runScripts option is true, but as with innerHTML, an event handler (<img onerror>) runs. parseHTMLUnsafe returns an inert document with no browsing context: nothing runs until one of its nodes is inserted back into the page. Both accept declarative shadow DOM. setHTML, without "Unsafe", always sanitizes: it is not targeted.',
    [JQUERY_ANALYZER_NAME]:
      'Unlike innerHTML, a jQuery method that receives an HTML string can run the <script> elements it contains, on top of event handlers. For attr("href"|"src"), the value is a URL: the danger is a `javascript:` URL. A value that is a DOM node or a jQuery object, not a string, injects nothing.',
    [INNER_HTML_PROPERTY_ANALYZER_NAME]:
      "innerHTML property of a compiled render object (Vue v-html, domProps): the framework assigns it to innerHTML without escaping. Read it like an innerHTML assignment.",
    [HTML_PROPERTY_CALL_ANALYZER_NAME]:
      "In Angular, a value bound to [innerHTML] is sanitized automatically: a sanitizer passed after the value (for instance ɵɵsanitizeHtml, often renamed in bundles) means SANITIZED, unless the value comes out of bypassSecurityTrustHtml. Outside a template binding (Renderer2.setProperty, Reflect.set), nothing guarantees sanitization: look for it in the context.",
    [ANGULAR_BYPASS_ANALYZER_NAME]:
      "bypassSecurityTrust* (Angular) and $sce.trustAs* (AngularJS) explicitly exempt the value from the framework's sanitization: whatever goes into it is inserted as is. $sce.parseAs* is different: it marks nothing as safe, it evaluates an AngularJS EXPRESSION then requires its result to be already trusted; the risk is then a controlled expression (client-side template injection). A constant or a fixed application template is a false positive.",
    [UNSAFE_HTML_WRAPPER_ANALYZER_NAME]:
      "The value is declared trusted HTML for the template engine, which escapes everything else. The wrapper is only dangerous if what it wraps comes from outside.",
    [CREATE_OBJECT_URL_ANALYZER_NAME]:
      "The blob: URL's origin is that of the document that created it. There is an XSS only if the Blob is an HTML document (text/html type) AND the URL is opened (window.open, location, link) or loaded in an iframe. A Blob served as a download (a.download), a displayed image, or a file the user picked themselves: not a sink.",
  },
};
