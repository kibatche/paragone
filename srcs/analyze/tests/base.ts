/**
 * @author [A likely boring stuff made by] Shevek
 * @desc base.ts : Harnais commun des tests d'analyzer : lance un analyzer sur une fixture et
 * compare la sortie à une baseline `expectedN.json`.
 *
 * La baseline est une référence de NON-RÉGRESSION, pas une preuve de justesse : elle grave le
 * comportement du jour où elle a été écrite. La régénérer demande `UPDATE_EXPECTED=1`.
 */
import path from "path";
import fs from "fs";
import { expect, it } from "vitest";
import { analyzeFile, type AnalyzerType } from "../analyzer";
import { type AnalyzerMatch } from "../constants/types";

/** Racine des tests. Sert de repère pour rendre `filePath` indépendant de la machine. */
const TESTS_ROOT = __dirname;

/**
 * Réécrit chaque `expectedN.json` à partir de la sortie courante au lieu de comparer.
 *
 * Le geste est explicite par construction : une réécriture silencieuse ferait passer n'importe
 * quelle régression pour un succès.
 */
const UPDATE_EXPECTED = process.env.UPDATE_EXPECTED === "1";

export interface BaseTestCase {
  jsFileName: string;
  expectedResults: AnalyzerMatch[];
}

/**
 * @brief Rend un match comparable d'une machine à l'autre.
 *
 * `analyzeFile` renseigne `filePath` avec un chemin absolu. Le graver tel quel dans une baseline
 * la lie à un poste de travail : c'est ce qui rendait inutilisables les fixtures héritées de
 * jxscout, dont les 25 portaient `/Users/francisconeves/projects/jxscout/...`.
 */
function normalizeMatch(match: AnalyzerMatch): AnalyzerMatch {
  return { ...match, filePath: path.relative(TESTS_ROOT, match.filePath) };
}

/** @brief Ordre stable : l'ordre de visite de babel n'est pas un contrat. */
function sortByValue(matches: AnalyzerMatch[]): AnalyzerMatch[] {
  return [...matches].sort((a, b) => a.value.localeCompare(b.value));
}

export async function createBaseTest(
  testType: string,
  testCase: BaseTestCase,
  analyzerType: AnalyzerType,
  number: number,
) {
  it(`${testType} ${number} - ${testCase.jsFileName}`, async () => {
    const filePath = path.join(
      TESTS_ROOT,
      testType,
      "files",
      testCase.jsFileName,
    );
    const matches = await analyzeFile(filePath, [analyzerType]);
    const results = sortByValue(matches.map(normalizeMatch));

    const expectedPath = path.join(
      TESTS_ROOT,
      testType,
      `expected${number}.json`,
    );

    if (UPDATE_EXPECTED || !fs.existsSync(expectedPath)) {
      fs.writeFileSync(expectedPath, `${JSON.stringify(results, null, 2)}\n`);
      return;
    }

    expect(results).toEqual(sortByValue(testCase.expectedResults));
  });
}

export function loadExpectedResults(
  testType: string,
  number: number = 1,
): AnalyzerMatch[] {
  const expectedPath = path.join(
    TESTS_ROOT,
    testType,
    `expected${number}.json`,
  );

  try {
    if (!fs.existsSync(expectedPath)) {
      console.warn(`Baseline absente : ${expectedPath}`);
      return [];
    }

    const parsed = JSON.parse(fs.readFileSync(expectedPath, "utf-8"));

    if (!Array.isArray(parsed)) {
      console.warn(`Baseline mal formée (tableau attendu) : ${expectedPath}`);
      return [];
    }

    return parsed;
  } catch (error) {
    console.warn(`Baseline illisible : ${expectedPath}`, error);
    return [];
  }
}
