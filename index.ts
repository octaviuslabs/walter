import { Webhooks, createNodeMiddleware } from "@octokit/webhooks";
import express from "express";
import {
  generatePseudocodeFromEmbedded,
  postComment,
  createEdit,
  createEditWithChat,
} from "./psudocode-generator";
import { handleCodeGeneration, createNewPullRequest } from "./code-committer";
import Config from "./config";
import octokit from "./gh";
import * as utils from "./utils";
import { parseCommentForJobs } from "./job-interpreter";
import winston from "./log";

const BOT_NAME = Config.githubBotName;
const BOT_LABEL = "walter-build";

const webhooks = new Webhooks({ secret: Config.githubWebhookSecret });

function isBotTask(issue: any, repository: string, user: string): boolean {
  if (
    !Config.supportedRepos.includes(repository) &&
    !Config.supportedUsers.includes(user)
  ) {
    return false;
  }
  return issue.labels.some((label: any) => label.name === BOT_LABEL);
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
    const parsedUrl = utils.parseGitHubURL(match);
    winston.log("info", parsedUrl);

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

      winston.log("info", "file contents", fileContent);

      files.push({
        link: match,
        snippit: fileContent,
      });
    } catch (err: any) {
      winston.log(
        "error",
        `Error fetching file content from GitHub: ${err.message}`
      );
    }
  }

  return description.trim();
}

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

type CommentAction =
  | { type: "unknown" }
  | { type: "refine"; body: string; files?: string[]; lines?: number[] }
  | { type: "approve" }
  | { type: "design"; body: string };

webhooks.on("issue_comment.created", async (event: any) => {
  const comment = event.payload.comment;
  const issue = event.payload.issue;
  const repository = event.payload.repository;

  if (
    isBotTask(issue, repository.full_name, comment.user.name) &&
    comment.user.login != BOT_NAME
  ) {
    winston.log("info", "Processing comment", comment, "on", issue);
    const action: CommentAction = parseComment(comment);
    winston.log("info", "Parsed comment", action);

    try {
      if (action.type === "refine") {
        const hist: any = [];
        const jobs = parseCommentForJobs(action.body);
        winston.log("info", "jobs", jobs);

        if (jobs.length > 0) {
          const res = await Promise.all(jobs.map(createEditWithChat));
          await createNewPullRequest(res, repository, issue.number);
        }
        return;
      } else if (action.type === "approve") {
        winston.log("info", "approved");
        const hist = await utils.getCommentHistory(repository, issue.number);
        const previousDevMsgs = hist.filter((v) => {
          return v.role == "developer";
        });

        if (previousDevMsgs.length == 0) {
          throw "No previous dev messages";
        }

        const lastDevMsg = previousDevMsgs[previousDevMsgs.length - 1];

        await handleCodeGeneration(
          lastDevMsg.content,
          repository,
          Config.githubBotName
        );
        winston.log("info", "processing complete");
      } else if (action.type === "design") {
        processDesignAction(action.body);
      }
    } catch (err) {
      winston.log("error", "ERROR", err);
    }
  } else {
    winston.log("info", "Ignoring comment");
  }
});

webhooks.on("pull_request_review_comment.created", async (event: any) => {
  const comment = event.payload.comment;
  winston.log("info", "Pull request comment body:", comment.body);
});

function parseComment(comment: any): CommentAction {
  const refineRegex = /refine\s*:\s*(.+)/i;
  const approveRegex = new RegExp(`@${BOT_NAME}\\s*APPROVED`, "i");
  const designRegex = /design\s*:\s*(.+)/i;

  if (approveRegex.test(comment.body)) {
    return { type: "approve" };
  }

  if (designRegex.test(comment.body)) {
    return { type: "design", body: comment.body };
  }

  return { type: "refine", body: comment.body };
}

async function parseCommentWithEmbedded(comment: any): Promise<CommentAction> {
  const myParsed = parseComment(comment);
  if (myParsed.type != "refine") {
    return myParsed;
  }

  const taskInfo = await extractTaskInfoAndEmbed(myParsed.body as string);
  return { type: "refine", body: taskInfo };
}

function processDesignAction(commentBody: string) {
  winston.log("info", `Design action comment body: ${commentBody}`);
}

const middleware = createNodeMiddleware(webhooks, { path: "/webhook" });

const app = express();
app.use(middleware);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => winston.log("info", `Server listening on port ${PORT}`));