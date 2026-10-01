import fs from "fs";

import * as parser from "@babel/parser";
import traverse from "@babel/traverse";
import { type File } from "@babel/types";

import { type AnalyzerParams, type AnalyzerMatch } from "./constants/types";
import { secretsAnalyzerBuilder } from "./ast_analyzers/inventory/secrets/secrets";
import { regexAnalyzerBuilder } from "./ast_analyzers/inventory/secrets/regex_pattern";
import { regexMatchAnalyzerBuilder } from "./ast_analyzers/inventory/secrets/regex_match";
import { graphqlAnalyzerBuilder } from "./ast_analyzers/inventory/graphql";
import { addEventListenerAnalyzerBuilder } from "./ast_analyzers/web_message/add_event_listener";
import { cookieAnalyzerBuilder } from "./ast_analyzers/inventory/cookie";
import { documentDomainAnalyzerBuilder } from "./ast_analyzers/inventory/document_domain";
import { evalAnalyzerBuilder } from "./ast_analyzers/code_exec/eval";
import { hostnameAnalyzerBuilder } from "./ast_analyzers/inventory/hostname";
import { innerHTMLAnalyzerBuilder } from "./ast_analyzers/xss/inner_html";
import { localStorageAnalyzerBuilder } from "./ast_analyzers/inventory/local_storage";
import { locationAnalyzerBuilder } from "./ast_analyzers/open_redirect/location";
import { onhashchangeAnalyzerBuilder } from "./ast_analyzers/web_message/onhashchange";
import { onmessageAnalyzerBuilder } from "./ast_analyzers/web_message/onmessage";
import { postmessageAnalyzerBuilder } from "./ast_analyzers/web_message/postmessage";
import { sessionStorageAnalyzerBuilder } from "./ast_analyzers/inventory/session_storage";
import { windowNameAnalyzerBuilder } from "./ast_analyzers/inventory/window_name";
import { windowOpenAnalyzerBuilder } from "./ast_analyzers/open_redirect/window_open";
import { dangerousHtmlAnalyzerBuilder } from "./ast_analyzers/xss/react_dangerously_set_inner_html";
import { httpMethodsAnalyzerBuilder } from "./ast_analyzers/cspt/http_clients";
import { resetTaintTable } from "./taint/set_identifier_value";
import { urlInObjectExpressionAnalyzerBuilder } from "./ast_analyzers/cspt/url_object_expression";
import { outerHTMLAnalyzerBuilder } from "./ast_analyzers/xss/outer_html";
import { documentWriteAnalyzerBuilder } from "./ast_analyzers/xss/document_write";
import { insertAdjacentHTMLAnalyzerBuilder } from "./ast_analyzers/xss/insert_adjacent_html";
import { srcdocAnalyzerBuilder } from "./ast_analyzers/xss/srcdoc";
import { createContextualFragmentAnalyzerBuilder } from "./ast_analyzers/xss/create_contextual_fragment";
import { parseFromStringAnalyzerBuilder } from "./ast_analyzers/xss/parse_from_string";
import { setHTMLUnsafeAnalyzerBuilder } from "./ast_analyzers/xss/set_html_unsafe";
import { jqueryAnalyzerBuilder } from "./ast_analyzers/xss/jquery";
import { innerHTMLPropertyAnalyzerBuilder } from "./ast_analyzers/xss/innerhtml_property";
import { htmlPropertyCallAnalyzerBuilder } from "./ast_analyzers/xss/html_property_call";
import { angularBypassAnalyzerBuilder } from "./ast_analyzers/xss/angular_bypass";
import { unsafeHTMLWrapperAnalyzerBuilder } from "./ast_analyzers/xss/unsafe_html_wrapper";
import { createObjectURLAnalyzerBuilder } from "./ast_analyzers/xss/create_object_url";
import { functionConstructorAnalyzerBuilder } from "./ast_analyzers/code_exec/function_constructor";
import { stringTimerAnalyzerBuilder } from "./ast_analyzers/code_exec/string_timer";
import { dynamicImportAnalyzerBuilder } from "./ast_analyzers/code_exec/dynamic_import";
import { scriptElementAnalyzerBuilder } from "./ast_analyzers/code_exec/script_element";
import { workerAnalyzerBuilder } from "./ast_analyzers/code_exec/worker";
import { lodashTemplateAnalyzerBuilder } from "./ast_analyzers/code_exec/lodash_template";
import { pathAttributeAssignmentAnalyzerBuilder } from "./ast_analyzers/cspt/path_attribute_assignment";
import { spaNavigationAnalyzerBuilder } from "./ast_analyzers/open_redirect/spa_navigation";

