import { Command } from "commander";
const program = new Command();

program
  .name("string-util")
  .description("CLI to some JavaScript string utilities")
  .version("0.8.0");

program
  .command("split")
  .description("Split a string into substrings and display as an array")
  .option("--first", "display just the first substring")
  .command("stop")
  .description("Stop a string into substrings and display as an array")
  .option("--second", "display just the second substring");

program.parse();
