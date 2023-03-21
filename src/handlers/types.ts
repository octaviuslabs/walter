import * as oct from "@octokit/webhooks-types";

export type ProcessableComment =
  | oct.IssueComment
  | oct.PullRequestReviewComment;

export type CommentAction =
  | { type: "unknown" }
  | { type: "refine"; body: string; files?: string[]; lines?: number[] }
  | { type: "approve"; body: string; files?: string[]; lines?: number[] }
  | { type: "design"; body: string }
  | { type: "status"; body: string };

export interface ParseableComment {
  body: string;
  user: { login: string };
}
