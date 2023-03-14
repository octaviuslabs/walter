import openai from "./openai";
import Config from "./config";
import { Octokit } from "@octokit/rest";

const octokit = new Octokit({ auth: Config });

export async function generatePseudocode(
  description: string,
  files: string[],
  lines: number[],
  repository: any
): Promise<string> {
  const fileContentsPromises = files.map((filePath) =>
    octokit.rest.repos.getContent({
      owner: repository.owner.login,
      repo: repository.name,
      path: filePath,
    })
  );

  const fileContentsResponses = await Promise.all(fileContentsPromises);
  const fileContents = fileContentsResponses.map((response: any) =>
    Buffer.from(response.data.content, "base64").toString()
  );

  const prompt = `Generate pseudocode for the following task:\n\n${description}\n\nRelevant files and lines:\n`;
  const fileLinesText = files
    .map(
      (file, index) => `${file}: line ${lines[index]}\n${fileContents[index]}`
    )
    .join("\n\n");

  const openaiResponse = await openai.createCompletion({
    model: "davinci-codex",
    prompt: prompt + fileLinesText,
    max_tokens: 200,
    n: 1,
    stop: null,
    temperature: 0.7,
  });

  return openaiResponse.data.choices[0].text || "";
}

export async function postComment(
  repository: any,
  issue: any,
  commentBody: string
): Promise<void> {
  await octokit.rest.issues.createComment({
    owner: repository.owner.login,
    repo: repository.name,
    issue_number: issue.number,
    body: commentBody,
  });
}
