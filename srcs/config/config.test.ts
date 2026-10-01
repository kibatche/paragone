/**
 * @author [A likely boring stuff made by] Shevek
 * @desc config.test.ts — `setConfig` écrit l'objet `config` avec les mêmes vérifications et la même
 *       normalisation que les arguments, et n'y touche pas quand une valeur est refusée.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { IMPACT_CLASSES } from "../analyze/constants/lead";
import { config, setConfig } from "./config";

const root = mkdtempSync(join(tmpdir(), "paragone-config-"));
const corpus = join(root, "corpus");
mkdirSync(corpus);
writeFileSync(join(root, "bundle.js"), "document.title = 1;\n");

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("setConfig", () => {
  it("écrit le dossier en chemin absolu, les classes normalisées et le lot", () => {
    setConfig({ analyze: corpus, classes: ["xss", "XSS", "cspt"], batch: 3 });
    expect(config).toMatchObject({
      analyze: corpus,
      classes: ["XSS", "CSPT"],
      batch: 3,
    });
  });

  it("accepte un fichier, et `all` pour toutes les classes", () => {
    setConfig({ analyze: join(root, "bundle.js"), classes: ["all"], batch: 1 });
    expect(config.analyze).toBe(join(root, "bundle.js"));
    expect(config.classes).toEqual([...IMPACT_CLASSES]);
  });

  it("garde le reste de l'objet : les options du lancement ne bougent pas", () => {
    const before = {
      serve: config.serve,
      port: config.port,
      host: config.host,
    };
    setConfig({ analyze: corpus, classes: ["xss"], batch: 2 });
    expect({
      serve: config.serve,
      port: config.port,
      host: config.host,
    }).toEqual(before);
  });

  it("refuse un dossier introuvable, une classe inconnue et un lot non numérique, sans rien changer", () => {
    setConfig({ analyze: corpus, classes: ["xss"], batch: 2 });
    const before = structuredClone(config);
    expect(() =>
      setConfig({ analyze: join(root, "absent"), classes: ["xss"], batch: 1 }),
    ).toThrow(/absent/);
    expect(() =>
      setConfig({ analyze: corpus, classes: ["nope"], batch: 1 }),
    ).toThrow(/nope/);
    expect(() =>
      setConfig({ analyze: corpus, classes: ["xss"], batch: Number.NaN }),
    ).toThrow(/batch/);
    expect(config).toEqual(before);
  });
});
