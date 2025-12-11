const cron = require('node-cron');
const { keepThreadAlive } = require('../utils/keepThreadAlive');

const startKeepAliveCron = (client, prisma) => {
  // Run every 12 hours (at 00:00 and 12:00)
  cron.schedule('0 0,12 * * *', async () => {
    console.log('🕐 Starting scheduled keep-alive process...');

    try {
      // Get all active keep-alive threads - MINIMAL DATA ONLY
      const keepAliveThreads = await prisma.keepAliveThread.findMany({
        where: {
          isActive: true
        },
        select: {
          id: true,
          thread: {
            select: {
              threadId: true,
              name: true
            }
          }
        }
      });

      console.log(`📋 Found ${keepAliveThreads.length} threads to keep alive`);

      let successCount = 0;
      let failureCount = 0;
      const updatedIds = [];

      // Process in small batches with breaks
      const BATCH_SIZE = 5;  // Small batches to avoid rate limits
      const DELAY_BETWEEN_THREADS = 3000;  // 3 seconds to respect Discord rate limits
      const DELAY_BETWEEN_BATCHES = 10000; // 10 seconds break between batches

      for (let i = 0; i < keepAliveThreads.length; i += BATCH_SIZE) {
        const batch = keepAliveThreads.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(keepAliveThreads.length / BATCH_SIZE);
        
        console.log(`📦 Processing batch ${batchNum}/${totalBatches}`);

        for (const keepAliveThread of batch) {
          const threadId = keepAliveThread.thread.threadId;
          
          console.log(`🔄 [${batchNum}/${totalBatches}] Processing: ${keepAliveThread.thread.name}`);
          
          try {
            const success = await keepThreadAlive(client, threadId);
            
            if (success) {
              successCount++;
              updatedIds.push(keepAliveThread.id);
            } else {
              failureCount++;
            }
          } catch (err) {
            console.error(`❌ Error processing thread ${threadId}:`, err.message);
            failureCount++;
          }

          // Wait between threads to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_THREADS));
        }

        // BATCH UPDATE DATABASE - Single query instead of many
        if (updatedIds.length > 0) {
          await prisma.keepAliveThread.updateMany({
            where: {
              id: { in: updatedIds }
            },
            data: {
              updatedAt: new Date()
            }
          });
          console.log(`💾 Batch updated ${updatedIds.length} threads in database`);
          updatedIds.length = 0; // Clear array
        }

        // Give CPU and Discord API a break between batches
        if (i + BATCH_SIZE < keepAliveThreads.length) {
          console.log(`⏸️  Cooling down for 10 seconds...`);
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
        }
      }

      console.log(`✅ Keep-alive completed: ${successCount} success, ${failureCount} failures`);
      
    } catch (err) {
      console.error('❌ Critical error in keep-alive cron:', err);
    }
  });

  console.log('⏰ Keep-alive cron job scheduled (every 12 hours)');
};

module.exports = { startKeepAliveCron };