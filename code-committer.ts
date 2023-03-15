import { Octokit } from "@octokit/rest";
import openai from "./openai";
import Config from "./config";

const octokit = new Octokit({ auth: Config.githubApiToken });

interface Repository {
  owner: {
    login: string;
  };
  name: string;
}

async function generateCode(
  pseudocode: string,
  repository: Repository
): Promise<string> {
  const response = await openai.createCompletion({
    model: "code-davinci-002",
    prompt: `Translate the following pseudocode to JavaScript code:\n\n${pseudocode}`,
    max_tokens: 200,
    n: 1,
    stop: null,
    temperature: 0.7,
  });

  return response.data.choices[0].text || "";
}

async function createBranch(repository: Repository): Promise<string> {
  const baseBranch = await octokit.rest.repos.getBranch({
    owner: repository.owner.login,
    repo: repository.name,
    branch: "main",
  });

  const newBranchName = `bot-generated-code-${Date.now()}`;

  await octokit.rest.git.createRef({
    owner: repository.owner.login,
    repo: repository.name,
    ref: `refs/heads/${newBranchName}`,
    sha: baseBranch.data.commit.sha,
  });

  return newBranchName;
}

async function commitCode(
  repository: Repository,
  branch: string,
  code: string
): Promise<void> {
  const commitMessage = "Generated code by the GitHub bot";

  const files = [
    {
      path: "generated-code.js",
      content: Buffer.from(code).toString("base64"),
    },
  ];

  const treeItems = files.map((file) => ({
    path: file.path,
    mode: "100644" as any,
    type: "blob" as any,
    content: Buffer.from(file.content, "base64").toString(),
  }));

  const tree = await octokit.rest.git.createTree({
    owner: repository.owner.login,
    repo: repository.name,
    tree: treeItems,
  });

  const commit = await octokit.rest.git.createCommit({
    owner: repository.owner.login,
    repo: repository.name,
    message: commitMessage,
    tree: tree.data.sha,
    parents: [branch],
  });

  await octokit.rest.git.updateRef({
    owner: repository.owner.login,
    repo: repository.name,
    ref: `heads/${branch}`,
    sha: commit.data.sha,
  });
}

async function createPullRequest(
  repository: Repository,
  branch: string,
  pseudocode: string,
  user: string
): Promise<any> {
  const prTitle = "Bot generated code";
  const prBody = `This PR contains the generated code based on the approved pseudocode:\n\n\`\`\`\n${pseudocode}\n\`\`\`\n\nPlease review and merge if everything looks good. @${user}`;

  const pr = await octokit.rest.pulls.create({
    owner: repository.owner.login,
    repo: repository.name,
    title: prTitle,
    head: branch,
    base: "main",
    body: prBody,
  });

  return pr.data;
}

async function handleCodeGeneration(
  pseudocode: string,
  repository: Repository,
  user: string
): Promise<any> {
  const code = await generateCode(pseudocode, repository);
  const newBranch = await createBranch(repository);
  await commitCode(repository, newBranch, code);
  const pullRequest = await createPullRequest(
    repository,
    newBranch,
    pseudocode,
    user
  );

  return pullRequest;
}

export { handleCodeGeneration };
