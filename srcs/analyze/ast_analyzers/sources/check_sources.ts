import * as t from "@babel/types";
import { isCookieRead } from "./cookie";
import { isDocumentDomainRead } from "./document_domain";
import { isLocationRead } from "./location";
import { isReferrerRead } from "./referrer";
import { isLocalStorageReadCall } from "./local_storage";
import { isAddEventListenerCall } from "../web_message/add_event_listener";
import { isAddEventListenerWithmessage } from "../web_message/onmessage";
import { isURLSearchParams } from "./url_search_params";
import { isSessionStorageReadCall } from "./session_storage";
import { isWindowName } from "../sources/window_name";
import { isAddEventListenerWithHashchange } from "../web_message/onhashchange";
import {
  isHttpMethodCallExpression,
  isFetchCall,
  isAxiosCallExpression,
  isKyCallExpression,
  isRequestCallExpression,
} from "../cspt/http_clients";

export function knownSourceProvenanceToString(
  node:
    | t.MemberExpression
    | t.OptionalMemberExpression
    | t.CallExpression
    | t.OptionalCallExpression
    | t.NewExpression,
  args?: (t.ArgumentPlaceholder | t.SpreadElement | t.Expression)[],
) {
  if (t.isMemberExpression(node) || t.isOptionalMemberExpression(node)) {
    if (isCookieRead(node)) return "cookie Read";
    else if (isDocumentDomainRead(node)) return "document.domain Read";
    else if (isLocationRead(node)) return "location Read";
    else if (isReferrerRead(node)) return "referrer Read";
    else if (isWindowName(node)) return "window.name usage";
  } else if (t.isCallExpression(node) || t.isOptionalCallExpression(node)) {
    if (args && isAddEventListenerWithmessage(node, args))
      return "addEventListener for message Call";
    if (args && isAddEventListenerWithHashchange(node, args))
      return "addEventListener for hashchange Call";
    else if (isAddEventListenerCall(node)) return "addEventListener Call";
    else if (isLocalStorageReadCall(node)) return "localStorage.getItem Call";
    else if (isSessionStorageReadCall(node))
      return "sessionStorage.getItem Call";
    else if (isFetchCall(node)) return "fetch Call";
    else if (isAxiosCallExpression(node)) return "axios Call";
    else if (isKyCallExpression(node)) return "ky Call";
    else if (isRequestCallExpression(node)) return "request Call";
    else if (isHttpMethodCallExpression(node))
      return "x.get|post|patch|delete() Call"; // Doit être après le reste des clients http, car c'est le plus générique, qui mange tout.
  } else if (t.isNewExpression(node)) {
    if (isURLSearchParams(node)) return "URLSearchParams instanciation";
  }
  return "";
}
