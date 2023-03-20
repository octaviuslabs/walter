import { Webhooks, createNodeMiddleware } from "@octokit/webhooks";
import express from "express";
import {
  generatePseudocodeFromEmbedded,
  postComment,
  createEdit,
  createEditWithChat,
  callChat,
  ChatType,
} from "./code-generator";
import {
  getFileFromPullRequestComment,
  handleCodeGeneration,
  createNewPullRequest,
} from "./code-committer";
import Config from "./config";
import octokit, { parseGitHubURL } from "./gh";
import * as utils from "./utils";
import { parseCommentForJobs, parseFreeTextForJob } from "./job-interpreter";
import Log from "./log";
import fastq from "fastq";
import { v4 as uuidv4 } from "uuid";

const BOT_NAME = Config.githubBotName;
const BOT_LABEL = "walter-build";

const queue = fastq.promise(processEvent, 1);
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
  | { type: "approve"; body: string; files?: string[]; lines?: number[] }
  | { type: "design"; body: string };

webhooks.on("issue_comment.created", async (event: any) => {
  const comment = event.payload.comment;
  const issue = event.payload.issue;
  const repository = event.payload.repository;

  if (
    isBotTask(issue, repository.full_name, comment.user.name) &&
    comment.user.login != BOT_NAME
  ) {
    await postComment(
      event.payload.repository,
      event.payload.issue,
      [`> ${comment.body} `, "Queued for processing..."].join("\n\n")
    );
    queue.push(event);
  }
});

async function processEvent(event: any) {
  const comment = event.payload.comment;
  const issue = event.payload.issue;
  const repository = event.payload.repository;

  if (
    isBotTask(issue, repository.full_name, comment.user.name) &&
    comment.user.login != BOT_NAME
  ) {
    Log.info("Processing event");
    const action: CommentAction = parseComment(comment);

    try {
      if (action.type === "approve") {
        Log.info("Processing refine task");
        postComment(
          event.payload.repository,
          event.payload.issue,
          [`> ${comment.body} `, "Processing this now"].join("\n\n")
        );

        let commentHistory = await utils.getCommentHistory(
          repository,
          issue.number
        );
        const job = parseFreeTextForJob(action.body);
        const jobs = [job];

        if (jobs.length > 0) {
          const res = await Promise.all(
            jobs.map((job) => createEditWithChat(job, commentHistory))
          );
          await createNewPullRequest(res, repository, issue.number);
        }
        return;
      } else if (action.type === "design") {
        processDesignAction(event);
      }
    } catch (err) {
      Log.log("error", "ERROR", err);
    }
  } else {
    Log.log("info", "Ignoring comment");
  }
}

webhooks.on("pull_request_review_comment.created", async (event: any) => {
  const comment = event.payload.comment;
  Log.info("Pull request comment body:", comment.body);
  //getFileFromPullRequestComment(repository, commentId)
});

function parseComment(comment: any): CommentAction {
  function isCommentApproving(commentBody: string, botName: string): boolean {
    const approvePattern = new RegExp(`@${botName}\\s*APPROVED`, "i");
    return approvePattern.test(commentBody);
  }

  if (isCommentApproving(comment.body, BOT_NAME)) {
    return { type: "approve", body: comment.body };
  }

  // deisgn by default
  return { type: "design", body: comment.body };
}

async function parseCommentWithEmbedded(comment: any): Promise<CommentAction> {
  const myParsed = parseComment(comment);
  if (myParsed.type != "refine") {
    return myParsed;
  }

  const taskInfo = await extractTaskInfoAndEmbed(myParsed.body as string);
  return { type: "refine", body: taskInfo };
}

async function processDesignAction(event: any) {
  const id = uuidv4();
  const comment = event.payload.comment;
  const issue = event.payload.issue;
  const repository = event.payload.repository;
  Log.info(`Design action comment body: ${comment.body}`);
  const comments = await utils.getCommentHistory(repository, issue.number);
  const urls = utils.extractUrls(comment.body);

  let fileBody: utils.FileContent;

  const pmpt = [];
  if (urls.length > 0) {
    Log.info("Multiple github urls found, getting first");
    const fileBody = await utils.getFileFromUrl(urls[0].url);
    if (fileBody) {
      pmpt.push(fileBody.focus ? fileBody.focus : fileBody.body);
    }
    pmpt.push("The above file can provide some context for the following");
  }

  pmpt.push(comment.body);

  const res = await callChat(id, pmpt.join("\n"), comments, ChatType.Design);

  await postComment(event.payload.repository, event.payload.issue, res);
}

const middleware = createNodeMiddleware(webhooks, { path: "/webhook" });

const app = express();
app.use(middleware);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => Log.info(`Server listening on port ${PORT}`));