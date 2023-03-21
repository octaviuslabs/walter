import Config from "./config";
import { URL } from "node:url";
import octokit, { ParsedGitHubURL, parseGitHubURL } from "./gh";

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
    role: issueResponse.data.user?.login === Config.githubBotName ? "assistant" : "user",
    content: issueResponse.data.body || "",
  };

  const commentHistory: Message[] = commentsResponse.data
    .filter((comment) => comment.user !== null && comment.body !== null)
    .map((comment) => ({
      role: comment.user?.login === Config.githubBotName ? "assistant" : "user",
      content: comment.body || "",
    }));

  // Add the issue body to the beginning of the comment history
  return [issueBody, ...commentHistory];
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
    // TODO could be good to fuzzily get the end rather than going to the end of time
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

export const extractUrls = (textBody: string): ParsedGitHubURL[] => {
  const rx =
    /(?:(?:https?|ftp|file):\/\/|www\.|ftp\.)(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[-A-Z0-9+&@#\/%=~_|$?!:,.])*(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[A-Z0-9+&@#\/%=~_|$])/gim;

  const matches = textBody.match(rx) || [];
  const out = [];
  for (const match of matches) {
    out.push(parseGitHubURL(match));
  }
  return out;
};