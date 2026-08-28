---
title: "Webhook Security 101: How to Verify HMAC Signatures"
description: "A deep dive into webhook security. Learn how to protect your server from spoofing and replay attacks by validating cryptographic HMAC signatures."
pubDate: 2026-08-28
author: "Sudarshan Chavan"
tags: ["security", "webhooks", "development", "hmac"]
---

Webhooks are fundamentally just open HTTP POST endpoints sitting on your server. If you build an endpoint to receive a "Payment Successful" webhook from Stripe, and you don't secure it, **anyone on the internet can send a fake POST request to your server and mark their account as paid.**

In this guide, we will cover the three golden rules of webhook security.

## 1. Always Use HTTPS

This is non-negotiable. If your webhook endpoint uses `http://` instead of `https://`, the JSON payload (which may contain sensitive customer data) is sent over the internet in plain text. 

Always ensure your webhook endpoints are secured with a valid SSL/TLS certificate. Services like Stripe and GitHub will actually refuse to send webhooks to non-HTTPS endpoints.

## 2. Verify Cryptographic Signatures (HMAC)

To prevent hackers from spoofing requests, almost all major webhook providers (Stripe, GitHub, Shopify, Twilio) use a cryptographic signature.

When you configure your webhook, the provider gives you a **Secret Key**. 
When an event happens, the provider takes the JSON payload, encrypts it using your Secret Key, and attaches the resulting hash to a specific Header (e.g., `Stripe-Signature`).

When your server receives the webhook, it must:
1. Take the incoming raw JSON payload.
2. Encrypt it using the *same* Secret Key.
3. Compare your generated hash to the hash in the Header.

If they match, you know 100% that the webhook came from the provider, because only you and the provider know the Secret Key.

### Example: Verifying a Stripe Signature in Node.js

```javascript
const express = require('express');
const stripe = require('stripe')('sk_test_123');

const app = express();

// The secret key found in your Stripe Dashboard
const endpointSecret = 'whsec_...'; 

// You MUST use express.raw for webhooks. If you parse it as JSON first, 
// the stringified version might lose formatting and the hashes won't match!
app.post('/webhook', express.raw({type: 'application/json'}), (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Stripe's library handles the crypto math for you
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error("Signature verification failed!", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event securely!
  console.log('Verified Webhook Received:', event.type);
  res.send();
});
```

## 3. Prevent Replay Attacks

Imagine a hacker intercepts a *valid* webhook request containing a $100 refund. The cryptographic signature is valid. The hacker simply takes that exact request, and sends it to your server 50 times in a row. If you aren't careful, you might process 50 refunds!

This is called a **Replay Attack**.

To prevent this, signatures often include a timestamp. For example, Stripe's `Stripe-Signature` header looks like this:
`t=1492774577,v1=5257a869e7ecebea0d7b12e3630a5...`

The `t=` is the Unix timestamp of when the webhook was sent.

Your server should:
1. Extract the timestamp from the header.
2. Compare it to your server's current time.
3. If the timestamp is older than 5 minutes, **reject the webhook**.

This guarantees that even if a hacker intercepts a valid webhook, they only have a 5-minute window to replay it, drastically reducing the attack surface.

## Summary
Securing webhooks is critical. Never trust incoming data blindly. Always verify the signature, check the timestamp, and ensure you are using HTTPS. If you want to see exactly what headers and signatures your provider is sending, point them to [WebhookCatch.com](https://webhookcatch.com) to inspect the raw payloads!
