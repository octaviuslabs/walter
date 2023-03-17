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
  // Replace 'bot-label' with the label you want to use to identify bot tasks
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

  let description = issueBody;

  console.log("issue body", issueBody);
  const matches = githubUrlRegex.exec(issueBody);
  console.log(matches);

  const files: { link: string; snippit: string }[] = [];

  if (matches == null) {
    return description;
  }

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const parsedUrl = utils.parseGitHubURL(match);
    console.log(parsedUrl);

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

      console.log("file contents", fileContent);

      files.push({
        link: match,
        snippit: fileContent,
      });

      //let fileContentSnippet = fileContent;

      //if (parsedUrl.startLine) {
      //const lines = fileContent.split("\n");
      //const selectedLine = lines[parsedUrl.startLine - 1] || "";
      //fileContentSnippet = `Line ${parsedUrl.startLine}: ${selectedLine}`;
      //}

      //const fileURL = match[0];
      //description = description.replace(
      //fileURL,
      //`File: ${parsedUrl.filePath} (branch: ${parsedUrl.branch})\n\nContent:\n${fileContentSnippet}\n`
      //);
    } catch (err: any) {
      console.error(`Error fetching file content from GitHub: ${err.message}`);
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

webhooks.on("issues.opened", async (event: any) => {
  console.log("new issue");
  const issue = event.payload.issue;
  const repository = event.payload.repository;

  if (isBotTask(issue, repository.name)) {
    console.log("Processing issue", issue);
    const taskInfo = await extractTaskInfoAndEmbed(issue);
    console.log("Processing complete");
    const pseudocode = await generatePseudocodeFromEmbedded(taskInfo, []);
    await postComment(repository, issue, pseudocode);
  }
});

type CommentAction =
  | { type: "unknown" }
  | { type: "refine"; body: string; files?: string[]; lines?: number[] }
  | { type: "approve" };

// Add a webhook handler for "issue_comment" event
webhooks.on("issue_comment.created", async (event: any) => {
  const comment = event.payload.comment;
  const issue = event.payload.issue;
  const repository = event.payload.repository;

  if (isBotTask(issue, repository.name) && comment.user.login != BOT_NAME) {
    console.log("Processing comment", comment, "on", issue);
    const action: CommentAction = parseComment(comment);
    console.log("Parsed comment", action);

    if (action.type === "refine") {
      // TODO: get history
      const hist: any = []; //await utils.getCommentHistory(repository, issue.number);

      const jobs = parseCommentForJobs(action.body);
      console.log("jobs", jobs);

      if (jobs.length > 0) {
        const res = await Promise.all(jobs.map(createEdit));
        await createNewPullRequest(res, repository, issue.number);
      }
      return;
    } else if (action.type === "approve") {
      console.log("approved");
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
  // Check if the comment is for refining the plan or approving it
  // Adjust the regex and keywords as needed
  const refineRegex = /refine\s*:\s*(.+)/i;
  const approveRegex = new RegExp(`@${BOT_NAME}\\s*APPROVED`, "i");

  if (approveRegex.test(comment.body)) {
    return { type: "approve" };
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

const middleware = createNodeMiddleware(webhooks, { path: "/webhook" });

const app = express();
app.use(middleware);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
