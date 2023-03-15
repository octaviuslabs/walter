import { Webhooks, createNodeMiddleware } from "@octokit/webhooks";
import express from "express";
import { generatePseudocode, postComment } from "./psudocode-generator";
import Config from "./config";


// On line 7. Make the following changes. load this from an environment variable

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
    console.log("Processing issue");
    const taskInfo = extractTaskInfo(issue);
    const pseudocode = await generatePseudocode(
      taskInfo.description,
      taskInfo.files,
      taskInfo.lines,
      repository
    );
    await postComment(repository, issue, pseudocode);
  }
});

type CommentAction =
  | { type: "unknown" }
  | { type: "refine"; description: string; files: string[]; lines: number[] }
  | { type: "approve" };

// Add a webhook handler for "issue_comment" event
webhooks.on("issue_comment.created", async (event: any) => {
  const comment = event.payload.comment;
  const issue = event.payload.issue;
  const repository = event.payload.repository;
  console.log("new comment", event);

  if (isBotTask(issue, repository.name)) {
    console.log("Processing comment");
    const action: CommentAction = parseComment(comment);
    console.log("Parsed comment", action);

    if (action.type === "refine") {
      console.log("refining", action);
      const updatedPseudocode = await generatePseudocode(
        action.description,
        action.files,
        action.lines,
        repository
      );
      console.log("generated code", updatedPseudocode);
      await postComment(repository, issue, updatedPseudocode);
      return;
    } else if (action.type === "approve") {
      console.log("approved");
      // Proceed to the next step
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

  const taskInfo = extractTaskInfo({ body: comment.body });
  return { type: "refine", ...taskInfo };
}

const middleware = createNodeMiddleware(webhooks, { path: "/webhook" });

const app = express();
app.use(middleware);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
