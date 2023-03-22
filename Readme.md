# WALTER - AI-Powered Software Development Assistant

WALTER is an AI-powered software development assistant that helps you design and implement solutions using GitHub issues and pull requests. It supports TypeScript and streamlines the development process by allowing you to communicate with the AI via issue comments.

## Use Cases
- Quickly add additional logic to functions directly: https://github.com/octaviuslabs/walter/issues/102
- Plan and execute pieces of complex ideas: https://github.com/octaviuslabs/walter/issues/95
- Quickly add documentation: https://github.com/octaviuslabs/walter/issues/78

## Workflow

1. Open an issue on a repository.
2. Communicate with WALTER in issue comments using the @botname command to design a solution to a problem. (see sample workflows below)
3. Approve the design via a @botnane APPROVED {LINK-TO-FILE}
4. WALTER creates a pull request against the repository based on the conversation and design.

## Core Ability Roadmap

- [X] Ability to communicate with bot to design solution based on GitHub link to file
- [X] Ability for the bot to create and submit pull request
- [ ] Ability to include type dependencies in prompts
- [ ] Find minimal set of dependencies for change
- [ ] Multi-file edits
- [ ] Create new files
- [ ] Author new multi-file features based on user chat/specification
- [ ] Auto Test Generation
- [ ] Find dependent files and update them as well
- [ ] Automated Testing: The bot can generate test cases based on the changes made in the pull request.
- [ ] Code Security Analysis: The bot can perform security checks on the code changes, identifying potential vulnerabilities and suggesting fixes to improve the overall security of the project.
- [X] Documentation Generation: The bot can automatically generate and update documentation

## Contributing

We welcome contributions to WALTER! Please check out the [CONTRIBUTING.md](CONTRIBUTING.md) file for guidelines on how to contribute to this project.
