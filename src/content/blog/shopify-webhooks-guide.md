---
title: "Shopify Webhooks: A Complete Guide for App Developers"
description: "Learn how to listen for Shopify store events like order creation and product updates using webhooks, and how to test them locally."
pubDate: 2026-08-28
author: "Sudarshan Chavan"
tags: ["shopify", "webhooks", "ecommerce", "tutorial"]
---

If you are building a custom Shopify App, managing inventory across multiple platforms, or integrating an ERP, you cannot rely on asking Shopify for data every 5 minutes (API Polling). You will hit strict API rate limits instantly.

Instead, Shopify requires you to use **Webhooks**.

Shopify webhooks allow your application to receive instant, real-time HTTP POST requests whenever something happens in a merchant's store—like a new order being placed, a customer updating their address, or a product going out of stock.

In this guide, we'll explain how to set up, secure, and test Shopify webhooks locally.

## Step 1: Subscribe to a Webhook Topic

Shopify groups webhooks into "Topics". For example, `orders/create`, `products/update`, or `customers/delete`.

You can subscribe to these topics in two ways:
1. **Via the Shopify Admin UI:** Good for custom apps built for a single store.
2. **Via the GraphQL/REST API:** Required for public apps on the Shopify App Store.

For testing, the UI is easiest:
1. Go to your Shopify Store Admin.
2. Navigate to **Settings > Notifications**.
3. Scroll all the way to the bottom to the **Webhooks** section.
4. Click **Create webhook**.
5. Select your Event (`Order creation`) and Format (`JSON`).
6. Paste your destination URL.

> **Wait, I don't have a destination URL yet because I'm on localhost!** 
> Keep reading to Step 2.

## Step 2: Testing Shopify Webhooks Locally

Shopify cannot send webhooks to `http://localhost:3000`. And while Shopify provides a CLI tool that uses Cloudflare tunnels, it can be heavy to configure just to inspect a payload.

The fastest way to test a Shopify webhook is to use a catcher:

1. Go to [WebhookCatch.com](https://webhookcatch.com) and click **Create Webhook URL**.
2. Copy the URL.
3. Paste that URL into the Shopify Admin webhook settings (from Step 1).
4. Click **Save**, and then click **Send test notification**.

Instantly, the Shopify payload will appear in your WebhookCatch dashboard. 

You can now copy the massive JSON payload representing a Shopify Order, save it to a `test-order.json` file on your laptop, and write your local code to parse it. You don't need a live internet tunnel while writing your database logic!

## Step 3: Securing Your Webhook

Because Shopify webhooks update critical business data (like marking an order as paid), you *must* verify that the webhook actually came from Shopify, and not a malicious hacker spoofing the payload.

Shopify secures its webhooks by including an `X-Shopify-Hmac-Sha256` header in every request. This is a cryptographic signature generated using your App's Client Secret.

Here is how you verify it in Node.js (Express):

```javascript
const express = require('express');
const crypto = require('crypto');
const app = express();

const SHOPIFY_SECRET = 'your_app_client_secret';

// IMPORTANT: You must read the raw body to verify the signature!
// Do not use express.json() before verifying.
app.post('/webhooks/shopify', express.raw({ type: 'application/json' }), (req, res) => {
  const hmacHeader = req.get('X-Shopify-Hmac-Sha256');
  const body = req.body; // Raw buffer

  const generatedHash = crypto
    .createHmac('sha256', SHOPIFY_SECRET)
    .update(body, 'utf8', 'hex')
    .digest('base64');

  if (generatedHash !== hmacHeader) {
    console.error('Webhook signature verification failed!');
    return res.status(401).send('Unauthorized');
  }

  console.log('Webhook verified successfully!');
  
  // Now you can parse the JSON and process the order
  const payload = JSON.parse(body.toString());
  
  res.status(200).send('Webhook processed');
});
```

## Step 4: Handle Retries and Idempotency

Shopify requires you to respond to webhooks with a `200 OK` status code within **5 seconds**.

If your app takes longer than 5 seconds (e.g., you are doing heavy database writes or PDF generation), Shopify will assume the request failed and will attempt to retry the webhook up to 19 times over the next 48 hours.

**Best Practice:** Do not process the webhook synchronously! 

Instead:
1. Verify the signature.
2. Save the webhook to a database table or a queue (like Redis or RabbitMQ).
3. Immediately return `200 OK` to Shopify.
4. Let a separate background worker process the queue at its own pace.

By following these patterns, you can build incredibly robust Shopify integrations that never miss a single order!
