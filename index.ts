```typescript
webhooks.on("issues.opened", async (event: any) => {
  console.log("new issue");
  const issue = event.payload.issue;
  const repository = event.payload.repository;

  // Just log the issue without processing it
  console.log("Issue:", issue);
});
```