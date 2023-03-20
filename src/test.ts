import fs from "fs";
import path from "path";
import { extractCodeFromResponse, mergeDiff } from "./code-generator";
import DependencyGraphParser from "./dependency-graph-parser";
import { GitHubFileFetcher } from "./gh";
import * as utils from "./utils";
import Config from "./config";
import {
  getSourceForTargets,
  getDependenciesForSection,
  extractRelevantIdentifiers,
} from "./dependency-graph-pruner";
import ts from "typescript";

const main = async () => {
  const TARGET_URL =
    "https://github.com/octaviuslabs/walter/blob/main/index.ts#L141-L198";

  //const fileContents = await utils.getFileFromUrl(TARGET_URL);
  //console.log(fileContents.focus);
  ////const dgraph = new DependencyGraphParser(TARGET_URL);

  ////await dgraph.build();
  //const sectionSource = ts.createSourceFile(
  //"section.ts",
  //fileContents.focus as string,
  //ts.ScriptTarget.ES2015,
  //true
  //);

  //const identifiers = extractRelevantIdentifiers(sectionSource);

  //const source = getDependenciesForSection(
  //dgraph,
  //fileContents.focus as string
  //);

  const data =
    "Sure! Please provide the changes you'd like to make to https://github.com/octaviuslabs/walter/blob/main/index.ts#L185, and I can help you design a solution using pseudocode.";
  console.log(utils.extractUrls(data));
};

main();
