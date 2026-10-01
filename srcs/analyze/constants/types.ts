import * as parser from "@babel/parser";
import type { File, SourceLocation } from "@babel/types";
import { type Visitor } from "@babel/traverse";
import type { Lead } from "./lead";

export type Position = SourceLocation["start"];

export interface AnalyzerMatch {
  filePath: string;
  analyzerName: string;
  value: string;
  start: Position;
  end: Position;
  leads?: Lead[];
}

export interface AnalyzerParams {
  ast: parser.ParseResult<File>;
  source: string;
  filePath: string;
}

export type Analyzer = (
  params: AnalyzerParams,
  matchesReturn: AnalyzerMatch[],
) => Visitor;
