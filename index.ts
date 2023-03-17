import { Webhooks, createNodeMiddleware } from "@octokit/webhooks";
import express from "express";
import {
  generatePseudocodeFromEmbedded,
  postComment,
  createEdit,
} from "./psudocode-generator";
import { handleCodeGeneration, createNewPullRequest } from "./code-committer";
import Config from "./config";
import octokit from "./gh";
import * as utils from "./utils";
import { parseCommentForJobs } from "./job-interpreter";

const BOT_NAME = Config.githubBotName;
const BOT_LABEL = "walter-build";
const webhooks = new Webhooks({ secret: Config.githubWebhookSecret });

function isBotTask(issue: any, repository: string): boolean {
  if (repository != "walter") {
    return false;
  }
  return issue.labels.some((label: any) => label.name === BOT_LABEL);
}

export async function extractTaskInfoAndEmbed(
  issueBody: string
): Promise<string> {
  const githubUrlRegex =
    /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/;

  const files: { link: string; snippit: string }[] = [];
  const matches = githubUrlRegex.exec(issueBody);

  if (matches === null) {
    return issueBody.trim();
  }

  for (const match of matches) {
    const parsedUrl = utils.parseGitHubURL(match);

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

      files.push({
        link: match,
        snippit: fileContent,
      });
    } catch (err: any) {
      console.error(`Error fetching file content from GitHub: ${err.message}`);
    }
  }

  return issueBody.trim();
}

webhooks.on("issues.opened", async (event: any) => {
  const issue = event.payload.issue;
  const repository = event.payload.repository;

  if (isBotTask(issue, repository.name)) {
    const taskInfo = await extractTaskInfoAndEmbed(issue);
    const pseudocode = await generatePseudocodeFromEmbedded(taskInfo, []);
    await postComment(repository, issue, pseudocode);
  }
});

type CommentAction =
  | { type: "unknown" }
  | { type: "refine"; body: string; files?: string[]; lines?: number[] }
  | { type: "approve" };

webhooks.on("issue_comment.created", async (event: any) => {
  const comment = event.payload.comment;
  const issue = event.payload.issue;
  const repository = event.payload.repository;

  if (isBotTask(issue, repository.name) && comment.user.login != BOT_NAME) {
    const action: CommentAction = parseComment(comment);

    if (action.type === "refine") {
      const jobs = parseCommentForJobs(action.body);

      if (jobs.length > 0) {
        const res = await Promise.all(jobs.map(createEdit));
        await createNewPullRequest(res, repository, issue.number);
      }
      return;
    } else if (action.type === "approve") {
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
    }
  }
});

function parseComment(comment: any): CommentAction {
  const refineRegex = /refine\s*:\s*(.+)/i;
  const approveRegex = new RegExp(`@${BOT_NAME}\\s*APPROVED`, "i");

  if (approveRegex.test(comment.body)) {
    return { type: "approve" };
  }

  return { type: "refine", body: comment.body };
}

const middleware = createNodeMiddleware(webhooks, { path: "/webhook" });

const app = express();
app.use(middleware);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));