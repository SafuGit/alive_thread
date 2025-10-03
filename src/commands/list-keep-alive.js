const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ComponentType } = require("discord.js");

async function listKeepAlive(interaction, guild, prisma) {
  try {
    await interaction.deferReply();

    console.log(`Fetching keep-alive threads for user: ${interaction.user.username} (${interaction.user.id})`);

    // Get all keep-alive threads for this user in this server
    const keepAliveThreads = await prisma.keepAliveThread.findMany({
      where: {
        userId: interaction.user.id,
        isActive: true,
        thread: {
          server: {
            guildId: guild.id
          }
        }
      },
      include: {
        thread: {
          include: {
            server: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (keepAliveThreads.length === 0) {
      return interaction.editReply({
        content: "❌ You don't have any threads in your keep-alive list for this server. Use `/keep-alive` in a thread to add it!",
      });
    }

    const totalThreads = keepAliveThreads.length;
    const threadsPerPage = 8;
    const totalPages = Math.ceil(totalThreads / threadsPerPage);
    let currentPage = 1;

    const generateEmbed = async (page) => {
      const startIndex = (page - 1) * threadsPerPage;
      const endIndex = Math.min(startIndex + threadsPerPage, totalThreads);
      const pageThreads = keepAliveThreads.slice(startIndex, endIndex);

      const embed = new EmbedBuilder()
        .setColor(0xfbbf24)
        .setTitle(`🛡️ Your Keep-Alive Threads - ${guild.name}`)
        .setDescription(`Showing threads ${startIndex + 1}-${endIndex} of ${totalThreads}`)
        .setFooter({ 
          text: `Page ${page}/${totalPages} • ${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      // Check thread status by fetching from Discord
      for (let i = 0; i < pageThreads.length; i++) {
        const keepAliveThread = pageThreads[i];
        const thread = keepAliveThread.thread;
        const globalIndex = startIndex + i + 1;

        let status = "🔄 Checking...";
        let threadLink = `Unknown`;
        let additionalInfo = "";

        try {
          // Try to fetch the thread from Discord to check current status
          const discordThread = await interaction.client.channels.fetch(thread.threadId);
          
          if (discordThread) {
            status = discordThread.archived ? "🗃️ Archived" : "✅ Active";
            threadLink = `<#${thread.threadId}>`;
            
            if (discordThread.locked) {
              status += " 🔒";
            }
            
            additionalInfo = discordThread.messageCount ? `\n**Messages:** ${discordThread.messageCount}` : "";
          }
        } catch (error) {
          // Thread might be deleted or inaccessible
          status = "❌ Not Found";
          threadLink = `\`${thread.threadId}\` (Deleted?)`;
          additionalInfo = "\n⚠️ Thread may have been deleted";
        }

        // Format the date when added to keep-alive
        const addedDate = Math.floor(keepAliveThread.createdAt.getTime() / 1000);

        embed.addFields({
          name: `${globalIndex}. ${thread.name || 'Unnamed Thread'}`,
          value: `${status}\n**Thread:** ${threadLink}\n**Added:** <t:${addedDate}:R>${additionalInfo}`,
          inline: false
        });
      }

      return embed;
    };

    const generateButtons = (page, totalPages) => {
      const row = new ActionRowBuilder();

      const prevButton = new ButtonBuilder()
        .setCustomId('prev_page')
        .setLabel('◀️ Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 1);

      const pageButton = new ButtonBuilder()
        .setCustomId('current_page')
        .setLabel(`${page}/${totalPages}`)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true);

      const nextButton = new ButtonBuilder()
        .setCustomId('next_page')
        .setLabel('Next ▶️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === totalPages);

      const refreshButton = new ButtonBuilder()
        .setCustomId('refresh')
        .setLabel('🔄 Refresh')
        .setStyle(ButtonStyle.Success);

      row.addComponents(prevButton, pageButton, nextButton, refreshButton);
      return row;
    };

    const embed = await generateEmbed(currentPage);
    const buttons = generateButtons(currentPage, totalPages);

    const message = await interaction.editReply({
      embeds: [embed],
      components: totalPages > 1 ? [buttons] : [new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('refresh')
          .setLabel('🔄 Refresh')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('manage_info')
          .setLabel('ℹ️ Manage')
          .setStyle(ButtonStyle.Secondary)
      )]
    });

    // Create collector for button interactions
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 300000 // 5 minutes
    });

    collector.on('collect', async (buttonInteraction) => {
      if (buttonInteraction.user.id !== interaction.user.id) {
        return buttonInteraction.reply({
          content: "❌ Only the user who ran the command can use these buttons.",
          ephemeral: true
        });
      }

      await buttonInteraction.deferUpdate();

      switch (buttonInteraction.customId) {
        case 'prev_page':
          if (currentPage > 1) {
            currentPage--;
          }
          break;
        case 'next_page':
          if (currentPage < totalPages) {
            currentPage++;
          }
          break;
        case 'refresh':
          // Refresh - just regenerate the embed with current data
          console.log('Refreshing keep-alive list...');
          break;
        case 'manage_info':
          return buttonInteraction.followUp({
            content: `ℹ️ **Managing Keep-Alive Threads:**\n\n` +
                     `• Use \`/keep-alive\` in any thread to add it to your list\n` +
                     `• Threads are automatically monitored while in your list\n` +
                     `• Use \`/remove-keep-alive\` to remove threads (coming soon)\n` +
                     `• Archived/deleted threads will show appropriate status`,
            ephemeral: true
          });
      }

      const newEmbed = await generateEmbed(currentPage);
      const newButtons = generateButtons(currentPage, totalPages);

      await buttonInteraction.editReply({
        embeds: [newEmbed],
        components: totalPages > 1 ? [newButtons] : [new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('refresh')
            .setLabel('🔄 Refresh')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('manage_info')
            .setLabel('ℹ️ Manage')
            .setStyle(ButtonStyle.Secondary)
        )]
      });
    });

    collector.on('end', async () => {
      try {
        const disabledRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('disabled')
              .setLabel('⏰ Interaction Expired')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true)
          );

        await message.edit({
          components: [disabledRow]
        });
      } catch (error) {
        console.log('Could not disable buttons - message may have been deleted');
      }
    });

  } catch (err) {
    console.error('Error in listKeepAlive:', err);
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({
        content: "❌ Error fetching your keep-alive threads.",
      });
    } else {
      return interaction.reply({
        content: "❌ Error fetching your keep-alive threads.",
        ephemeral: true,
      });
    }
  }
}

module.exports = { listKeepAlive };