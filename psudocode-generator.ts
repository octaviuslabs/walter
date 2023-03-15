import openai from "./openai";
import Config from "./config";
import { Octokit } from "@octokit/rest";

const octokit = new Octokit({ auth: Config.githubApiToken });

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

  let pmptArray = [];
  pmptArray.push(
    `Generate detailed instructions for a junior developer to execute for the following task:\n\n${description}`
  );
  if (files.length > 0) {
    pmptArray.push("\n\nRelevant files and lines:\n");
    const fileLinesText = files.map(
      (file, index) => `${file}: line ${lines[index]}\n${fileContents[index]}`
    );
    pmptArray = pmptArray.concat(fileLinesText);
  }
  const prompt = pmptArray.join("\n");

  console.log("sending request with prompt", prompt);
  const openaiResponse = await openai.createCompletion({
    model: "code-davinci-002",
    prompt,
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
  console.log("POSTING COMMENT", commentBody);
  await octokit.rest.issues.createComment({
    owner: repository.owner.login,
    repo: repository.name,
    issue_number: issue.number,
    body: commentBody,
  });
}
