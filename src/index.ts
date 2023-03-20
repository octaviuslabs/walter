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

process.on("unhandledRejection", (err: any) => {
  Log.error(err.stack);
});

const BOT_NAME = Config.githubBotName;
const BOT_LABEL = "walter-build";

const queue = fastq.promise(processEvent, 1);
const webhooks = new Webhooks({ secret: Config.githubWebhookSecret });

// ...rest of the code

webhooks.on("pull_request", async (event: any) => {
  const pullRequest = event.payload.pull_request;
  Log.info("Pull request description:", pullRequest.body);

  // Extract the related issue number
  const relatedIssueNumber = extractRelatedIssue(pullRequest.body);
  
  // Log the related issue number
  Log.info("Related issue number:", relatedIssueNumber);
});

function extractRelatedIssue(description: string): number {
  // Define a regular expression pattern to match issue numbers
  const issueNumberRegex = /#(\d+)/;

  // Search for the issue number in the description
  const match = description.match(issueNumberRegex);

  // If a match is found, return the issue number as an integer
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }

  // If no match is found, return -1 to indicate no related issue
  return -1;
}

// ...rest of the code