const cron = require('node-cron');
const { keepThreadAlive } = require('../utils/keepThreadAlive');

const startKeepAliveCron = (client, prisma) => {
  // Run every 12 hours (at 00:00 and 12:00)
  cron.schedule('0 0,12 * * *', async () => {
    console.log('🕐 Starting scheduled keep-alive process...');

    try {
      // Get all active keep-alive threads
      const keepAliveThreads = await prisma.keepAliveThread.findMany({
        where: {
          isActive: true
        },
        include: {
          thread: {
            include: {
              server: true
            }
          }
        }
      });

      console.log(`📋 Found ${keepAliveThreads.length} threads to keep alive`);

      let successCount = 0;
      let failureCount = 0;

      // Process each thread
      for (const keepAliveThread of keepAliveThreads) {
        const threadId = keepAliveThread.thread.threadId;
        
        console.log(`🔄 Processing thread: ${keepAliveThread.thread.name} (${threadId})`);
        
        const success = await keepThreadAlive(client, threadId);
        
        if (success) {
          successCount++;
          // Update last keep-alive timestamp
          await prisma.keepAliveThread.update({
            where: { id: keepAliveThread.id },
            data: { updatedAt: new Date() }
          });
        } else {
          failureCount++;
          // Optionally mark as inactive if thread is no longer accessible
          // await prisma.keepAliveThread.update({
          //   where: { id: keepAliveThread.id },
          //   data: { isActive: false }
          // });
        }

        // Add a small delay between threads to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(`✅ Keep-alive process completed: ${successCount} success, ${failureCount} failures`);
      
    } catch (err) {
      console.error('❌ Error in keep-alive cron job:', err);
    }
  });

  console.log('⏰ Keep-alive cron job scheduled (every 12 hours)');
};

module.exports = { startKeepAliveCron };