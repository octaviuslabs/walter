import dotenv from "dotenv";

dotenv.config();

export default {
  githubApiToken: process.env.GITHUB_API_TOKEN || "",
  githubWebhookSecret: process.env.GITHUB_WEBHOOK_SECRET || "",
  openApiKey: process.env.OPENAI_API_KEY || "",
  githubBotName: "imwalterbot",
};