export async function parseFile(filePath: string): Promise<AnalyzerParams> {
  const file = Bun.file(filePath);
  const fileContent = await file.text();
  const fileExtension = filePath.split(".").pop();
  let ast: parser.ParseResult<File>;

  switch (fileExtension) {
    case "ts":
      ast = parser.parse(fileContent, {
        sourceType: "unambiguous",
        errorRecovery: true,
        plugins: ["typescript"],
      });
      break;
    case "jsx":
      ast = parser.parse(fileContent, {
        sourceType: "unambiguous",
        errorRecovery: true,
        plugins: ["jsx"],
      });
      break;
    case "js":
    case "mjs":
    case "cjs":
      ast = parser.parse(fileContent, {
        sourceType: "unambiguous",
        errorRecovery: true,
        plugins: ["jsx"],
      });
      break;
    default:
      ast = parser.parse(fileContent, {
        sourceType: "unambiguous",
        errorRecovery: true,
        plugins: ["typescript", "jsx"],
      });
  }
  return { ast: ast, source: fileContent, filePath };
}

export type AnalyzerType =
  | "emails"
  | "postmessage"
  | "message-listener"
  | "regex-match"
  | "hash-change"
  | "regex"
  | "dom-xss"
  | "graphql"
  | "urls"
  | "jquery-dom-xss"
  | "open-redirection"
  | "cookie-manipulation"
  | "javascript-injection"
  | "document-domain-manipulation"
  | "websocket-url-poisoning"
  | "link-manipulation"
  | "ajax-request-header-manipulation"
  | "local-file-path-manipulation"
  | "html5-storage-manipulation"
  | "xpath-injection"
  | "dom-data-manipulation"
  | "common-sources"
  | "secrets"
  | "pii"
  | "extensions"
  | "add-event-listener"
  | "cookie"
  | "document-domain"
  | "eval"
  | "hostname"
  | "inner-html"
  | "local-storage"
  | "session-storage"
  | "location"
  | "onhashchange"
  | "onmessage"
  | "regex-pattern"
  | "url-in-object-expression"
  | "paths"
  | "window-name"
  | "window-open"
  | "dangerous-html"
  | "http-clients"
  | "outer-html"
  | "document-write"
  | "insert-adjacent-html"
  | "srcdoc"
  | "create-contextual-fragment"
  | "parse-from-string"
  | "set-html-unsafe"
  | "jquery"
  | "innerhtml-property"
  | "html-property-call"
  | "angular-bypass"
  | "unsafe-html-wrapper"
  | "create-object-url"
  | "function-constructor"
  | "string-timer"
  | "dynamic-import"
  | "script-element"
  | "worker"
  | "lodash-template"
  | "path-attribute-assignment"
  | "spa-navigation";

