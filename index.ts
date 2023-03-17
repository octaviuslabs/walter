// Updated "issues.opened" handler to just log the issue without processing it
webhooks.on("issues.opened", async (event: any) => {
  console.log("new issue");
  const issue = event.payload.issue;
  console.log("Issue:", issue);
});