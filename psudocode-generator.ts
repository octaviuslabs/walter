import openai from "./openai";
import octokit from "./gh";
import * as utils from "./utils";
import * as je from "./job-interpreter";
import DMP from "diff-match-patch";
import fs from "fs";
import path from "path";
import * as Diff from "diff";
import { v4 as uuidv4 } from "uuid";
import Config from "./config";

const SAVE_INTERACTION = true;

const dmp = new DMP.diff_match_patch();

const systemMessages = {
  diffGenerator: fs.readFileSync(
    path.join(__dirname, "system-messages", "diff-generator.md"),
    "utf8"
  ),
  codeGenerator: fs.readFileSync(
    path.join(__dirname, "system-messages", "code-generator.md"),
    "utf8"
  ),
};

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

  return callChat(uuidv4(), pmpt, hist);
}

async function callChat(
  requestId: string,
  pmpt: string,
  hist: utils.Message[]
): Promise<string> {
  const t0 = Date.now();
  //console.log("sending request to chat with prompt");
  //console.log(pmpt);
  const messages = [
    {
      role: "system",
      content: systemMessages.codeGenerator,
    },
    ...hist,
    { role: "user", content: pmpt },
  ];

  const res = await openai.createChatCompletion({
    model: "gpt-4",
    messages,
    n: 1,
    temperature: 0.5,
    top_p: 1,
    max_tokens: 4000,
    user: "octavius_development_walter",
  });
  console.log("ai response timing", Date.now() - t0, "ms");
  const out = res.data.choices[0].message?.content;
  saveInteraction(requestId, pmpt, out || "");

  if (!out) {
    throw "No response from service";
  }

  return out;
}

const saveFile = async (
  requestId: string,
  fileName: string,
  content: string
) => {
  const dir = path.join(__dirname, ".interactions/", requestId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const fn = path.join(dir, fileName);
  console.log("saving", fn);
  fs.writeFileSync(fn, content);
};

const saveInteraction = async function (
  requestId: string,
  pmpt: string,
  response: string
): Promise<void> {
  if (!Config.saveInteractions) {
    return;
  }
  const content = `# Prompt\n\n${pmpt}\n\n# Response\n\n${response}`;
  await saveFile(requestId, `${Date.now()}-interaction.md`, content);
  return;
};

export function extractCodeFromResponse(res: string): string[] {
  console.log("extracting code from message");
  const diffCodeBlockRegex = /```(?:\w+\n)?([\s\S]*?)```/g;
  const codeBlocks: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = diffCodeBlockRegex.exec(res)) !== null) {
    if (match[1]) {
      codeBlocks.push(match[1].trim());
    }
  }

  return codeBlocks;
}

function removeFileHeaders(diff: string): string {
  const lines = diff.split("\n");
  const fileHeaderRegex = /^(-{3}|\+{3})\s/;

  const filteredLines = lines.filter((line) => !fileHeaderRegex.test(line));

  return filteredLines.join("\n");
}

export const mergeDiff = (original: string, diff: string): string => {
  return mergeDiffWDmp(original, diff);
};

export const mergeDiffWDmp = (original: string, diff: string): string => {
  diff = removeFileHeaders(diff);
  const patch = dmp.patch_fromText(diff);
  console.log(patch);
  const [res, status] = dmp.patch_apply(patch, original);
  console.log(status);

  return res;
};

export const mergeDiffWDiffLib = function (
  original: string,
  diff: string
): string {
  const patches = Diff.parsePatch(diff);
  console.log(patches);
  let patchedContent = original;
  const res = Diff.applyPatch(original, patches[0]);
  if (res) {
    return res;
  }

  throw new Error("Failed to apply patch");

  // Apply each patch in the list of patches
  //for (const patch of patches) {
  //const result = Diff.applyPatch(patchedContent, patch);

  //// Check if the patch was applied successfully
  //if (typeof result === "boolean" && result === false) {
  //throw new Error("Failed to apply patch");
  //} else {
  //patchedContent = result as string;
  //}
  //}

  //return patchedContent;
};

export async function callEdit(pmpt: string, myInput: string): Promise<string> {
  console.log("calling edit with", pmpt);
  console.log("input", myInput);
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

function applyFileHeader(fileContent: utils.FileContent): string {
  const fileHeader = "// " + fileContent.parsedUrl.filePath;
  const firstLine = fileContent.body.split("\n")[0];
  if (firstLine != fileHeader) {
    return fileHeader + "\n" + fileContent.body;
  }
  return fileContent.body;
}

export async function createEditWithChat(
  job: je.ExecutionJob
): Promise<CodeEdit> {
  const fileContent = await utils.getFileFromUrl(job.target);
  let action = [];
  const fileBody = fileContent.body;
  action.push(fileBody);

  let linesTxt = [];
  if (fileContent.parsedUrl.startLine) {
    linesTxt.push(`On line ${fileContent.parsedUrl.startLine}.`);
  }

  if (fileContent.parsedUrl.endLine) {
    linesTxt.push(`To line ${fileContent.parsedUrl.endLine}.`);
  }

  if (linesTxt.length != 0) {
    action.push(linesTxt.join(" "));
  }

  action.push(
    `Make the following changes to the above file named '${fileContent.parsedUrl.filePath}':`
  );
  action.push("- " + job.action);

  const res = await callChat(job.id, action.join("\n"), []);
  const cleanRes = extractCodeFromResponse(res);
  if (cleanRes.length == 0) {
    throw "No code returned from chat";
  }

  console.log(`Found ${cleanRes.length} code blocks`);

  const body = cleanRes[0];
  await saveFile(job.id, "mergedFile.md", body);

  return {
    fileContent,
    job,
    body,
  };
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

  action.push("Make the following changes to the codebase.");
  action.push(job.action);

  let body = await callEdit(action.join(" "), fileContent.body);
  const merged = mergeDiff(fileContent.body, body);
  if (!merged) {
    throw "there was an error applying the diff";
  }

  return {
    fileContent,
    job,
    body: merged,
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

  return await callChat(uuidv4(), pmpt, []);
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
