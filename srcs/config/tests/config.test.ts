/**
 * @author Shevek
 * @desc config.test.ts : le chargement de la configuration. Les couches (défauts, disque, ligne de commande)
 *       se superposent dans le bon ordre, le disque ne reçoit que la config et jamais les args.
 */
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IMPACT_CLASSES } from "../../analyze/constants/lead";
import { parseCliOptions } from "../check_arguments";
import {
  checkAnalyze,
  config,
  loadConfig,
  setConfig,
  writeConfigFileOnDisk,
} from "../config";

let project: string;

function writeDiskConfig(content: unknown): void {
  mkdirSync(join(project, ".paragone"), { recursive: true });
  writeFileSync(
    join(project, ".paragone", "paragone_config.json"),
    typeof content === "string" ? content : JSON.stringify(content),
  );
}

function cli(...flags: string[]): Record<string, unknown> {
  return parseCliOptions([
    "bun",
    "paragone",
    "-p",
    project,
    "-a",
    project,
    ...flags,
  ]);
}

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), "paragone-config-"));
});

afterEach(() => {
  rmSync(project, { recursive: true, force: true });
});

describe("couches", () => {
  it("laisse le défaut Zod quand ni le disque ni la CLI ne fournissent la valeur", async () => {
    await loadConfig(cli());
    expect(config.batch).toBe(1);
    expect(config.port).toBe(7331);
  });

  it("préfère la valeur du disque au défaut", async () => {
    writeDiskConfig({ batch: 5 });
    await loadConfig(cli());
    expect(config.batch).toBe(5);
  });

  it("préfère la valeur de la CLI à celle du disque", async () => {
    writeDiskConfig({ port: 8000 });
    await loadConfig(cli("--serve", "--port", "9000"));
    expect(config.port).toBe(9000);
  });

  it("ne remplace pas le nom du disque quand la CLI n'en fournit pas", async () => {
    writeDiskConfig({ paragone_project_name: "nom_du_disque" });
    await loadConfig(cli());
    expect(config.paragone_project_name).toBe("nom_du_disque");
  });

  it("ignore un fichier disque illisible et applique les défauts", async () => {
    writeDiskConfig("{ pas du json");
    await loadConfig(cli());
    expect(config.batch).toBe(1);
  });

  it("ignore un fichier disque dont une valeur est refusée", async () => {
    writeDiskConfig({ batch: 99 });
    await loadConfig(cli());
    expect(config.batch).toBe(1);
  });

  it("charge les défauts quand le projet n'a pas de .paragone", async () => {
    await loadConfig(cli());
    expect(config.batch).toBe(1);
  });
});

describe("validation", () => {
  it("refuse un analyze inexistant en nommant le champ", async () => {
    const args = cli();
    args.analyze = join(project, "absent");
    await expect(loadConfig(args)).rejects.toThrow("<analyze>");
  });

  it("dérive les chemins du dossier du projet", async () => {
    await loadConfig(cli());
    expect(config.paragone_db_file).toBe(
      join(project, ".paragone", "findings.db"),
    );
    expect(config.paragone_directory).toBe(join(project, ".paragone"));
  });

  it("met les classes en majuscules", async () => {
    await loadConfig(cli("-c", "xss,web_message"));
    expect(config.classes).toEqual(["XSS", "WEB_MESSAGE"]);
  });

  it("développe ALL en toutes les classes", async () => {
    await loadConfig(cli("-c", "all"));
    expect(config.classes).toEqual([...IMPACT_CLASSES]);
  });
});

describe("disque", () => {
  it("n'écrit aucune clé d'args", async () => {
    await loadConfig(cli("-j", "-r", "--noninteractive", "-c", "xss"));
    await writeConfigFileOnDisk();

    const written = JSON.parse(
      readFileSync(config.paragone_config_file, "utf8"),
    ) as Record<string, unknown>;
    for (const arg of [
      "analyze",
      "classes",
      "scan",
      "judge",
      "serve",
      "reset",
      "noninteractive",
    ]) {
      expect(written).not.toHaveProperty(arg);
    }
  });

  it("écrit la config persistante et le nom du projet", async () => {
    await loadConfig(cli("-n", "mon_projet", "-b", "3"));
    await writeConfigFileOnDisk();

    const written = JSON.parse(
      readFileSync(config.paragone_config_file, "utf8"),
    ) as Record<string, unknown>;
    expect(Object.keys(written).sort()).toEqual([
      "batch",
      "cors",
      "host",
      "paragone_project_name",
      "port",
      "public",
    ]);
    expect(written.batch).toBe(3);
    expect(written.paragone_project_name).toBe("mon_projet");
  });

  it("relit ce qu'elle a écrit", async () => {
    await loadConfig(cli("-b", "4"));
    await writeConfigFileOnDisk();
    await loadConfig(cli());
    expect(config.batch).toBe(4);
  });
});

describe("arguments", () => {
  it("ne rend aucune clé dont la valeur est undefined", () => {
    const args = cli();
    expect(Object.values(args)).not.toContain(undefined);
  });

  it("renomme les options du projet en clés de schéma", () => {
    const args = cli("-n", "mon_projet");
    expect(args.paragone_project_path).toBe(project);
    expect(args.paragone_project_name).toBe("mon_projet");
  });

  it("checkAnalyze refuse un chemin inexistant", () => {
    expect(() => checkAnalyze(join(project, "absent"))).toThrow("<analyze>");
  });
});

describe("setConfig", () => {
  it("applique un analyze, des classes et un lot valides", async () => {
    await loadConfig(cli());
    setConfig({ analyze: project, classes: ["cspt"], batch: 2 });
    expect(config.analyze).toBe(project);
    expect(config.classes).toEqual(["CSPT"]);
    expect(config.batch).toBe(2);
  });

  it("refuse une valeur invalide et laisse config intact", async () => {
    await loadConfig(cli());
    expect(() =>
      setConfig({ analyze: project, classes: ["xss"], batch: 50 }),
    ).toThrow("<batch>");
    expect(config.batch).toBe(1);
  });
});
