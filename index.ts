
// /index.ts
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

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return ${timestamp} [${level}]: ${message};
    })
  ),
  transports: [new winston.transports.Console()],
});

const webhooks = new Webhooks({ secret: Config.githubWebhookSecret });

function isBotTask(issue: any, repository: string): boolean {
  // Replace 'bot-label' with the label you want to use to identify bot tasks
  if (repository != "walter") {
    return false;
  }
  return issue.labels.some((label: any) => label.name === BOT_LABEL);
}

// ... Rest of the code

webhooks.on("issues.opened", async (event: any) => {
  logger.info("new issue");
  // ... Rest of the code
});

// ... Rest of the code

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
app.listen(PORT, () => logger.info(Server listening on port ${PORT}));
