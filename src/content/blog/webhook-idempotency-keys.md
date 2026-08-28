---
title: "Idempotency Keys: How to Handle Webhook Retries Safely"
description: "Understand the concept of idempotency and learn how to prevent double-charging customers when webhooks are retried or fail unexpectedly."
pubDate: 2026-08-28
author: "Sudarshan Chavan"
tags: ["architecture", "webhooks", "idempotency", "development"]
---

Handling webhooks seems simple at first: an event happens, your server receives a POST request, and you update your database. 

But what happens when things go wrong?

Imagine your server receives a "Payment Successful" webhook from Stripe. Your code connects to your database to upgrade the user to the Pro tier, but right at that exact millisecond, your database crashes.

Your server returns an HTTP 500 error to Stripe.

Stripe says, "Uh oh, their server failed. I will try sending this webhook again in 1 hour."

An hour later, your database is back up. Stripe sends the webhook again. Your server upgrades the user, and returns a 200 OK. Everything is fine, right?

**Wrong.** What if the database didn't crash during the *write*, but crashed right *after* the write, before the HTTP response was sent? The user was already upgraded. When the retry happens, your code might try to upgrade them *again*, or give them double the credits!

To solve this, we use **Idempotency**.

## What is Idempotency?

In mathematics and computer science, an operation is **idempotent** if applying it multiple times produces the same result as applying it just once.

*   `x = 5` is idempotent. No matter how many times you run it, `x` will always be 5.
*   `x = x + 1` is **not** idempotent. Running it twice gives a different result than running it once.

When dealing with webhooks, your webhook handler *must* be idempotent. If Stripe sends you the exact same webhook 5 times, your system state should only change once.

## How to Implement Idempotency

Most major webhook providers include a unique identifier in the payload of every event. 
For example, Stripe provides an `id` field for every event (e.g., `evt_1MoX...`).

This `id` is your **Idempotency Key**.

To make your webhook handler idempotent, follow this pattern:

1.  **Extract the Event ID:** When you receive the webhook, grab the unique event ID.
2.  **Check the Database:** Query your database to see if you have already processed this event ID.
3.  **Halt if Processed:** If the ID exists in your database, immediately return a `200 OK`. Do **not** process the logic again.
4.  **Process and Save:** If the ID does not exist, perform your business logic (e.g., upgrading the user), and then save the event ID to your database to mark it as processed.

### Example in SQL/Node.js

```javascript
app.post('/webhook', async (req, res) => {
  const eventId = req.body.id; // e.g., evt_12345

  // 1. Check if we already processed this
  const existingEvent = await db.query('SELECT * FROM processed_webhooks WHERE id = ?', [eventId]);
  
  if (existingEvent.length > 0) {
    // We already handled this! Just tell Stripe we got it.
    console.log('Skipping duplicate webhook.');
    return res.status(200).send('Already processed');
  }

  // 2. Perform business logic
  await upgradeUser(req.body.data.object.customer_email);

  // 3. Save the event ID so we never process it again
  await db.query('INSERT INTO processed_webhooks (id) VALUES (?)', [eventId]);

  res.status(200).send('Success');
});
```

*(Note: In a high-concurrency production environment, you should use database transactions or unique constraints to prevent race conditions during step 1 and 3.)*

## Summary

Never assume a webhook will only be sent once. Network timeouts, server crashes, and provider retries guarantee that you *will* eventually receive duplicate webhooks. 

By tracking processed event IDs in your database, you can make your webhook handlers safely idempotent, ensuring your users are never double-charged and your data remains perfectly consistent.
