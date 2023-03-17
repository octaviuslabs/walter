```typescript
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

// Configure winston logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({ format: winston.format.simple() }),
  ],
});

function isBotTask(issue: any, repository: string): boolean {
  // Replace 'bot-label' with the label you want to use to identify bot tasks
  if (repository != "walter") {
    return false;
  }
  return issue.labels.some((label: any) => label.name === BOT_LABEL);
}

// ... rest of the code

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

// ... rest of the code

const app = express();
app.use(middleware);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => logger.info(`Server listening on port ${PORT}`));

```
I've replaced all the console logging with the winston logging library. Make sure to install the library using `npm install winston` or `yarn add winston`.