/**
 * @author [A likely boring stuff made by] Shevek
 * @desc en/open_redirect.ts : Rubric et lignes de dossier de la classe OPEN_REDIRECT, en anglais.
 */

import { LOCATION_ANALYZER_NAME } from "../../../analyze/ast_analyzers/open_redirect/location";
import { WINDOW_OPEN_ANALYZER_NAME } from "../../../analyze/ast_analyzers/open_redirect/window_open";
import { URL_IN_OBJECT_EXPR_ANALYZER_NAME } from "../../../analyze/ast_analyzers/cspt/url_object_expression";
import { PATH_ATTRIBUTE_ASSIGNMENT_ANALYZER_NAME } from "../../../analyze/ast_analyzers/cspt/path_attribute_assignment";
import { SPA_NAVIGATION_ANALYZER_NAME } from "../../../analyze/ast_analyzers/open_redirect/spa_navigation";
import type { ClassWording, OpenRedirectLines } from "../types";

export const OPEN_REDIRECT: ClassWording<OpenRedirectLines> = {
  rubric: {
    definition: [
      "You are a triage judge for the OPEN_REDIRECT class (open redirection).",
      "An OPEN_REDIRECT happens when a value sets the destination of a navigation: assignment to location or location.href, location.assign or replace, window.open, or the url/href property of a config object. If the attacker controls the start of the destination, they send the victim to a site of their choice; if they control the scheme, `javascript:` or `data:` give an XSS.",
      "What matters: (1) which part of the destination the value controls, given by the [Destination] line : a value at the start controls scheme and host; a lone `/` prefix lets `//host` through; a prefix with a full host only lets the path vary; (2) return parameters read from the URL (returnTo, redirect, next) are the typical source; (3) a host check or an allowlist before navigating neutralises it.",
      "Do not merge three states: unarmed (really variable destination, no attacker source identified), unproven (the value comes from a parameter, an import or server data: the code alone does not tell whether the attacker controls it), false positive (constant destination, fixed host, validated destination). Only the false positive is rejected.",
    ].join("\n\n"),
    scoreQuestion: "What is the triage verdict for this OPEN_REDIRECT lead?",
    scores: {
      HIGH: "A controllable source sets the start of the destination (scheme or host) with no visible check.",
      MEDIUM:
        "Likely external destination, but one part is missing: source reached with a prefix that fixes almost everything, or free host with a source that is only likely.",
      IN_DEPTH:
        "The destination depends on a value whose controllability cannot be shown statically (parameter, import, server data), or the host check is doubtful. Escalate to a human; never reject for this reason alone.",
      REJECT:
        "Clear false positive only: constant destination, host fixed by a full prefix, library code, or destination validated by an allowlist.",
    },
    reasonQuestion:
      "Assuming this lead is a false positive to reject, what would be its single reason? Ignore this question if the verdict is not REJECT.",
    reasons: {
      LITERAL_SOURCE: "The destination is a constant written in the code.",
      NOT_A_SINK:
        "The value does not set the destination of a navigation, or the host is fixed by a full prefix.",
      VENDORED_LIB:
        "Third-party library or framework code (router, authentication SDK), not application code.",
      READ_ONLY: "Reading location, not writing it.",
      SANITIZED:
        "The destination is checked (host compared to an allowlist, relative URL enforced) before navigating.",
    },
  },
  lines: {
    locationAssignment:
      "[Navigation] assignment to location: the current page navigates to the value.",
    windowOpenUrl:
      "[Navigation] first argument of window.open: the opened URL.",
    windowOpenOtherArgument: (index) =>
      `[Navigation] argument #${index} of window.open: window name or features, not the URL.`,
    objectProperty: (key) =>
      `[Navigation] value of the key "${key}" of a config object.`,
    pathAttributeAssignment:
      "[Navigation] assignment of a root-anchored path to an element's src or href: a link followed on click, or a resource loaded by the page.",
    spaNavigation:
      "[Navigation] single-page application navigation (router.push/replace/navigate, history.pushState/replaceState): the route changes without reloading the page.",
    destinationStartsWithValue:
      "[Destination] starts with the value: scheme and host follow the value (`javascript:`, `data:`, `//host` possible if it is controlled).",
    destinationRootOnly:
      "[Destination] lone `/` prefix: a value starting with `/` produces `//host`, an external URL.",
    destinationFixedHost: (prefix) =>
      `[Destination] fixed prefix "${prefix}": the host is fixed, only the rest of the path varies.`,
    destinationOpenHost: (prefix) =>
      `[Destination] prefix "${prefix}" without a full host: the host still depends on the value.`,
  },
  analyzerGuidance: {
    [LOCATION_ANALYZER_NAME]:
      "Assignment to location or one of its properties: navigation is immediate, with no interaction. pathname, search and hash do not change the host; location, href, host, hostname, protocol can.",
    [WINDOW_OPEN_ANALYZER_NAME]:
      "window.open: only the first argument is the URL; the second is a window name, the third are features. An argument other than the URL is not a redirect.",
    [URL_IN_OBJECT_EXPR_ANALYZER_NAME]:
      "url, href or route value of a config object: check in the context that the object is used to navigate (router, link, post-login redirect). An HTTP request object does not redirect.",
    [PATH_ATTRIBUTE_ASSIGNMENT_ANALYZER_NAME]:
      "Root-anchored path assigned to href or src: for a redirect, only href counts, and it needs a click from the victim.",
    [SPA_NAVIGATION_ANALYZER_NAME]:
      "history.pushState and replaceState throw on a cross-origin URL, and a router (vue-router, Angular, react-router) navigates between the application's routes: this call alone does not lead off-site. There is an external redirect only if the route reached then redirects to a URL taken from the value.",
  },
};
