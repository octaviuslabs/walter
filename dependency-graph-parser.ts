import { DepGraph } from "dependency-graph";
import * as path from "path";
import * as ts from "typescript";
import { Octokit } from "@octokit/rest";
import octokit, { Branch, ParsedGitHubURL, parseGitHubURL } from "./gh";
import * as utils from "./utils";
import Log from "./log";

const MAX_CACHE_AGE = 1000 * 60 * 5; // 5 minutes

interface Dep {
  path: ParsedGitHubURL;
  tsSourceFile: ts.SourceFile;
}

// based on the current path, calculate the absolute path to the target path
// e.g. if currentFile is /a/b/c/d.ts and targetFile is ../../f.ts,
// the output is  /a/b/f.ts
function calculateAbsolutePath(
  currentFile: string,
  targetFile: string
): string {
  if (currentFile[0] != "/") currentFile = "/" + currentFile;

  let currentDir = path.dirname(currentFile);
  const absolutePath = path.resolve(currentDir, targetFile);
  return absolutePath;
}

const cache: Map<string, { timestamp: number; graph: DependencyGraphParser }> =
  new Map();

export const getCachedDeps = async (
  githubUrl: string
): Promise<DependencyGraphParser> => {
  Log.info(`Loading cached deps for: ${githubUrl}`);
  const cached = cache.get(githubUrl);
  if (cached && cached.timestamp > Date.now() - MAX_CACHE_AGE) {
    Log.info(`Using cached deps for ${githubUrl}`);
    return cached.graph;
  }
  Log.info(`Fetching new deps for ${githubUrl}`);
  const graph = new DependencyGraphParser(githubUrl);
  await graph.build();
  cache.set(githubUrl, { timestamp: Date.now(), graph });
  return graph;
};

export default class DependencyGraphParser {
  private graph: DepGraph<ts.SourceFile>;
  private octokit: Octokit;
  private branch: Branch;
  private targetFile: ParsedGitHubURL;

  constructor(gitHubFileUrl: string) {
    this.graph = new DepGraph<ts.SourceFile>({ circular: false });
    this.octokit = octokit;
    this.targetFile = parseGitHubURL(gitHubFileUrl);
    this.branch = new Branch(
      this.targetFile.owner,
      this.targetFile.repo,
      this.targetFile.branch
    );
  }

  public async build(): Promise<DepGraph<ts.SourceFile>> {
    Log.info(
      `Building dependency graph for ${this.targetFile.url} excluding target`
    );
    const deps = await this.getDependencies(this.targetFile);

    for (const dep of deps.deps) {
      await this.processFile(dep);
    }
    return this.graph;
  }

  public async buildInclusive(): Promise<DepGraph<ts.SourceFile>> {
    Log.info(
      `Building dependency graph for ${this.targetFile.url} including target`
    );
    await this.processFile(this.targetFile);
    return this.graph;
  }

  private async getDependencies(targetFile: ParsedGitHubURL): Promise<{
    sourceFile: ts.SourceFile;
    deps: ParsedGitHubURL[];
    url: ParsedGitHubURL;
  }> {
    Log.info(`Getting dependencies for ${targetFile.url}`);
    const fileContent = await utils.getFileFromUrl(targetFile.url);

    const sourceFile = ts.createSourceFile(
      fileContent.parsedUrl.filePath,
      fileContent.body,
      ts.ScriptTarget.ES2015,
      true
    );

    const deps: ParsedGitHubURL[] = [];
    const branch = this.branch;

    sourceFile.forEachChild((node) => {
      if (ts.isImportDeclaration(node)) {
        const importPath = (node.moduleSpecifier as ts.StringLiteral).text;
        if (!importPath.startsWith(".") && !importPath.startsWith("/")) {
          Log.info(`Skipping import ${importPath}`);
          return;
        }

        const imported = calculateAbsolutePath(
          targetFile.filePath,
          importPath + ".ts"
        );

        Log.info(`Adding import ${imported}`);

        deps.push(branch.urlForPath(imported));
      }
    });

    return {
      sourceFile,
      deps,
      url: targetFile,
    };
  }

  private async processFile(url: ParsedGitHubURL): Promise<void> {
    Log.info(`Processing file ${url.url}`);
    if (this.graph.hasNode(url.url)) {
      Log.info(`Node exists ${url.url}`);
      return;
    }

    const src = await this.getDependencies(url);
    this.graph.addNode(url.url, src.sourceFile);

    for (const dep of src.deps) {
      await this.processFile(dep);
      Log.info(`Adding edge ${src.url.url} -> ${dep.url}`);
      this.graph.addDependency(src.url.url, dep.url);
    }
  }

  public toString(): string {
    const order = this.graph.overallOrder();
    const printer = ts.createPrinter();

    let out: string[] = [];
    for (const node of order) {
      const data = this.graph.getNodeData(node);
      out.push(`// SOURCE_FILE: ${node}`);
      out.push(printer.printFile(data));
      out.push(`// END: ${node}`);
    }
    return out.join("\n");
  }

  public toSourceFile(): ts.SourceFile {
    const doc = this.toString();
    return ts.createSourceFile(
      "dependencies.ts",
      doc,
      ts.ScriptTarget.ES2015,
      true
    );
  }
}
