import Config from "./config";
import octokit from "./gh";
import { URL } from "node:url";
import { ParsedGitHubURL, parseGitHubURL } from "./gh";

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

export interface FileContent {
  body: string;
  focus?: string;
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

  let focus: string | undefined;
  if (parsedUrl.startLine) {
    // TODO could be good to fuzzily get the end rather then going to end of time
    const lines = body.split("\n");
    const endLine = parsedUrl.endLine || lines.length - 1;

    focus = lines.slice(parsedUrl.startLine - 1, endLine).join("\n");
  }

  return {
    body,
    parsedUrl,
    focus,
  };
};
