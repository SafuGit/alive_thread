const { ChannelType, EmbedBuilder } = require("discord.js");

async function keepAliveCommand(interaction, guild, prisma) {
  try {
    const channel = await interaction.channel.fetch();

    // Check if the command is being used in a thread
    if (channel.type !== ChannelType.PublicThread && channel.type !== ChannelType.PrivateThread) { 
      return interaction.reply({
        content: "❌ This command can only be used in threads.",
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    console.log(`Processing keep-alive for thread: ${channel.name} (${channel.id})`);

    // First, ensure the server exists in the database
    const server = await prisma.server.upsert({
      where: { guildId: guild.id },
      update: { name: guild.name },
      create: { 
        guildId: guild.id, 
        name: guild.name 
      },
    });

    console.log(`Server ensured in database: ${server.id}`);

    // Check if thread exists in database, if not add it
    let thread = await prisma.thread.findUnique({
      where: { threadId: channel.id }
    });

    if (!thread) {
      console.log(`Thread not found in database, creating new entry...`);
      
      // Fetch complete thread data from Discord
      const discordThread = await channel.fetch();
      
      thread = await prisma.thread.create({
        data: {
          threadId: discordThread.id,
          serverId: server.id,
          name: discordThread.name,
          parentId: discordThread.parentId,
          locked: discordThread.locked || false,
          invitable: discordThread.invitable,
          archived: discordThread.archived || false,
          autoArchiveDuration: discordThread.autoArchiveDuration,
          archiveTimestamp: discordThread.archiveTimestamp ? BigInt(discordThread.archiveTimestamp) : null,
          lastMessageId: discordThread.lastMessageId,
          lastPinTimestamp: discordThread.lastPinTimestamp ? BigInt(discordThread.lastPinTimestamp) : null,
          rateLimitPerUser: discordThread.rateLimitPerUser,
          messageCount: discordThread.messageCount,
          memberCount: discordThread.memberCount,
          totalMessageSent: discordThread.totalMessageSent,
          appliedTags: discordThread.appliedTags || [],
        },
      });

      console.log(`Thread created in database: ${thread.id}`);
    } else {
      console.log(`Thread found in database: ${thread.id}`);
      
      // Optionally update thread data with current Discord state
      const discordThread = await channel.fetch();
      thread = await prisma.thread.update({
        where: { threadId: channel.id },
        data: {
          name: discordThread.name,
          locked: discordThread.locked || false,
          archived: discordThread.archived || false,
          messageCount: discordThread.messageCount,
          memberCount: discordThread.memberCount,
          updatedAt: new Date(),
        },
      });
    }

    // Now add the thread to keep-alive list
    try {
      const keepAliveThread = await prisma.keepAliveThread.upsert({
        where: {
          threadId_userId: {
            threadId: thread.id,
            userId: interaction.user.id,
          }
        },
        update: {
          isActive: true,
          userName: interaction.user.username,
          updatedAt: new Date(),
        },
        create: {
          threadId: thread.id,
          userId: interaction.user.id,
          userName: interaction.user.username,
          isActive: true,
        },
      });

      console.log(`Keep-alive entry created/updated: ${keepAliveThread.id}`);

      // Create success embed
      const embed = new EmbedBuilder()
        .setColor(0xfbbf24)
        .setTitle("🛡️ Thread Keep-Alive Activated")
        .setDescription(`Thread **${channel.name}** has been added to your keep-alive list!`)
        .addFields(
          { name: "Thread ID", value: `\`${channel.id}\``, inline: true },
          { name: "Added by", value: `${interaction.user.username}`, inline: true },
          { name: "Status", value: "🟢 Active", inline: true },
        )
        .setFooter({ 
          text: "AliveThread Bot • The bot will now monitor this thread",
          iconURL: interaction.client.user.displayAvatarURL()
        })
        .setTimestamp();

      return interaction.editReply({
        embeds: [embed]
      });

    } catch (err) {
      if (err.code === 'P2002') {
        // Unique constraint violation - thread already in keep-alive by this user
        return interaction.editReply({
          content: `ℹ️ This thread is already in your keep-alive list! Use \`/list-keep-alive\` to see all your monitored threads.`,
        });
      }
      throw err; // Re-throw if it's a different error
    }

  } catch (err) {
    console.error('Error in keepAliveCommand:', err);
    
    const errorMessage = "❌ Error adding thread to keep-alive list.";
    
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({
        content: errorMessage,
      });
    } else {
      return interaction.reply({
        content: errorMessage,
        ephemeral: true,
      });
    }
  }
}

module.exports = { keepAliveCommand };