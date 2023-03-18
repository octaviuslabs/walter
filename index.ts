const eventQueue: any[] = [];

async function processEvent(event: any) {
  // ... existing code
}

async function processNextEvent() {
  if (eventQueue.length > 0) {
    const event = eventQueue.shift();
    await processEvent(event);
    processNextEvent();
  }
}

webhooks.on("issue_comment.created", async (event: any) => {
  eventQueue.push(event);
  if (eventQueue.length === 1) {
    processNextEvent();
  }
});

// ... rest of the code