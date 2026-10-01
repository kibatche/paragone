/**
 * @author [A likely boring stuff made by] Shevek
 * @desc serve.test.ts — La CLI avec `--serve`, lancée pour de vrai dans un dossier jetable : refus des
 *       options incohérentes, et scan terminé avant que l'API écoute.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { CLI, runIn } from "./cli";

const STARTUP_TIMEOUT_MS = 15_000;

const root = mkdtempSync(join(tmpdir(), "paragone-cli-"));
mkdirSync(join(root, "corpus"));
writeFileSync(
  join(root, "corpus", "a.js"),
  "document.body.innerHTML = location.hash;\n",
);

afterAll(() => rmSync(root, { recursive: true, force: true }));

function freePort(): number {
  const probe = Bun.serve({ port: 0, fetch: () => new Response() });
  const port = probe.port as number;
  void probe.stop(true);
  return port;
}

/** @brief Lit la sortie du processus jusqu'à ce qu'elle contienne `marker`. */
async function readUntil(
  stream: ReadableStream<Uint8Array>,
  marker: string,
): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  let text = "";
  while (!text.includes(marker)) {
    if (Date.now() > deadline)
      throw new Error(
        `Error [readUntil]: « ${marker} » absent après ${STARTUP_TIMEOUT_MS} ms : ${text}`,
      );
    const { done, value } = await reader.read();
    if (done)
      throw new Error(
        `Error [readUntil]: sortie close sans « ${marker} » : ${text}`,
      );
    text += decoder.decode(value);
  }
  reader.releaseLock();
  return text;
}

describe("arguments de --serve", () => {
  it("sans aucune action, ne fait rien", () => {
    const result = runIn(root, []);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Rien à faire");
  });

  it("refuse une option du service sans --serve", () => {
    const result = runIn(root, ["--port", "8000"]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("--port n'a d'effet qu'avec --serve");
  });

  it("refuse un port invalide", () => {
    const result = runIn(root, ["--serve", "--port", "99999"]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("n'est pas un numéro de port");
  });

  it("refuse un dossier public introuvable, en le nommant", () => {
    const result = runIn(root, ["--serve", "--public", "./nulle-part"]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("./nulle-part");
  });

  it("exige toujours --analyze pour scanner", () => {
    const result = runIn(root, ["--scan"]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("--analyze");
  });
});

describe("--scan --serve", () => {
  it("termine le scan, puis sert les données à jour", async () => {
    const port = freePort();
    const child = Bun.spawn(
      [
        process.execPath,
        CLI,
        "--scan",
        "--analyze",
        "corpus",
        "--serve",
        "--port",
        String(port),
      ],
      { cwd: root, stdout: "pipe", stderr: "pipe" },
    );
    try {
      const output = await readUntil(child.stdout, "[api]");
      expect(output.indexOf("[scan] terminé")).toBeGreaterThanOrEqual(0);
      expect(output.indexOf("[scan] terminé")).toBeLessThan(
        output.indexOf("[api]"),
      );
      const response = await fetch(`http://127.0.0.1:${port}/api/summary`);
      const summary = (await response.json()) as { totals: { total: number } };
      expect(summary.totals.total).toBe(1);
    } finally {
      child.kill();
      await child.exited;
    }
  });
});
