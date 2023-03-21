import { Octokit } from "@octokit/rest";
import Config from "./config";
import Log from "./log";
import * as oct from "@octokit/webhooks-types";

const octokit = new Octokit({ auth: Config.githubApiToken });
export default octokit;

export class GitHubService {
  octokit: Octokit;

  constructor(githubToken?: string) {
    githubToken = githubToken || Config.githubApiToken;
    this.octokit = new Octokit({ auth: githubToken });
  }

  async getChangedFiles(pullRequest: oct.PullRequest): Promise<string[]> {
    const response = await this.octokit.rest.pulls.listFiles({
      owner: pullRequest.head.repo.owner.login,
      repo: pullRequest.head.repo.name,
      pull_number: pullRequest.number,
    });

    return response.data.map((file) => file.filename);
  }

  async commitChanges(pullRequest: oct.PullRequest) {
    // Commit the changes to the repository
  }
}

// ... rest of the existing code