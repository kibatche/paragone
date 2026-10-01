/**
 * @author [A likely boring stuff made by] Shevek
 * @desc en/index.ts — Assemble les textes anglais du juge.
 */

import type { Wording } from "../types";
import { CASE } from "./case";
import { CODE_EXEC } from "./code_exec";
import { CSPT } from "./cspt";
import { OPEN_REDIRECT } from "./open_redirect";
import { WEB_MESSAGE } from "./web_message";
import { XSS } from "./xss";

export const EN: Wording = {
  case: CASE,
  CSPT,
  XSS,
  CODE_EXEC,
  OPEN_REDIRECT,
  WEB_MESSAGE,
};
