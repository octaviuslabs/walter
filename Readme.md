# WALTER - AI-Powered Software Development Assistant

WALTER is an AI-powered software development assistant that helps you design and implement solutions using GitHub issues and pull requests. It supports TypeScript and streamlines the development process by allowing you to communicate with the AI via issue comments.

## Workflow

1. Open an issue on a repository.
2. Communicate with WALTER using the `#GPT4` tag in issue comments to design a solution to a problem.
3. Approve the design.
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
- [ ] Automated Testing Integration: The bot can generate and run test cases based on the changes made in the pull request, ensuring that the new code doesn't break existing functionality.
- [ ] Code Security Analysis: The bot can perform security checks on the code changes, identifying potential vulnerabilities and suggesting fixes to improve the overall security of the project.
- [ ] Documentation Generation: The bot can automatically generate and update documentation based on the code changes, keeping the documentation up-to-date with the latest code.

## Contributing

We welcome contributions to WALTER! Please check out the [CONTRIBUTING.md](CONTRIBUTING.md) file for guidelines on how to contribute to this project.