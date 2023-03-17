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
const BOT_LABEL = process.env.BOT_LABEL || "walter-build";

const webhooks = new Webhooks({ secret: Config.githubWebhookSecret });

function isBotTask(issue: any, repository: string): boolean {
  // Replace 'bot-label' with the label you want to use to identify bot tasks
  if (repository != "walter") {
    return false;
  }
  return issue.labels.some((label: any) => label.name === BOT_LABEL);
}

// ... rest of the code
