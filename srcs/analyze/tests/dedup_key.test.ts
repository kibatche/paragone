/**
 * @author [A likely boring stuff made by] Shevek
 * @desc dedup_key.test.ts : ce qui distingue, et ce qui ne distingue pas, deux clés de dédup.
 */
import { describe, expect, it } from "vitest";
import { dedupKey } from "../taint/taint_report";
import { LEAD_SCHEMA_VERSION, type Lead } from "../constants/lead";

function lead(overrides: Partial<Lead>, pattern = "/api/EXPR#0/x"): Lead {
  return {
    schemaVersion: LEAD_SCHEMA_VERSION,
    class: ["CSPT"],
    analyzerName: "http-clients",
    hash: "taint-shape",
    reconstructed: "/api/{}/x",
    taint: {
      verdict: "NAMED_BOUNDARY",
      sources: [],
      findings: [],
      omitted: {},
      nodeCount: 0,
      kept: 0,
      traversed: 0,
      shared: 0,
      sink: {
        carrierText: "",
        loc: { start: undefined, end: undefined },
        pattern,
        holes: [],
        holesMapped: false,
      },
    },
    ...overrides,
  };
}

describe("dedupKey", () => {
  const carrier = "bt.get(`/api/${v}/x`)";

  it("est stable pour un même lead et un même porteur", () => {
    expect(dedupKey(lead({}), carrier)).toBe(dedupKey(lead({}), carrier));
  });

  it("ne dépend pas de l'ordre des classes", () => {
    const a = lead({ class: ["CSPT", "OPEN_REDIRECT"] });
    const b = lead({ class: ["OPEN_REDIRECT", "CSPT"] });
    expect(dedupKey(a, carrier)).toBe(dedupKey(b, carrier));
  });

  it("sépare deux endpoints de même forme de taint", () => {
    const a = lead({}, "/api/EXPR#0/finance_documents");
    const b = lead({}, "/api/EXPR#0/refund_balance");
    expect(dedupKey(a, carrier)).not.toBe(dedupKey(b, carrier));
  });

  it("sépare deux classes, deux porteurs et deux formes de taint", () => {
    const base = dedupKey(lead({}), carrier);
    expect(dedupKey(lead({ class: ["XSS"] }), carrier)).not.toBe(base);
    expect(dedupKey(lead({}), "other.get(`/api/${v}/x`)")).not.toBe(base);
    expect(dedupKey(lead({ hash: "other-shape" }), carrier)).not.toBe(base);
  });
});
