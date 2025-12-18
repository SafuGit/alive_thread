const cron = require("node-cron");
const { keepThreadAlive } = require("../utils/keepThreadAlive");

// Cursor persistence keys
const CURSOR_ID = "keepAliveCursor";

let isRunning = false;
let abortRequested = false;

/**
 * Run the keep-alive job using a DB-backed cursor so runs can resume after restart.
 * This uses cursor-based pagination on KeepAliveThread and persists the last processed
 * KeepAliveThread.id into KeepAliveCursor.id = CURSOR_ID.
 */
const runKeepAliveNow = async (client, prisma, opts = {}) => {
  if (isRunning) {
    console.log("⚠️ Keep-alive already running, skipping concurrent run");
    return { skipped: true };
  }

  isRunning = true;
  abortRequested = false;

  console.log("🕐 Starting keep-alive process (resumable)...");

  const BATCH_SIZE = opts.batchSize || 5;
  const DELAY_BETWEEN_THREADS = opts.delayBetweenThreads || 3000;
  const DELAY_BETWEEN_BATCHES = opts.delayBetweenBatches || 10000;

  try {
    // Get the last cursor (may be null)
    const cursorRow = await prisma.keepAliveCursor.findUnique({ where: { id: CURSOR_ID } });
    let lastId = cursorRow ? cursorRow.lastKeepAliveThreadId : null;

    let totalProcessed = 0;
    let successCount = 0;
    let failureCount = 0;

    while (!abortRequested) {
      // Build pagination args: if lastId exists, use cursor + skip to move past it
      const pagination = lastId
        ? { cursor: { id: lastId }, skip: 1, take: BATCH_SIZE }
        : { take: BATCH_SIZE };

      const batch = await prisma.keepAliveThread.findMany({
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          thread: { select: { threadId: true, name: true } },
        },
        ...pagination,
      });

      if (!batch || batch.length === 0) break; // no more work

      // Process the batch
      for (const keepAliveThread of batch) {
        if (abortRequested) break;

        const threadId = keepAliveThread.thread.threadId;

        console.log(`🔄 Processing: ${keepAliveThread.thread.name} (id=${keepAliveThread.id})`);

        try {
          const success = await keepThreadAlive(client, threadId);
          if (success) {
            successCount++;
          } else {
            failureCount++;
          }
        } catch (err) {
          console.error(`❌ Error processing thread ${threadId}:`, err || err.message);
          failureCount++;
        }

        totalProcessed++;

        // Respect rate limits
        await new Promise((r) => setTimeout(r, DELAY_BETWEEN_THREADS));
      }

      // Persist cursor at the end of the batch (use last processed KeepAliveThread.id)
      const lastProcessed = batch[batch.length - 1];
      if (lastProcessed) {
        await prisma.keepAliveCursor.upsert({
          where: { id: CURSOR_ID },
          update: { lastKeepAliveThreadId: lastProcessed.id },
          create: { id: CURSOR_ID, lastKeepAliveThreadId: lastProcessed.id },
        });
        lastId = lastProcessed.id;
      }

      // Pause between batches
      if (batch.length === BATCH_SIZE && !abortRequested) {
        await new Promise((r) => setTimeout(r, DELAY_BETWEEN_BATCHES));
        continue; // fetch next batch
      }

      break; // finished
    }

    console.log(`✅ Keep-alive finished (processed ${totalProcessed}): ${successCount} success, ${failureCount} failures`);
    return { successCount, failureCount, processed: totalProcessed };
  } catch (err) {
    console.error("❌ Critical error in keep-alive run:", err);
    throw err;
  } finally {
    isRunning = false;
  }
};

const requestAbortKeepAlive = () => {
  abortRequested = true;
};

const waitForKeepAliveStop = async (timeoutMs = 15000) => {
  const start = Date.now();
  while (isRunning && Date.now() - start < timeoutMs) {
    // small sleep
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 250));
  }
  return !isRunning;
};

const startKeepAliveCron = (client, prisma) => {
  // Run every 12 hours (at 00:00 and 12:00)
  cron.schedule("0 0,12 * * *", async () => {
    try {
      await runKeepAliveNow(client, prisma);
    } catch (err) {
      console.error("Error running scheduled keep-alive:", err);
    }
  });

  console.log("⏰ Keep-alive cron job scheduled (every 12 hours)");
};

module.exports = { startKeepAliveCron, runKeepAliveNow, requestAbortKeepAlive, waitForKeepAliveStop };