export async function analyzeFile(
  filePath: string,
  analyzersToRun?: AnalyzerType[],
): Promise<AnalyzerMatch[]> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Error: File not found: ${filePath}`);
  }

  const results: AnalyzerMatch[] = [];
  const args = await parseFile(filePath);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createAnalyzer = <T extends { [key: string]: any }>(
    type: AnalyzerType,
    builder: (args: AnalyzerParams, results: AnalyzerMatch[]) => T,
  ): T | null => {
    if (analyzersToRun && !analyzersToRun.includes(type)) {
      return null;
    }
    return builder(args, results);
  };

  const postMessageAnalyzer = createAnalyzer(
    "postmessage",
    postmessageAnalyzerBuilder,
  );
  const regexAnalyzer = createAnalyzer("regex", regexAnalyzerBuilder);
  const graphqlAnalyzer = createAnalyzer("graphql", graphqlAnalyzerBuilder);
  const secretsAnalyzer = createAnalyzer("secrets", secretsAnalyzerBuilder);
  const addEventListenerAnalyzer = createAnalyzer(
    "add-event-listener",
    addEventListenerAnalyzerBuilder,
  );
  const cookieAnalyzer = createAnalyzer("cookie", cookieAnalyzerBuilder);
  const documentDomainAnalyzer = createAnalyzer(
    "document-domain",
    documentDomainAnalyzerBuilder,
  );
  const evalAnalyzer = createAnalyzer("eval", evalAnalyzerBuilder);
  const hostnameAnalyzer = createAnalyzer("hostname", hostnameAnalyzerBuilder);
  const innerHtmlAnalyzer = createAnalyzer(
    "inner-html",
    innerHTMLAnalyzerBuilder,
  );
  const localStorageAnalyzer = createAnalyzer(
    "local-storage",
    localStorageAnalyzerBuilder,
  );
  const sessionStorageAnalyzer = createAnalyzer(
    "session-storage",
    sessionStorageAnalyzerBuilder,
  );
  const locationAnalyzer = createAnalyzer("location", locationAnalyzerBuilder);
  const onhashchangeAnalyzer = createAnalyzer(
    "onhashchange",
    onhashchangeAnalyzerBuilder,
  );
  const onmessageAnalyzer = createAnalyzer(
    "onmessage",
    onmessageAnalyzerBuilder,
  );
  const regexMatchAnalyzer = createAnalyzer(
    "regex-match",
    regexMatchAnalyzerBuilder,
  );
  const urlInObjectExpressionAnalyzer = createAnalyzer(
    "url-in-object-expression",
    urlInObjectExpressionAnalyzerBuilder,
  );

  const windowNameAnalyzer = createAnalyzer(
    "window-name",
    windowNameAnalyzerBuilder,
  );
  const windowOpenAnalyzer = createAnalyzer(
    "window-open",
    windowOpenAnalyzerBuilder,
  );
  const dangerousHtmlAnalyzer = createAnalyzer(
    "dangerous-html",
    dangerousHtmlAnalyzerBuilder,
  );
  const httpMethodsAnalyzer = createAnalyzer(
    "http-clients",
    httpMethodsAnalyzerBuilder,
  );
  const outerHTMLAnalyzer = createAnalyzer(
    "outer-html",
    outerHTMLAnalyzerBuilder,
  );
  const documentWriteAnalyzer = createAnalyzer(
    "document-write",
    documentWriteAnalyzerBuilder,
  );
  const insertAdjacentHTMLAnalyzer = createAnalyzer(
    "insert-adjacent-html",
    insertAdjacentHTMLAnalyzerBuilder,
  );
  const srcdocAnalyzer = createAnalyzer("srcdoc", srcdocAnalyzerBuilder);
  const createContextualFragmentAnalyzer = createAnalyzer(
    "create-contextual-fragment",
    createContextualFragmentAnalyzerBuilder,
  );
  const parseFromStringAnalyzer = createAnalyzer(
    "parse-from-string",
    parseFromStringAnalyzerBuilder,
  );
  const setHTMLUnsafeAnalyzer = createAnalyzer(
    "set-html-unsafe",
    setHTMLUnsafeAnalyzerBuilder,
  );
  const jqueryAnalyzer = createAnalyzer("jquery", jqueryAnalyzerBuilder);
  const innerHTMLPropertyAnalyzer = createAnalyzer(
    "innerhtml-property",
    innerHTMLPropertyAnalyzerBuilder,
  );
  const htmlPropertyCallAnalyzer = createAnalyzer(
    "html-property-call",
    htmlPropertyCallAnalyzerBuilder,
  );
  const angularBypassAnalyzer = createAnalyzer(
    "angular-bypass",
    angularBypassAnalyzerBuilder,
  );
  const unsafeHTMLWrapperAnalyzer = createAnalyzer(
    "unsafe-html-wrapper",
    unsafeHTMLWrapperAnalyzerBuilder,
  );
  const createObjectURLAnalyzer = createAnalyzer(
    "create-object-url",
    createObjectURLAnalyzerBuilder,
  );
  const functionConstructorAnalyzer = createAnalyzer(
    "function-constructor",
    functionConstructorAnalyzerBuilder,
  );
  const stringTimerAnalyzer = createAnalyzer(
    "string-timer",
    stringTimerAnalyzerBuilder,
  );
  const dynamicImportAnalyzer = createAnalyzer(
    "dynamic-import",
    dynamicImportAnalyzerBuilder,
  );
  const scriptElementAnalyzer = createAnalyzer(
    "script-element",
    scriptElementAnalyzerBuilder,
  );
  const workerAnalyzer = createAnalyzer("worker", workerAnalyzerBuilder);
  const lodashTemplateAnalyzer = createAnalyzer(
    "lodash-template",
    lodashTemplateAnalyzerBuilder,
  );
  const pathAttributeAssignmentAnalyzer = createAnalyzer(
    "path-attribute-assignment",
    pathAttributeAssignmentAnalyzerBuilder,
  );
  const spaNavigationAnalyzer = createAnalyzer(
    "spa-navigation",
    spaNavigationAnalyzerBuilder,
  );
  const analyzers = [
    postMessageAnalyzer, //done
    regexAnalyzer, //done
    graphqlAnalyzer, // done
    secretsAnalyzer, //done
    addEventListenerAnalyzer, //done
    cookieAnalyzer, //done
    documentDomainAnalyzer, //done
    evalAnalyzer, //done
    hostnameAnalyzer, //done
    innerHtmlAnalyzer, //done
    localStorageAnalyzer, //done
    sessionStorageAnalyzer, //done
    locationAnalyzer, //done
    onhashchangeAnalyzer, //done
    onmessageAnalyzer, // done
    regexMatchAnalyzer, // done
    urlInObjectExpressionAnalyzer, // done
    windowNameAnalyzer, //done
    windowOpenAnalyzer, //done
    dangerousHtmlAnalyzer, //done
    httpMethodsAnalyzer,
    outerHTMLAnalyzer,
    documentWriteAnalyzer,
    insertAdjacentHTMLAnalyzer,
    srcdocAnalyzer,
    createContextualFragmentAnalyzer,
    parseFromStringAnalyzer,
    setHTMLUnsafeAnalyzer,
    jqueryAnalyzer,
    innerHTMLPropertyAnalyzer,
    htmlPropertyCallAnalyzer,
    angularBypassAnalyzer,
    unsafeHTMLWrapperAnalyzer,
    createObjectURLAnalyzer,
    functionConstructorAnalyzer,
    stringTimerAnalyzer,
    dynamicImportAnalyzer,
    scriptElementAnalyzer,
    workerAnalyzer,
    lodashTemplateAnalyzer,
    pathAttributeAssignmentAnalyzer,
    spaNavigationAnalyzer,
  ].filter((visitor) => visitor != null);
  // tip de claudo : permet de merge le tableau d'analyzer, en une seule passe et une seul ligne.
  // Babel est vraiment meilleur que oxc sur les méthodes de confort.
  traverse(args.ast, traverse.visitors.merge(analyzers));
  // extra précaution pour vider la table des noeuds entre deux analyses de fichiers
  // et éviter l'accumulation lors de tests sur l'ensemble du corpus de test (23 fichiers)
  resetTaintTable();
  return results;
}
