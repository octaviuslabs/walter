import openai from "./openai";
import octokit from "./gh";
import * as utils from "./utils";
import * as je from "./job-interpreter";

export async function generatePseudocodeFromEmbedded(
  task: string,
  hist: utils.Message[]
): Promise<string> {
  let pmptArray = [];
  pmptArray.push(
    //`Write instructions on which files to change and what changes to make to accomplish the following task:\n\n${task}`
    task
  );

  const pmpt = pmptArray.join("\n");

  return callChat(pmpt, hist);
}

const dslInterpreterMsg = [
  "You are a software development assistant helping to interpret programming tasks to a domain specific language. You can only respond in this domain specific language with the code directly.",
  "Below is a sample program of in the domain specific language",
  "```",
  'in https://github.com/octaviuslabs/walter/blob/main/index.ts#L7: "load this from an environment variable"',
  'in https://github.com/octaviuslabs/walter/blob/main/main.ts#L7: "change the files read to work asyncrnously"',
  "```",
  'Where "in" is the keyword to indicate a new task. "https://github.com/octaviuslabs/walter/blob/main/index.ts#L7" is the target of a specific action to be taken. "load this from an environment variable" is the action that is taken.',
].join("\n");

async function callChat(pmpt: string, hist: utils.Message[]): Promise<string> {
  console.log("sending request to chat with prompt", pmpt);
  const messages = [
    {
      role: "system",
      content:
        //"You are a software development assistant helping to design step by step architecture using pseudocode for other developers to implement.",
        dslInterpreterMsg.toString(),
    },
    ...hist,
    { role: "user", content: pmpt },
  ];

  const res = await openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    messages,
    n: 1,
    temperature: 0.7,
  });

  const out = res.data.choices[0].message?.content;

  if (!out) {
    throw "No response from service";
  }

  return out;
}

export async function callEdit(pmpt: string, myInput: string): Promise<string> {
  console.log("calling edit with", pmpt);
  const res = await openai.createEdit({
    model: "code-davinci-edit-001",
    input: myInput,
    instruction: pmpt,
    n: 1,
    temperature: 0.7,
  });

  const out = res.data.choices[0].text;

  if (!out) {
    throw "No response from service";
  }

  return out;
}

export interface CodeEdit {
  fileContent: utils.FileContent;
  job: je.ExecutionJob;
  body: string;
}

export async function createEdit(job: je.ExecutionJob): Promise<CodeEdit> {
  const fileContent = await utils.getFileFromUrl(job.target);
  let action = [];
  // TODO: support end line
  if (fileContent.parsedUrl.startLine) {
    action.push(`On line ${fileContent.parsedUrl.startLine}.`);
  }

  if (fileContent.parsedUrl.endLine) {
    action.push(`To line ${fileContent.parsedUrl.endLine}.`);
  }

  action.push("Make the following changes.");
  action.push(job.action);

  const body = await callEdit(action.join(" "), fileContent.body);
  return {
    fileContent,
    job,
    body,
  };
}

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
    `Write instructions on which files to change and the pseudocode changes someone needs to submit as a pull request to accompish this task:\n\n${description}`
  );
  if (files.length > 0) {
    pmptArray.push("\n\nRelevant files and lines:\n");
    const fileLinesText = files.map(
      (file, index) => `${file}: line ${lines[index]}\n${fileContents[index]}`
    );
    pmptArray = pmptArray.concat(fileLinesText);
  }
  const pmpt = pmptArray.join("\n");

  return await callChat(pmpt, []);
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
