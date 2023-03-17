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
import winston from "winston";

const BOT_NAME = Config.githubBotName;
const BOT_LABEL = "walter-build";

const webhooks = new Webhooks({ secret: Config.githubWebhookSecret });

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] ${level}: ${message}`;
    })
  ),
  transports: [new winston.transports.Console()],
});

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
  // ... (rest of the code)

  return description.trim();
}

function extractTaskInfo(issue: any): {
  description: string;
  files: string[];
  lines: number[];
} {
  // ... (rest of the code)
}

webhooks.on("issues.opened", async (event: any) => {
  logger.info("new issue");
  const issue = event.payload.issue;
  const repository = event.payload.repository;

  if (isBotTask(issue, repository.name)) {
    logger.info("Processing issue", issue);
    const taskInfo = await extractTaskInfoAndEmbed(issue);
    const pseudocode = await generatePseudocodeFromEmbedded(taskInfo, []);
    await postComment(repository, issue, pseudocode);
  }
});

// ... (rest of the code)

const middleware = createNodeMiddleware(webhooks, { path: "/webhook" });

const app = express();
app.use(middleware);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => logger.info(`Server listening on port ${PORT}`));