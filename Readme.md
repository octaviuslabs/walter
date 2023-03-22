<img src="https://user-images.githubusercontent.com/1569744/226808875-02ce6b84-2c04-48cc-9fe3-5c95c2dc6f2a.png" width="200" align="center" />

# WALTER - AI GitHub Code Bot

WALTER is an AI-powered software development assistant built right into GitHub so it can act as your junior developer. The bot helps you design and implement solutions using GitHub issues and pull requests.

## How It Works

The tool has been built based on the traditional junior dev <-> senior dev interaction where the senior developer uses GitHub links and high level description to point out changes that need to be made. The junior developer then proposes a solution in psudocode and once the solution is approved by the sr dev, the junior developer codes up the solution and opens a pull request.

In this case, WALTER is the junior developer and you are the senior developer!

## Workflow

1. Open an issue explaining what you need done on a repository that WALTER is attached to (feel free to self host if you want to target your own repo. Details on how to do this coming soon!)
2. Communicate with WALTER in issue comments using a `@botname` tag in the comment body [(see example here)](https://github.com/octaviuslabs/walter/issues/102#issuecomment-1478854200) to design a proposed solution to a problem. If you include a (one) link to a line or line range of code in GitHub, that code will be given to WALTER for context. *Note that any link after the first link will be ignored. See "Limitations" for details.
3. Approve the design via a @botname APPROVED LINK_TO_FILE. The `LINK_TO_FILE` is a link to a GitHub file that you would like to apply changes to.
4. WALTER will write the code for the changes (thanks GPT-4) and create a pull request against the repository based on the conversation and design.

 WALTER is building it's self so take a look at the issues to see examples of how the above workflow works.

## Use Cases
- Quickly add additional logic to functions directly: https://github.com/octaviuslabs/walter/issues/102
- Plan and execute pieces of complex ideas: https://github.com/octaviuslabs/walter/issues/95
- Quickly add documentation: https://github.com/octaviuslabs/walter/issues/78
- Any other ideas? Open an issue and lets try them!

## Getting Started

WALTER is currently hard coded to my (@jsfour) username so you wont be able to trigger the chat --I dont want to chew through all of my OpenAI credits.

That doesnt mean you can't submit a task for something you think WALTER should do though!

To submit a task, write it up in the issues. We (you I and @imwalterbot) will work together to implement the change that you are hoping to see. I have no idea how this is going to go but lets see.

## Limitations
- Only supports Typescript currently (sorry Rust fans). We will be adding other languages soon!
- Currently WALTER is only capable of editing one file at a time. Additionally only one file can be provided as context. We (WALTER and @jsfour) are actively working on pulling in broader dependencies but the ~8k token limit on the model is making that dificult. We have some [ideas](https://github.com/octaviuslabs/walter/issues/74) but this is still under development.
- WALTER can not create files (yet)
- Non issue comments (comments in pull requests for example) are ignored (for now)

## Bootstrapping WALTER

WALTER was designed and built using a combination of GPT-4, the GitHub API, and a typical senior developer/junior developer workflow. It leverages OpenAI's GPT-4 model for generating code and solutions, while the GitHub API enables seamless integration with your repository. The senior developer/junior developer workflow helps guide the AI in providing relevant and useful solutions based on user input.

## FAQ

### Q: Is WALTER just a wrapper around GPT-4?

Yes and no. WALTER uses OpenAI's GPT-4 model to generate code and solutions, but it's a mashup of the GPT-4 API, the GitHub API, and the typical senior developer/junior developer workflow. This combination allows WALTER to provide a more comprehensive and streamlined development experience.

### Q: Can WALTER work with other programming languages besides TypeScript?

Currently, WALTER is designed to work with TypeScript. However, we are actively working on expanding support for other programming languages in the future.

### Q: Can I run WALTER on my own repo?

Yes, you can run WALTER on your own repository using the provided Dockerfile. More instructions on building and hosting WALTER yourself will be provided soon. This will allow you to have a fully customized AI development assistant for your specific projects.

### Q: How is WALTER bootstrapped? Was it designed and built primarily by GPT-4?

WALTER is bootstrapped using a combination of GPT-4, the GitHub API, and a typical senior developer/junior developer workflow. This combination allows WALTER to provide relevant and useful solutions based on user input, while also integrating seamlessly with your GitHub repository.

### Q: How can I contribute to WALTER's development?

We welcome contributions to WALTER! Just open up an issue (or pull request).

### Q: How does WALTER handle dependencies in the code?

We are currently working on the ability to include type dependencies in prompts and finding the minimal set of dependencies for a change. This will help WALTER better understand and work with your codebase.

### Q: Can WALTER create new files or edit multiple files at once?

We are actively working on adding support for multi-file edits, creating new files, and authoring new multi-file features based on user chat/specification.

### Q: Does WALTER provide any testing or security analysis features?

We are developing features for auto test generation, automated testing, and code security analysis. These features will allow WALTER to generate test cases based on changes made in pull requests, perform security checks, and suggest fixes to improve the overall security of your project.

### Q: Can WALTER generate or update documentation for my project?

Yes, WALTER is capable of generating and updating documentation for your project. It can automatically generate and update documentation based on the code changes, keeping your project's documentation up-to-date with the latest code. This feature helps maintain the quality and accuracy of your project's documentation, making it easier for other developers to understand and contribute to your project.

### Q: Did WALTER write these docs?

For the most part yes. See [this issue](https://github.com/octaviuslabs/walter/issues/105) and (this issue)[https://github.com/octaviuslabs/walter/issues/107]
