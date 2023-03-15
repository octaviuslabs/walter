import openai from "./openai";
import octokit from "./gh";
import * as psg from "./psudocode-generator";

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
  const pmpt = `Translate the following pseudocode to TypeScript code:\n\n${pseudocode}`;

  const res = await openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content:
          "You are a software development assistant writing code for a pull request based on pseudocode provided.",
      },
      { role: "user", content: pmpt },
    ],
    n: 1,
    temperature: 0.7,
  });

  //const response = await openai.createCompletion({
  //model: "code-davinci-002",
  //prompt: pmpt,
  //max_tokens: 200,
  //n: 1,
  //stop: null,
  //temperature: 0.7,
  //});
  //
  if (res.data.choices[0].message?.content == undefined) {
    throw "No response";
  }

  return res.data.choices[0].message?.content;
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
  edits: psg.CodeEdit[]
): Promise<void> {
  const commitMessage = "Generated code by the GitHub bot";

  const files = edits.map((edit) => {
    let fileName = edit.fileContent.parsedUrl.filePath;
    if (fileName.charAt(0) == "/") fileName = fileName.substr(1); // Remove leading slash
    return {
      path: fileName,
      content: Buffer.from(edit.body).toString("base64"),
    };
  });

  console.log("creating file", files);

  const treeItems = files.map((file) => ({
    path: file.path,
    mode: "100644" as any,
    type: "blob" as any,
    content: Buffer.from(file.content, "base64").toString(),
  }));

  const myRef = await octokit.rest.git.getRef({
    owner: repository.owner.login,
    repo: repository.name,
    ref: `heads/${branch}`,
  });
  console.log("refs", myRef);

  console.log("createTree");
  const tree = await octokit.rest.git.createTree({
    owner: repository.owner.login,
    repo: repository.name,
    tree: treeItems,
    ref: myRef.data.object.sha,
    base_tree: myRef.data.object.sha,
  });
  console.log("tree", tree);

  console.log("createCommit");
  const commit = await octokit.rest.git.createCommit({
    owner: repository.owner.login,
    repo: repository.name,
    message: commitMessage,
    tree: tree.data.sha,
    parents: [myRef.data.object.sha],
  });

  console.log("commit", commit);

  console.log("updateRef");

  const refProps = {
    owner: repository.owner.login,
    repo: repository.name,
    ref: `heads/${branch}`,
    sha: commit.data.sha,
  };
  console.log(refProps);
  await octokit.rest.git.updateRef(refProps);
}

async function createPullRequest(
  repository: Repository,
  branch: string,
  issueNumber?: number
): Promise<any> {
  let prTitle = "Issue resolution";
  let prBody = `This PR contains AI generatd code.`;
  if (issueNumber) {
    prTitle = `Code generated to resolve ${issueNumber}`;
    prBody = `This PR contains AI generatd code for issue #${issueNumber}.`;
  }

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

export const createNewPullRequest = async (
  result: psg.CodeEdit[],
  repo: Repository,
  issueNumber?: number
) => {
  console.log("creating branch");
  const newBranch = await createBranch(repo);
  console.log("comitting");
  await commitCode(repo, newBranch, result);
  console.log("committed");

  await createPullRequest(repo, newBranch, issueNumber);
};

async function handleCodeGeneration(
  pseudocode: string,
  repository: Repository,
  user: string
): Promise<any> {
  const code = await generateCode(pseudocode, repository);

  const newBranch = await createBranch(repository);
  console.log("comitting");
  //await commitCode(repository, newBranch, code);
  console.log("committed");
  const pullRequest = await createPullRequest(repository, newBranch);
  console.log("pull request opened");
  console.log(pullRequest);

  return pullRequest;
}

export { handleCodeGeneration };
