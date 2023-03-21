import { Octokit } from "@octokit/rest";
import Config from "./config";
import Log from "./log";
import * as ts from 'typescript';
import { OpenAIClient } from 'openai-client';

export interface IGitHubFileFetcher {
  repoOwner: string;
  repoName: string;
  githubToken: string;
  octokit: Octokit;

  getFileContent(filePath: string): Promise<string>;
}

export class GitHubFileFetcher implements IGitHubFileFetcher {
  repoOwner: string;
  repoName: string;
  githubToken: string;
  octokit: Octokit;

  constructor(repoOwner: string, repoName: string, githubToken?: string) {
    githubToken = githubToken || Config.githubApiToken;
    this.repoOwner = repoOwner;
    this.repoName = repoName;
    this.githubToken = githubToken;
    this.octokit = new Octokit({ auth: githubToken });
  }

  async getFileContent(filePath: string): Promise<string> {
    Log.info(`Getting file from gh: ${filePath}`);
    const response = await this.octokit.repos.getContent({
      owner: this.repoOwner,
      repo: this.repoName,
      path: filePath,
    });

    const data = response.data as any;
    if (data.type === "file" && data.content) {
      return Buffer.from((response.data as any).content, "base64").toString(
        "utf8"
      );
    } else {
      throw new Error(`Could not fetch file content for: ${filePath}`);
    }
  }

  async fetchAndParseFunctions(filePath: string): Promise<void> {
    // Fetch the TypeScript file content
    const fileContent = await this.getFileContent(filePath);

    // Parse the fetched TypeScript file content to extract all functions
    const functions = this.parseFunctions(fileContent);

    // Generate code embeddings for the extracted functions
    const embeddings = await this.generateEmbeddings(functions);

    // Log the embeddings
    console.log(embeddings);
  }

  parseFunctions(fileContent: string): Array<Function> {
    const functions = [];
    const sourceFile = ts.createSourceFile('temp.ts', fileContent, ts.ScriptTarget.Latest, true);

    const visitNode = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isMethodDeclaration(node)) {
        functions.push(node);
      }
      ts.forEachChild(node, visitNode);
    };

    ts.forEachChild(sourceFile, visitNode);
    return functions;
  }

  async generateEmbeddings(functions: Array<Function>): Promise<Array<Embedding>> {
    // Initialize OpenAI client
    const openaiClient = new OpenAIClient(YOUR_OPENAI_API_KEY);

    // Generate code embeddings for the functions using the OpenAI embeddings endpoint
    const embeddings = [];
    for (const func of functions) {
      const codeSnippet = func.getText();
      const embedding = await openaiClient.generateEmbedding(codeSnippet);
      embeddings.push(embedding);
    }

    return embeddings;
  }
}

export interface ParsedGitHubURL {
  owner: string;
  repo: string;
  branch: string;
  filePath: string;
  startLine?: number;
  endLine?: number;
  url: string;
}

export class Branch {
  owner: string;
  repo: string;
  branch: string;

  constructor(owner: string, repo: string, branch: string) {
    this.owner = owner;
    this.repo = repo;
    this.branch = branch;
  }

  urlForPath(filePath: string): ParsedGitHubURL {
    if (filePath[0] == "/") filePath = filePath.substr(1);

    let url = [
      "https://github.com",
      this.owner,
      this.repo,
      "blob",
      this.branch,
      filePath,
    ];
    return {
      owner: this.owner,
      repo: this.repo,
      branch: this.branch,
      filePath,
      url: url.join("/"),
    };
  }
}

export function parseGitHubURL(url: string): ParsedGitHubURL {
  // https://github.com/octaviuslabs/mailmentor-api/blob/main/src/resolvers/index.ts#L67
  const myUrl = new URL(url);
  console.log("extracting from url", url);

  const splitPath = myUrl.pathname.split("/");
  const [_, owner, repo, pass, branch] = splitPath;
  const filePath = "/" + splitPath.slice(5, splitPath.length).join("/");

  const lineRange = myUrl.hash.split("-");
  let startLine: number | undefined = undefined;
  let endLine: number | undefined = undefined;
  if (lineRange.length > 0) {
    startLine = parseInt(lineRange[0].substring(2));
  }

  if (lineRange.length > 1) {
    endLine = parseInt(lineRange[1].substring(1));
  }

  return {
    owner,
    repo,
    branch,
    filePath,
    startLine,
    endLine,
    url,
  };
}

const octokit = new Octokit({ auth: Config.githubApiToken });

export default octokit;