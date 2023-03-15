import Config from "./config";
import octokit from "./gh";
import UrlPattern from "url-pattern";
import { URL } from "node:url";

interface Repository {
  owner: {
    login: string;
  };
  name: string;
}

export interface Message {
  role: any;
  content: string;
}

export async function getCommentHistory(
  repository: Repository,
  issueNumber: number
): Promise<Message[]> {
  const commentsResponse = await octokit.rest.issues.listComments({
    owner: repository.owner.login,
    repo: repository.name,
    issue_number: issueNumber,
  });

  const commentHistory: Message[] = commentsResponse.data
    .filter((comment) => comment.user !== null && comment.body !== null)
    .map((comment) => ({
      role: comment.user?.login === Config.githubBotName ? "developer" : "user",
      content: comment.body || "",
    }));

  return commentHistory;
}

export interface ParsedGitHubURL {
  owner: string;
  repo: string;
  branch: string;
  filePath: string;
  startLine: number | undefined;
  endLine: number | undefined;
  url: string;
}

export function parseGitHubURL(url: string): ParsedGitHubURL | null {
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

export interface FileContent {
  body: string;
  parsedUrl: ParsedGitHubURL;
}

export const getFileFromUrl = async (url: string): Promise<FileContent> => {
  const parsedUrl = parseGitHubURL(url);
  if (!parsedUrl) {
    throw "Not null";
  }

  const fileContentResponse = await octokit.rest.repos.getContent({
    owner: parsedUrl.owner,
    repo: parsedUrl.repo,
    path: parsedUrl.filePath,
    ref: parsedUrl.branch,
  });

  const body = Buffer.from(
    (fileContentResponse.data as any).content,
    "base64"
  ).toString();

  return {
    body,
    parsedUrl,
  };
};
