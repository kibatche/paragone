/**
 * @author [A likely boring stuff made by] Shevek
 * @desc en/code_exec.ts — Rubric et lignes de dossier de la classe CODE_EXEC, en anglais.
 */

import { EVAL_ANALYZER_NAME } from "../../../analyze/ast_analyzers/code_exec/eval";
import { FUNCTION_CONSTRUCTOR_ANALYZER_NAME } from "../../../analyze/ast_analyzers/code_exec/function_constructor";
import { STRING_TIMER_ANALYZER_NAME } from "../../../analyze/ast_analyzers/code_exec/string_timer";
import { DYNAMIC_IMPORT_ANALYZER_NAME } from "../../../analyze/ast_analyzers/code_exec/dynamic_import";
import { SCRIPT_ELEMENT_ANALYZER_NAME } from "../../../analyze/ast_analyzers/code_exec/script_element";
import { WORKER_ANALYZER_NAME } from "../../../analyze/ast_analyzers/code_exec/worker";
import { LODASH_TEMPLATE_ANALYZER_NAME } from "../../../analyze/ast_analyzers/code_exec/lodash_template";
import { JQUERY_ANALYZER_NAME } from "../../../analyze/ast_analyzers/xss/jquery";
import type { ClassWording, CodeExecLines } from "../types";

export const CODE_EXEC: ClassWording<CodeExecLines> = {
  rubric: {
    definition: [
      "You are a triage judge for the CODE_EXEC class (arbitrary JavaScript execution).",
      "A CODE_EXEC happens when a value is evaluated as code: eval, new Function, setTimeout or setInterval with a string, dynamic import(). If the attacker controls the value, they run JavaScript in the page's origin.",
      "What matters: (1) the evaluated string is built from external data; (2) an eval on a constant, on bundler-generated code (polyfill, environment detection, `eval('this')`) or on trusted JSON is not exploitable.",
      "Do not merge three states: unarmed (real evaluation of a variable string, no attacker source identified), unproven (the string comes from a parameter, an import or server data: the code alone does not tell whether the attacker controls it), false positive (constant, bundler or library code). Only the false positive is rejected.",
    ].join("\n\n"),
    scoreQuestion: "What is the triage verdict for this CODE_EXEC lead?",
    scores: {
      HIGH: "A controllable source reaches the string evaluated as code.",
      MEDIUM:
        "Likely external data (API response, remote configuration, storage) is evaluated, with no proof that the attacker controls it.",
      IN_DEPTH:
        "The evaluated string comes from a parameter, an import or server data: controllability cannot be shown statically. Escalate to a human; never reject for this reason alone.",
      REJECT:
        "Clear false positive only: constant string, bundler or library code (environment detection, polyfill), or value validated before evaluation.",
    },
    reasonQuestion:
      "Assuming this lead is a false positive to reject, what would be its single reason? Ignore this question if the verdict is not REJECT.",
    reasons: {
      LITERAL_SOURCE: "The evaluated string is a constant written in the code.",
      NOT_A_SINK:
        "The call does not evaluate code: a function with the same name, or a function passed by reference instead of a string.",
      VENDORED_LIB:
        "Bundler or third-party library code (polyfill, environment detection).",
      READ_ONLY: "The value is only read or compared, never evaluated.",
      SANITIZED:
        "The value is validated (allowlist, strict JSON.parse) before evaluation.",
    },
  },
  lines: {
    evalCall:
      "[Execution] the value is passed to eval: it runs as JavaScript code.",
    functionConstructor:
      "[Execution] the value is an argument of Function or new Function: the last argument is compiled as the function body, the others as parameter names.",
    stringTimer:
      "[Execution] the value is the first argument of setTimeout or setInterval: a string there is evaluated as code; a function reference is not.",
    dynamicImport:
      "[Execution] the value is the source of a dynamic import(): the module loaded from that URL runs in the page's origin.",
    scriptElement:
      '[Execution] the value is assigned to src, text or textContent of an element created by createElement("script"): script loaded from that URL, or code run as is.',
    worker:
      "[Execution] the value is the URL of a new Worker or new SharedWorker: the loaded script runs in a worker of the page's origin.",
    lodashTemplate:
      "[Execution] the value is the source of a _.template: lodash compiles it into a function, and its <% %> blocks are JavaScript.",
    jquery:
      "[Execution] the value goes through $.globalEval (code run) or $.getScript (script loaded from that URL, then run).",
    otherSink: (analyzer) => `[Execution] sink "${analyzer}"`,
  },
  analyzerGuidance: {
    [EVAL_ANALYZER_NAME]:
      "Direct eval runs in the local scope, indirect eval ((0, eval)(x), window.eval) in the global scope: both run the string.",
    [FUNCTION_CONSTRUCTOR_ANALYZER_NAME]:
      'The last argument is the function body, the others are parameter names. Bundlers and polyfills generate Function("return this")(); message formatters (ICU, i18n) compile their templates this way: library code. The produced function runs nothing until it is called.',
    [STRING_TIMER_ANALYZER_NAME]:
      "Only a string as first argument is evaluated; a function is not.",
    [DYNAMIC_IMPORT_ANALYZER_NAME]:
      "The module is loaded from the URL, then run. A relative path or a fixed host prefix limits the attacker to modules the application already serves; a free prefix lets them load a module from their own host, which must then answer with CORS headers.",
    [SCRIPT_ELEMENT_ANALYZER_NAME]:
      "src: the script is loaded from that URL, and a controlled host is enough. text or textContent: the code runs as is. In both cases nothing runs before the element is inserted into the document.",
    [WORKER_ANALYZER_NAME]:
      "The Worker constructor only accepts a same-origin URL, a blob: URL (which inherits the origin of the document that created it) or a data: URL (which runs in an opaque origin, without access to the page's origin). A URL on another host throws a SecurityError.",
    [LODASH_TEMPLATE_ANALYZER_NAME]:
      "_.template compiles the string into a function (through Function): <% %> runs JavaScript, <%= %> interpolates an expression, <%- %> interpolates it escaped. The danger is a controlled template SOURCE, not the data later passed to the compiled template.",
    [JQUERY_ANALYZER_NAME]:
      "$.globalEval runs the string in the global scope; $.getScript loads a script from the URL then runs it, and a controlled host is enough.",
  },
};
