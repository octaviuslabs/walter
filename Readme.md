![WALTER](https://user-images.githubusercontent.com/1569744/226808875-02ce6b84-2c04-48cc-9fe3-5c95c2dc6f2a.png)

# WALTER - An AI Junior Developer

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
- Currently WALTER is only capable of editing one file at a time. Additionally only one file can be provided as context. We (WALTER and @jsfour) are actively working on pulling in broader dependencies but the ~8k token limit on the model is making that dificult. We have some [ideas](https://github.com/octaviuslabs/walter/issues/74) but this is still under development.
- WALTER can not create files (yet)
- Non issue comments (comments in pull requests for example) are ignored (for now)

## Core Ability Roadmap

- [X] Ability to communicate with bot to design solution based on GitHub link to file
- [X] Ability for the bot to create and submit pull request
- [X] Documentation Generation: The bot can automatically generate and update documentation
- [ ] Ability to include type dependencies in prompts
- [ ] Find minimal set of dependencies for change
- [ ] Multi-file edits
- [ ] Create new files
- [ ] Author new multi-file features based on user chat/specification
- [ ] Auto Test Generation
- [ ] Find dependent files and update them as well
- [ ] Automated Testing: The bot can generate test cases based on the changes made in the pull request.
- [ ] Code Security Analysis: The bot can perform security checks on the code changes, identifying potential vulnerabilities and suggesting fixes to improve the overall security of the project.
