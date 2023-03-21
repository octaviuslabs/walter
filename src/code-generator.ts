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
import log from "./log";
import * as gh from "./gh";

const SAVE_INTERACTION = true;

const dmp = new DMP.diff_match_patch();

export enum ChatType {
  Code,
  Diff,
  Design,
}

const systemMessages: Map<ChatType, string> = new Map();
systemMessages.set(
  ChatType.Diff,
  fs.readFileSync(
    path.join(__dirname, "system-messages", "diff-generator.md"),
    "utf8"
  )
);

systemMessages.set(
  ChatType.Code,
  fs.readFileSync(
    path.join(__dirname, "system-messages", "code-generator.md"),
    "utf8"
  )
);

systemMessages.set(
  ChatType.Design,
  fs.readFileSync(
    path.join(__dirname, "system-messages", "design-assistant.md"),
    "utf8"
  )
);

export async function callChat(
  requestId: string,
  pmpt: string,
  hist: gh.Message[],
  dependencies: string[], //DEPENDENCIES
  chatType: ChatType = ChatType.Code
): Promise<string> {
  const t0 = Date.now();
  log.info(`Sending request to chat`);
  //console.log("sending request to chat with prompt");
  //console.log(pmpt);
  //
  hist = hist.map((msg) => {
    return {
      ...msg,
      user: undefined,
    };
  });
  const depsMsgs = dependencies.map((dep) => {
    return {
      role: "user" as any,
      content: dep,
    };
  });
  const systemMsg = systemMessages.get(chatType);
  if (!systemMsg) {
    throw "System message not found";
  }

  const messages = [
    {
      role: "system",
      content: systemMsg,
    },
    ...depsMsgs,
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
  log.info(`ai response timing ${Date.now() - t0} ms`);
  const out = res.data.choices[0].message?.content;
  await saveInteraction(requestId, hist, pmpt, out || "");

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
  log.info(`Saving File ${fn}`);
  fs.writeFileSync(fn, content);
};

const saveInteraction = async function (
  requestId: string,
  hist: gh.Message[],
  pmpt: string,
  response: string
): Promise<void> {
  if (!Config.saveInteractions) {
    return;
  }
  let content = [
    "# History",
    hist.map((hist) => {
      return hist.role + "::" + "\n" + hist.content;
    }),
    "# Prompt",
    pmpt,
    "# Response",
    response,
  ];
  await saveFile(
    requestId,
    `${Date.now()}-interaction.md`,
    content.join("\n\n")
  );
  return;
};

export function extractCodeFromResponse(res: string): string[] {
  log.info("extracting code from message");
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
  log.info(patch);
  const [res, status] = dmp.patch_apply(patch, original);
  log.info(status);

  return res;
};

export const mergeDiffWDiffLib = function (
  original: string,
  diff: string
): string {
  const patches = Diff.parsePatch(diff);
  log.info(patches);
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
  log.info(`calling edit with ${pmpt}`);
  log.info(`input ${myInput}`);
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
  job: je.ExecutionJob,
  chatHistory: gh.Message[]
): Promise<CodeEdit> {
  log.info(`Creating edit`);
  chatHistory = chatHistory || [];
  //const deps = await getCachedDeps(job.target);
  //log.info(`Got deps`);
  let action = [];
  let deps: string[] = [];
  if (job.targets.length == 1) {
    // TODO: only grab first file
    const fileContent = await utils.getFileFromUrl(job.targets[0]);

    const fileBody = fileContent.body;
    //action.push("-- DEPENDENCIES --");
    //action.push(deps.toString());
    //action.push("-- END DEPENDENCIES --");
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

    const res = await callChat(
      job.id,
      action.join("\n"),
      chatHistory,
      deps,
      ChatType.Code
    );
    const cleanRes = extractCodeFromResponse(res);
    if (cleanRes.length == 0) {
      throw "No code returned from chat";
    }

    log.info(`Found ${cleanRes.length} code blocks`);

    const body = cleanRes[0];

    return {
      fileContent,
      job,
      body,
    };
  } else {
    throw "You must target at least one file";
  }
}

export async function createEdit(job: je.ExecutionJob): Promise<CodeEdit> {
  const fileContent = await utils.getFileFromUrl(job.targets[0]);
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
