/**
 * @author [A likely boring stuff made by] Shevek
 * @desc en/cspt.ts — Rubric et lignes de dossier de la classe CSPT, en anglais.
 */

import {
  HTTP_CLIENTS_ANALYZER_NAME,
  FETCH_ANALYZER_NAME,
  AXIOS_ANALYZER_NAME,
  REQUEST_ANALYZER_NAME,
  KY_ANALYZER_NAME,
} from "../../../analyze/ast_analyzers/cspt/http_clients";
import { URL_IN_OBJECT_EXPR_ANALYZER_NAME } from "../../../analyze/ast_analyzers/cspt/url_object_expression";
import { PATH_ATTRIBUTE_ASSIGNMENT_ANALYZER_NAME } from "../../../analyze/ast_analyzers/cspt/path_attribute_assignment";
import { SPA_NAVIGATION_ANALYZER_NAME } from "../../../analyze/ast_analyzers/open_redirect/spa_navigation";
import type { ClassWording, CsptLines } from "../types";

export const CSPT: ClassWording<CsptLines> = {
  rubric: {
    definition: [
      "You are a triage judge for the CSPT class (Client-Side Path Traversal).",
      "A CSPT happens when client-side JavaScript inserts a value into the PATH of a request the browser sends to its own origin (fetch, XMLHttpRequest, axios, an aliased client, a config object with url/path). If the value can carry `../` or its encodings, the attacker reroutes the request to another endpoint of the same origin, with the victim's cookies and headers.",
      "What matters: (1) the value lands in a path segment, not in the query; (2) the rerouted endpoint has an effect — a state-changing action (POST, PUT, PATCH, DELETE: CSPT to CSRF) or a response injected back into the page (CSPT to XSS); (3) the request carries the victim's session. A forced suffix (`.json`) is neutralised with `?` or `#`.",
      "Staying on the same origin is the definition of the class, never a reason to reject.",
      "Do not merge three states: unarmed (real primitive, no useful endpoint identified), unproven (the value comes from a parameter, an import or server data: the code alone does not tell whether the attacker controls it), false positive (not a path, or a constant value). Only the false positive is rejected.",
    ].join("\n\n"),
    scoreQuestion: "What is the triage verdict for this CSPT lead?",
    scores: {
      HIGH: "Armed primitive: a controllable source reaches a path segment, and the rerouted endpoint has an effect — a state-changing request, or a response injected back into the page.",
      MEDIUM:
        "Plausible rerouting and likely effect, but one of the two is not established: source reached with an uncertain effect (plain read), or a clear effect with a source that is only likely.",
      IN_DEPTH:
        "Unarmed or unproven: the hole is in the path, but controllability cannot be shown statically (function parameter, import, server data) or no effect is visible. Escalate to a human; never reject for this reason alone.",
      REJECT:
        "Clear false positive only: no hole in the path (value in the query, fully literal URL), constant value, third-party library code, or value normalised before use.",
    },
    reasonQuestion:
      "Assuming this lead is a false positive to reject, what would be its single reason? Ignore this question if the verdict is not REJECT.",
    reasons: {
      LITERAL_SOURCE:
        "The value inserted into the path is a constant written in the code: no controllable source.",
      NOT_A_SINK:
        "Not a reroutable request path: hole in the query, fully literal URL, or no request sent.",
      VENDORED_LIB:
        "Third-party library or framework code (rrweb, Sentry, React internals…), not application code.",
      READ_ONLY: "Reading a URL value, not writing into a request path.",
      SANITIZED:
        "The value goes through encoding (encodeURIComponent), normalisation or an allowlist before reaching the path.",
    },
  },
  lines: {
    method: (method) => `[Method] ${method}`,
    methodUnknown: "[Method] cannot be determined statically",
    authenticated: (evidence) => `[Authenticated request] yes — ${evidence}`,
    notAuthenticated: "[Authenticated request] not attested by the code",
    holeInPath: (hole) => `  ${hole} → path segment`,
    holeInQuery: (hole) => `  ${hole} → query parameter`,
    forcedSuffix: (suffix) => `[Forced suffix] ${suffix}`,
  },
  analyzerGuidance: {
    [HTTP_CLIENTS_ANALYZER_NAME]:
      "Direct call to an HTTP client: the pattern is the request URL. Check (1) whether a hole sits in the PATH, where a controlled value can inject `../` and reach another endpoint, or only in the query; (2) whether the request carries the victim's session (same origin, credentials, withCredentials); (3) whether the method changes state (POST, PUT, PATCH, DELETE), which makes the rerouting worse.",
    [FETCH_ANALYZER_NAME]:
      "Direct call to an HTTP client: the pattern is the request URL. Check (1) whether a hole sits in the PATH, where a controlled value can inject `../` and reach another endpoint, or only in the query; (2) whether the request carries the victim's session (same origin, credentials, withCredentials); (3) whether the method changes state (POST, PUT, PATCH, DELETE), which makes the rerouting worse.",
    [AXIOS_ANALYZER_NAME]:
      "Direct call to an HTTP client: the pattern is the request URL. Check (1) whether a hole sits in the PATH, where a controlled value can inject `../` and reach another endpoint, or only in the query; (2) whether the request carries the victim's session (same origin, credentials, withCredentials); (3) whether the method changes state (POST, PUT, PATCH, DELETE), which makes the rerouting worse.",
    [REQUEST_ANALYZER_NAME]:
      "Direct call to an HTTP client: the pattern is the request URL. Check (1) whether a hole sits in the PATH, where a controlled value can inject `../` and reach another endpoint, or only in the query; (2) whether the request carries the victim's session (same origin, credentials, withCredentials); (3) whether the method changes state (POST, PUT, PATCH, DELETE), which makes the rerouting worse.",
    [KY_ANALYZER_NAME]:
      "Direct call to an HTTP client: the pattern is the request URL. Check (1) whether a hole sits in the PATH, where a controlled value can inject `../` and reach another endpoint, or only in the query; (2) whether the request carries the victim's session (same origin, credentials, withCredentials); (3) whether the method changes state (POST, PUT, PATCH, DELETE), which makes the rerouting worse.",
    [URL_IN_OBJECT_EXPR_ANALYZER_NAME]:
      "Value of the url, path, endpoint, uri or route key of a config object. The object is not necessarily a request: check in the context what it is passed to (HTTP client, router, component). If it reaches no request, it is not a CSPT sink.",
    [PATH_ATTRIBUTE_ASSIGNMENT_ANALYZER_NAME]:
      "Root-anchored path (`/…`) assigned to an element's src or href. src: the page loads the resource itself (image, script, iframe), same origin and with cookies, on a path that `../` can reroute. href: no request is sent without a click.",
    [SPA_NAVIGATION_ANALYZER_NAME]:
      "Single-page application navigation: the value picks the route, and the route picks the views and API calls that follow. A controlled path can reach an unexpected route, or a view that builds its requests from route parameters.",
  },
};
