import fastq from "fastq";
import Config from "../config";
import * as gh from "../gh";
import { issueCommentHdlr, prCommentHdlr } from "./comment";
import * as oct from "@octokit/webhooks-types";
export * from "./types";
import Log from "../log";

const queue = fastq.promise(routeEvent, 1);

async function routeEvent(event: any): Promise<void> {
  const action = event.payload.action;
  const repository = event.payload.repository;
  const comment = event.payload.comment;
  const issue = event.payload.issue;
  const routingKey = [event.name, action].join(".");

  Log.info(`Routing event: ${routingKey}`);
  if (routingKey == "issue_comment.created") {
    await gh.postIssueComment(
      repository,
      issue,
      [`> ${comment.body} `, "Processing this now"].join("\n\n")
    );
    await issueCommentHdlr(event.payload);
    return;
  }

  if (routingKey == "pull_request_review_comment.created") {
    await prCommentHdlr(event);
    return;
  }
}

export async function processEvent(event: any) {
  Log.info(`Processing Event ${event.id}`);
  if (event.payload.action != "created") {
    Log.info("Ignoring event because it is not a created event");
    return;
  }

  const comment = event.payload.comment;
  const issue = event.payload.issue;
  const repository = event.payload.repository;

  if (comment.user.login == Config.githubBotName) {
    Log.info("Ignoring event because it is a comment from a bot");
    return;
  }

  if (isBotTask(issue, repository.full_name, comment.user.login, comment)) {
    await gh.postIssueComment(
      event.payload.repository,
      event.payload.issue,
      [`> ${comment.body} `, "Queued for processing..."].join("\n\n")
    );
    queue.push(event);
  }
}

function isBotTask(
  issue: oct.Issue,
  repository: string,
  user: string,
  comment: oct.Comment
): boolean {
  if (user == undefined) {
    throw "user can not be undefined";
  }
  if (
    !Config.supportedRepos.includes(repository) &&
    !Config.supportedUsers.includes(user)
  ) {
    return false;
  }

  const botMention = `@${Config.githubBotName}`;
  if (comment.body.includes(botMention)) {
    return true;
  }

  return false;
}
