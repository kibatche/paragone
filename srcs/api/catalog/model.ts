/**
 * @author [A likely boring stuff made by] Shevek
 * @desc catalog/model.ts : Schémas du vocabulaire des données et du catalogue des analyzers.
 */

import { t } from "elysia";

const strings = t.Array(t.String());
const texts = t.Record(t.String(), t.String());

export const CatalogModel = {
  vocabulary: t.Object({
    impactClasses: strings,
    inventoryClasses: strings,
    leadKinds: strings,
    fileStatuses: strings,
    judgeScores: strings,
    rejectReasons: strings,
    humanScores: strings,
    queueMasks: strings,
    taintVerdicts: strings,
    taintEndKinds: strings,
    languages: strings,
    defaultLanguage: t.String(),
    legends: t.Record(t.String(), t.Object({ verdict: texts, endKind: texts })),
    rubrics: t.Record(
      t.String(),
      t.Record(
        t.String(),
        t.Object({ definition: t.String(), scores: texts, reasons: texts }),
      ),
    ),
  }),
  analyzers: t.Array(
    t.Object({
      name: t.String(),
      classes: strings,
      references: t.Array(t.Object({ label: t.String(), url: t.String() })),
      guidance: t.Record(t.String(), texts),
    }),
  ),
} as const;
