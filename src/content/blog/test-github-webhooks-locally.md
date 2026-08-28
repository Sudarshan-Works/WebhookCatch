---
title: "How to Test GitHub Webhooks Locally Without Exposing Your API"
description: "Learn how to capture and inspect GitHub repository webhooks on your local machine using a free webhook testing tool."
pubDate: 2026-08-28
author: "Sudarshan Chavan"
tags: ["github", "webhooks", "testing", "development"]
---

Whether you are building a custom CI/CD pipeline, a Discord bot that announces new pull requests, or an automated code review tool, you will need to use **GitHub Webhooks**.

When an event occurs in your GitHub repository—like a user opening an issue, pushing code, or starring the repo—GitHub can send an HTTP POST request to a server of your choice.

However, when you are actively writing the code to handle these events, your server is running on `localhost`. GitHub cannot reach your laptop over the internet. 

In this tutorial, we will show you how to capture GitHub webhook payloads and test them against your local code without needing complex tools like ngrok.

## Step 1: Create a Public Endpoint

Instead of trying to expose your local machine to the internet, we will use a temporary, public URL specifically designed to catch webhook payloads.

1. Go to [WebhookCatch.com](https://webhookcatch.com)
2. Click **Create Webhook URL**
3. Copy the unique URL generated for you (e.g., `https://webhookcatch.com/w/your-unique-id`)

Keep this dashboard open in a tab. This is where your GitHub events will appear in real-time.

## Step 2: Configure the GitHub Webhook

Now we need to tell your GitHub repository to send events to our new URL.

1. Navigate to your repository on GitHub.
2. Click the **Settings** tab.
3. In the left sidebar, click **Webhooks**.
4. Click the **Add webhook** button (you may be prompted to enter your password).
5. In the **Payload URL** field, paste your WebhookCatch URL.
6. Change the **Content type** to `application/json` (this is much easier to work with than form data).
7. Under "Which events would you like to trigger this webhook?", select **Send me everything** for testing purposes.
8. Click **Add webhook**.

*Note: As soon as you click Add, GitHub sends a `ping` event to verify the URL works.*

## Step 3: Trigger an Event

Let's generate a real event. 

Go to your repository and **Star** it, or open a new **Issue**. 

## Step 4: Inspect the Payload

Switch back to your WebhookCatch dashboard. You will see a new POST request appear on the left sidebar!

Click on it to inspect the payload. GitHub webhooks are notoriously massive. A simple "issue opened" event might send 200+ lines of JSON containing information about the issue, the repository, and the user who triggered it.

It will look something like this:

```json
{
  "action": "opened",
  "issue": {
    "url": "https://api.github.com/repos/Codertocat/Hello-World/issues/1",
    "title": "Spelling error in the README file",
    "user": {
      "login": "Codertocat",
      "id": 21031067
    },
    "state": "open"
  },
  "repository": {
    "name": "Hello-World",
    "full_name": "Codertocat/Hello-World"
  }
}
```

## Step 5: Write Your Local Code

Now that you know exactly what the GitHub payload looks like, you can write the code to handle it on your local machine.

Simply copy the JSON from WebhookCatch, open your terminal, and use `cURL` (or Postman) to send that exact payload directly to your `localhost` server.

```bash
curl -X POST http://localhost:3000/api/github-webhook \
-H "Content-Type: application/json" \
-H "X-GitHub-Event: issues" \
-d '{ "action": "opened", "issue": { ... } }'
```

> **Important:** Notice the `X-GitHub-Event` header! GitHub uses headers to tell your server what type of event was sent. Be sure to include this in your local tests.

This method completely bypasses the need for internet tunneling. You can test your local database logic, fix bugs, and iterate rapidly. 

Once your code is perfect, deploy it to production and swap the Webhook URL in GitHub to your real production server!

> **Security Note:** In production, always define a **Secret** in your GitHub webhook settings and verify the `X-Hub-Signature-256` header to ensure the webhook genuinely came from GitHub!
