import { Octokit } from "@octokit/rest";
import Config from "./config";
import Log from "./log";
import * as oct from "@octokit/webhooks-types";

const octokit = new Octokit({ auth: Config.githubApiToken });
export default octokit;

export class GitHubPullRequestService {
  repoOwner: string;
  repoName: string;
  octokit: Octokit;

  constructor(repoOwner: string, repoName: string) {
    this.repoOwner = repoOwner;
    this.repoName = repoName;
    this.octokit = new Octokit({ auth: Config.githubApiToken });
  }

  async getChangedFiles(pullRequest: oct.PullRequest): Promise<string[]> {
    const response = await this.octokit.rest.pulls.listFiles({
      owner: this.repoOwner,
      repo: this.repoName,
      pull_number: pullRequest.number,
    });

    return response.data.map((file) => file.filename);
  }

  async commitChanges(
    pullRequest: oct.PullRequest,
    message: string,
    files: { path: string; content: string }[]
  ): Promise<void> {
    // Implement committing changes to the repository
  }
}

// ... rest of the existing code