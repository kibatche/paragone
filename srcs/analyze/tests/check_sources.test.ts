/**
 * @author [A likely boring stuff made by] Shevek
 * @desc check_sources.test.ts — une écriture ou un sink en position de valeur n'est pas une source :
 *       `setItem(…)`/`postMessage(…)` valent `undefined`, `window.open(…)` une `Window`. Témoin : une
 *       vraie lecture (`getItem`) reste une source.
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeFile } from "../analyzer";

const dir = mkdtempSync(join(tmpdir(), "jsa-check-sources-"));

/** @brief Sources du lead `innerHTML` quand `x` reçoit `expression`. */
async function sourcesOf(name: string, expression: string): Promise<string[]> {
  const file = join(dir, `${name}.js`);
  writeFileSync(file, `var x = ${expression};\ndocument.body.innerHTML = x;\n`);
  const matches = await analyzeFile(file, ["inner-html"]);
  const lead = matches[0]?.leads?.[0];
  if (!lead?.taint)
    throw new Error(`Error [test]: aucun lead taint pour ${expression}`);
  return lead.taint.sources;
}

describe("knownSourceProvenanceToString", () => {
  it.each([
    ["local_storage_write", 'localStorage.setItem("k", "v")'],
    ["session_storage_write", 'sessionStorage.setItem("k", "v")'],
    ["window_open", 'window.open("/x")'],
    ["post_message", 'window.postMessage("m", "*")'],
  ])("%s n'est pas une source", async (name, expression) => {
    expect(await sourcesOf(name, expression)).toEqual([]);
  });

  it("localStorage.getItem reste une source", async () => {
    expect(
      await sourcesOf("local_storage_read", 'localStorage.getItem("k")'),
    ).not.toEqual([]);
  });
});
