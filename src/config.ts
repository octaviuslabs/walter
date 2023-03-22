import dotenv from "dotenv";

dotenv.config();

export default {
  githubApiToken: process.env.GITHUB_API_TOKEN || "",
  githubWebhookSecret: process.env.GITHUB_WEBHOOK_SECRET || "",
  openApiKey: process.env.OPENAI_API_KEY || "",
  githubBotName: process.env.GITHUB_USERNAME,
  supportedRepos: (process.env.SUPPORTED_REPOS || "").split(","), // "octaviuslabs/walter,foo/bar"
  supportedUsers: (process.env.SUPPORTED_USERS || "").split(","), // "jsfour,AdaLovelace"
  saveInteractions: process.env.SAVE_INTERACTIONS == "true",
  botTaskLabel: "walter-build",
};
