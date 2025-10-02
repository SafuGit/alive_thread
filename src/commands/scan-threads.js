import { ChannelType } from "discord.js";

export async function scanThreads(interaction, guild, prisma) {
  try {
    await interaction.deferReply();

    console.log("Scanning threads...");
    const server = await prisma.server.upsert({
      where: { guildId: guild.id },
      update: { name: guild.name },
      create: { guildId: guild.id, name: guild.name },
    });

    const channels = await guild.channels.fetch();
    const allThreads = [];

    for (const [, channel] of channels) {
      // Check if channel supports threads using ChannelType enum
      if (
        channel.type === ChannelType.GuildText ||
        channel.type === ChannelType.PublicThread ||
        channel.type === ChannelType.GuildForum
      ) {
        try {
          // Fetch active threads
          const activeThreads = await channel.threads.fetchActive();
          activeThreads.threads.forEach((thread) => allThreads.push(thread));

          // Fetch archived threads
          const archivedThreads = await channel.threads.fetchArchived({
            limit: 100,
          });
          archivedThreads.threads.forEach((thread) => allThreads.push(thread));
        } catch (threadErr) {
          console.warn(
            `Failed to fetch threads for channel ${channel.name}:`,
            threadErr.message
          );
        }
      }
    }

    console.log(`Found ${allThreads.length} threads in total.`);

    if (allThreads.length === 0) {
      return interaction.editReply({
        content: "No threads found in this server.",
      });
    }

    // Save all threads to database
    for (const thread of allThreads) {
      await prisma.thread.upsert({
        where: { threadId: thread.id },
        update: {
          name: thread.name,
          parentId: thread.parentId,
          locked: thread.locked,
          invitable: thread.invitable,
          archived: thread.archived,
          autoArchiveDuration: thread.autoArchiveDuration,
          archiveTimestamp: thread.archiveTimestamp,
          lastMessageId: thread.lastMessageId,
          lastPinTimestamp: thread.lastPinTimestamp,
          rateLimitPerUser: thread.rateLimitPerUser,
          messageCount: thread.messageCount,
          memberCount: thread.memberCount,
          totalMessageSent: thread.totalMessageSent,
          appliedTags: thread.appliedTags,
        },
        create: {
          threadId: thread.id,
          serverId: server.id,
          name: thread.name,
          parentId: thread.parentId,
          locked: thread.locked,
          invitable: thread.invitable,
          archived: thread.archived,
          autoArchiveDuration: thread.autoArchiveDuration,
          archiveTimestamp: thread.archiveTimestamp,
          lastMessageId: thread.lastMessageId,
          lastPinTimestamp: thread.lastPinTimestamp,
          rateLimitPerUser: thread.rateLimitPerUser,
          messageCount: thread.messageCount,
          memberCount: thread.memberCount,
          totalMessageSent: thread.totalMessageSent,
          appliedTags: thread.appliedTags,
        },
      });
    }

    console.log(
      `✅ Scanned and saved ${allThreads.length} threads to the database.`
    );
    return interaction.editReply({
      content: `✅ Scanned and saved ${allThreads.length} threads to the database.`,
    });
  } catch (err) {
    console.error(err);
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({
        content: "❌ Error scanning threads.",
      });
    } else {
      return interaction.reply({
        content: "❌ Error scanning threads.",
        ephemeral: true,
      });
    }
  }
}
