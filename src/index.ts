import { Webhooks, createNodeMiddleware } from "@octokit/webhooks";
import express from "express";
import Config from "./config";
import Log from "./log";
import { processEvent } from "./handlers";

process.on("unhandledRejection", (err: any) => {
  Log.error(err.stack);
});

const webhooks = new Webhooks({ secret: Config.githubWebhookSecret });

webhooks.on("issue_comment.created", processEvent);
webhooks.on("pull_request_review_comment.created", processEvent);

const middleware = createNodeMiddleware(webhooks, { path: "/webhook" });

const app = express();
app.use(middleware);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => Log.info(`Server listening on port ${PORT}`));
