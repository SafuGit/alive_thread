const keepThreadAlive = async (client, threadId) => {
  try {
    const thread = await client.channels.fetch(threadId);
    
    if (!thread || !thread.isThread()) {
      console.log(`❌ Thread ${threadId} not found or is not a thread`);
      return false;
    }

    // Send the keep-alive message
    const message = await thread.send({
      content: "🔄 **Thread Keep-Alive** - This message will be deleted in 10 seconds.",
      flags: ["SuppressEmbeds"]
    });

    console.log(`✅ Keep-alive message sent to thread: ${thread.name}`);

    // Delete the message after 10 seconds
    setTimeout(async () => {
      try {
        await message.delete();
        console.log(`🗑️ Keep-alive message deleted from thread: ${thread.name}`);
      } catch (deleteErr) {
        console.error(`❌ Failed to delete keep-alive message in ${thread.name}:`, deleteErr.message);
      }
    }, 10000);

    return true;
  } catch (err) {
    console.error(`❌ Failed to keep thread ${threadId} alive:`, err.message);
    return false;
  }
};

module.exports = { keepThreadAlive };