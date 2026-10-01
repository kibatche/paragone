/**
 * @author [A likely boring stuff made by] Shevek
 * @desc meta/index.ts — Route `/api/meta` : où vit le projet servi.
 */

import { Elysia } from "elysia";
import { getProjectInfo } from "../../db/db";
import { API_PREFIX, API_VERSION } from "../constants";
import { MetaModel } from "./model";

export const meta = new Elysia({ prefix: API_PREFIX, name: "api.meta" }).get(
  "/meta",
  () => ({ ...getProjectInfo(), apiVersion: API_VERSION }),
  {
    response: MetaModel.meta,
    detail: {
      tags: ["meta"],
      summary: "Le projet servi et la version du contrat.",
    },
  },
);
