/**
 * @author [A likely boring stuff made by] Shevek
 * @desc fr/index.ts : Assemble les textes français du juge.
 */

import type { Wording } from "../types";
import { CASE } from "./case";
import { CODE_EXEC } from "./code_exec";
import { CSPT } from "./cspt";
import { OPEN_REDIRECT } from "./open_redirect";
import { WEB_MESSAGE } from "./web_message";
import { XSS } from "./xss";

export const FR: Wording = {
  case: CASE,
  CSPT,
  XSS,
  CODE_EXEC,
  OPEN_REDIRECT,
  WEB_MESSAGE,
};
