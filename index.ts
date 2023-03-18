webhooks.on("issue_comment.created", async (event: any) => {
  const comment = event.payload.comment;
  const issue = event.payload.issue;
  const repository = event.payload.repository;

  if (
    isBotTask(issue, repository.full_name, comment.user.name) &&
    comment.user.login != BOT_NAME
  ) {
    winston.log("info", "Processing comment", comment, "on", issue);
    const action: CommentAction = parseComment(comment);
    winston.log("info", "Parsed comment", action);

    try {
      if (action.type === "refine") {
        winston.log("info", "Action type: Refine");
        const hist: any = [];
        const jobs = parseCommentForJobs(action.body);
        winston.log("info", "jobs", jobs);

        if (jobs.length > 0) {
          const res = await Promise.all(jobs.map(createEditWithChat));
          await createNewPullRequest(res, repository, issue.number);
        }
        return;
      } else if (action.type === "approve") {
        winston.log("info", "Action type: Approve");
        winston.log("info", "approved");
        const hist = await utils.getCommentHistory(repository, issue.number);
        const previousDevMsgs = hist.filter((v) => {
          return v.role == "developer";
        });

        if (previousDevMsgs.length == 0) {
          throw "No previous dev messages";
        }

        const lastDevMsg = previousDevMsgs[previousDevMsgs.length - 1];

        await handleCodeGeneration(
          lastDevMsg.content,
          repository,
          Config.githubBotName
        );
        winston.log("info", "processing complete");
      } else if (action.type === "design") {
        winston.log("info", "Action type: Design");
        processDesignAction(action.body);
      }
    } catch (err) {
      winston.log("error", "ERROR", err);
    }
  } else {
    winston.log("info", "Ignoring comment");
  }
});