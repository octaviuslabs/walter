import { Octokit } from "@octokit/rest";
import Config from "./config";
import Log from "./log";
import * as oct from "@octokit/webhooks-types";

const octokit = new Octokit({ auth: Config.githubApiToken });
export default octokit;

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

export interface Message {
  role: any;
  content: string;
  user?: oct.User | null;
}

export async function getCommentHistory(
  repository: oct.Repository,
  issueNumber: number
): Promise<Message[]> {
  // Fetch the issue details
  const issueResponse = await octokit.rest.issues.get({
    owner: repository.owner.login,
    repo: repository.name,
    issue_number: issueNumber,
  });

  // Fetch the issue comments
  const commentsResponse = await octokit.rest.issues.listComments({
    owner: repository.owner.login,
    repo: repository.name,
    issue_number: issueNumber,
  });

  // Include the issue body as the first comment in the comment history
  const issueBody: Message = {
    role:
      issueResponse.data.user?.login === Config.githubBotName
        ? "assistant"
        : "user",
    content: issueResponse.data.body || "",
    user: issueResponse.data.user as oct.User,
  };

  const commentHistory: Message[] = commentsResponse.data
    .filter((comment) => comment.user !== null && comment.body !== null)
    .map((comment) => ({
      role: comment.user?.login === Config.githubBotName ? "assistant" : "user",
      content: comment.body || "",
      user: comment.user as oct.User,
    }));

  // Add the issue body to the beginning of the comment history
  return [issueBody, ...commentHistory];
}

export async function postIssueComment(
  repository: oct.Repository,
  issue: oct.Issue,
  commentBody: string
): Promise<void> {
  Log.info(`Posting comment to issue: ${issue.number}`);
  await octokit.rest.issues.createComment({
    owner: repository.owner.login,
    repo: repository.name,
    issue_number: issue.number,
    body: commentBody,
  });
}

async function getFileFromPullRequestComment(
  repository: oct.Repository,
  commentId: number
): Promise<any> {
  const comment = await octokit.rest.pulls.getReviewComment({
    owner: repository.owner.login,
    repo: repository.name,
    comment_id: commentId,
  });

  const file = await octokit.rest.repos.getContent({
    owner: repository.owner.login,
    repo: repository.name,
    path: comment.data.path,
    ref: comment.data.commit_id,
  });

  return file.data;
}

export { getFileFromPullRequestComment };
