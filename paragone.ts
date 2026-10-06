#!/usr/bin/env bun

import {
  config,
  loadConfig,
  writeConfigFileOnDisk,
} from "./srcs/config/config";
import { log, RUN_ID, logEvent } from "./srcs/cli/log/log";
import { judgeClasses } from "./srcs/judge/judge";
import { ZERO_USAGE } from "./srcs/cli/usage/constants";
import { formatUsage, addUsage } from "./srcs/cli/usage/usage";
import { createJevClient } from "./srcs/judge/jev/client";
import { ensureScan } from "./srcs/scan/scan";
import type { Usage } from "./srcs/cli/usage/types";
import { existsSync, mkdirSync } from "node:fs";
import { confirmReset, destroyParagoneDir } from "./srcs/cli/reset/reset";
import { parseCliOptions } from "./srcs/config/check_arguments";
import { initDatabase } from "./srcs/db/db";

async function main() {
  try {
    const args = parseCliOptions(Bun.argv);
    await loadConfig(args)
    writeConfigFileOnDisk();
    if (config.reset === true) {
      if (config.noninteractive === false && !process.stdin.isTTY) {
        throw new Error(
          "Impossible de supprimer le dossier .paragone car l'option --noninteractive n'a pas été spécifiée alors que le programme est lancé sans TTY. Veuillez recommencer avec l'option '--noninteractive'.",
        );
      }
      const choice = confirmReset();
      if (choice === true) {
        destroyParagoneDir();
        mkdirSync(config.paragone_directory);
        writeConfigFileOnDisk();
      } else {
        console.log("Reset annulé. Le programme va quitter.");
        process.exit(0);
      }
    }
  } catch (e) {
    console.error("[ERROR]", e);
    process.exit(1);
  }
  if (existsSync(config.paragone_directory) === false) {
    mkdirSync(config.paragone_directory);
    writeConfigFileOnDisk()
  }
  initDatabase();
  if (config.scan === true || config.reset === true) await ensureScan();
  if (config.judge === true) {
    try {
      const client = createJevClient();
      const usage = await judgeClasses(client);

      let runTotal: Usage = { ...ZERO_USAGE };

      log("\n=== Coût par classe ===");
      for (const [cls, u] of Object.entries(usage)) {
        log(`  ${cls}: judge ${formatUsage(u)}`);
        runTotal = addUsage(runTotal, u);
      }
      log(`  ── RUN ${RUN_ID} : ${formatUsage(runTotal)}`);
      logEvent("run_end", { ...runTotal });
      log("\nFinished.\n");
    } catch (e) {
      log(`\n[ERROR]: ${e}`);
      process.exit(1);
    }
  }
  if (config.serve === true) {
    try {
      const { startApi } = await import("./srcs/api/start");
      await startApi({
        port: config.port,
        host: config.host,
        cors: config.cors,
        publicDir: config.public,
      });
    } catch (e) {
      console.error("[ERROR]", e);
      process.exit(1);
    }
  }
}

main();
