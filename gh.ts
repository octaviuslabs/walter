import { Octokit } from "@octokit/rest";
import Config from "./config";

export default new Octokit({ auth: Config.githubApiToken });
