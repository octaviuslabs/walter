import Log from "../log";
import * as oct from "@octokit/webhooks-types";
import Config from "../config";
import { callChat, ChatType } from "../code-generator";
import * as gh from "../gh";
import * as codeGen from "../code-generator";
import * as codeCommit from "../code-committer";
import * as t from "./types";
import * as je from "../job-interpreter";
import { v4 as uuidv4 } from "uuid";
import * as utils from "../utils";
import * as parsers from "./parsers";

export const prCommentHdlr = async (
  event: oct.PullRequestReviewCommentEvent
) => {
  const comment = event.comment;
  Log.info("Pull request comment body:", comment.body);
  //getFileFromPullRequestComment(repository, commentId)
};

const historyFilter = (comment: gh.Message): boolean => {
  return (
    parsers.parseComment(comment.content, comment.user?.login as string)
      .type !== "status"
  );
};

export const issueCommentHdlr = async (event: oct.IssueCommentEvent) => {
  const comment = event.comment;
  const issue = event.issue;
  const repository = event.repository;

  Log.info("Processing event");
  const action: t.CommentAction = parsers.parseComment(
    comment.body,
    comment.user.login
  );

  try {
    if (action.type === "approve") {
      Log.info("Processing refine task");

      let commentHistory = await gh.getCommentHistory(repository, issue.number);
      commentHistory = commentHistory.filter(historyFilter);
      const job = je.parseFreeTextForJob(action.body);
      const jobs = [job];

      if (jobs.length > 0) {
        const res = await Promise.all(
          jobs.map((job) => codeGen.createEditWithChat(job, commentHistory))
        );
        await codeCommit.createNewPullRequest(res, repository, issue.number);
      }
      return;
    } else if (action.type === "design") {
      processDesignAction(event);
    }
  } catch (err) {
    Log.error(err);
  }
};

async function processDesignAction(event: oct.IssueCommentEvent) {
  const id = uuidv4();
  const comment = event.comment;
  const issue = event.issue;
  const repository = event.repository;
  Log.info(`Design action comment body: ${comment.body}`);
  let comments = await gh.getCommentHistory(repository, issue.number);
  comments = comments.filter(historyFilter);
  const commentBodyUrls = utils.extractUrls(comment.body);
  const issueBodyUrls = utils.extractUrls(issue.body || "");
  const urls = [...commentBodyUrls, ...issueBodyUrls];

  let fileBody: utils.FileContent;

  const pmpt = [];
  if (urls.length > 0) {
    Log.info("Multiple github urls found, getting first");
    const fileBody = await utils.getFileFromUrl(urls[0].url);
    if (fileBody) {
      pmpt.push(fileBody.focus ? fileBody.focus : fileBody.body);
    }
    pmpt.push("The above file can provide some context for the following");
  }

  const res = await callChat(
    id,
    pmpt.join("\n"),
    comments,
    [],
    ChatType.Design
  );

  await gh.postIssueComment(event.repository, event.issue, res);
}
