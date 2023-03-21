import octokit, { parseGitHubURL } from "../gh";
import Log from "../log";
import * as t from "./types";
import Config from "../config";

function extractTaskInfo(issue: any): {
  description: string;
  files: string[];
  lines: number[];
} {
  const description = issue.body;
  const fileRegex = /file:\s*([\w./-]+)/gi;
  const lineRegex = /line:\s*(\d+)/gi;

  const files: string[] = [];
  const lines: number[] = [];

  let fileMatch = fileRegex.exec(description);
  while (fileMatch) {
    files.push(fileMatch[1]);
    fileMatch = fileRegex.exec(description);
  }

  let lineMatch = lineRegex.exec(description);
  while (lineMatch) {
    lines.push(parseInt(lineMatch[1], 10));
    lineMatch = lineRegex.exec(description);
  }

  return { description, files, lines };
}

export async function extractTaskInfoAndEmbed(
  issueBody: string
): Promise<string> {
  const githubUrlRegex =
    /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/;

  let description = issueBody;

  const matches = githubUrlRegex.exec(issueBody);

  const files: { link: string; snippit: string }[] = [];

  if (matches == null) {
    return description;
  }

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const parsedUrl = parseGitHubURL(match);

    if (!parsedUrl) continue;

    try {
      const fileContentResponse = await octokit.rest.repos.getContent({
        owner: parsedUrl.owner,
        repo: parsedUrl.repo,
        path: parsedUrl.filePath,
        ref: parsedUrl.branch,
      });

      const fileContent = Buffer.from(
        (fileContentResponse.data as any).content,
        "base64"
      ).toString();

      Log.info("file contents", fileContent);

      files.push({
        link: match,
        snippit: fileContent,
      });
    } catch (err: any) {
      Log.info(
        "error",
        `Error fetching file content from GitHub: ${err.message}`
      );
    }
  }

  return description.trim();
}

export function parseComment(
  comment: string,
  userName: string
): t.CommentAction {
  const approveRegex = new RegExp(`@${Config.githubBotName}\\s*APPROVED`, "i");
  const statusRegex = new RegExp(
    `(Queued for processing...|Processing this now)`,
    "i"
  );

  if (userName === Config.githubBotName && statusRegex.test(comment)) {
    return { type: "status", body: comment };
  }

  if (approveRegex.test(comment)) {
    return { type: "approve", body: comment };
  }

  // design by default
  return { type: "design", body: comment };
}
