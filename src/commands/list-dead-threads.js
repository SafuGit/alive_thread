const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ComponentType } = require("discord.js");

async function listDeadThreads(interaction, guild, prisma) {
  try {
    await interaction.deferReply();

    console.log("Fetching dead (archived) threads from database...");

    // Get server from database with only archived threads
    const server = await prisma.server.findUnique({
      where: { guildId: guild.id },
      include: {
        threads: {
          where: {
            archived: true
          },
          orderBy: { archiveTimestamp: 'desc' }
        }
      }
    });

    if (!server || server.threads.length === 0) {
      return interaction.editReply({
        content: "❌ No dead (archived) threads found in the database. Use `/scan-threads` first to scan and save threads, or there may be no archived threads.",
      });
    }

    const threads = server.threads;
    const totalThreads = threads.length;
    const threadsPerPage = 10;
    const totalPages = Math.ceil(totalThreads / threadsPerPage);
    let currentPage = 1;

    const generateEmbed = (page) => {
      const startIndex = (page - 1) * threadsPerPage;
      const endIndex = Math.min(startIndex + threadsPerPage, totalThreads);
      const pageThreads = threads.slice(startIndex, endIndex);

      const embed = new EmbedBuilder()
        .setColor(0x6b7280) // Gray color for dead threads
        .setTitle(`🪦 Dead (Archived) Threads - ${guild.name}`)
        .setDescription(`Showing dead threads ${startIndex + 1}-${endIndex} of ${totalThreads}`)
        .setFooter({ 
          text: `Page ${page}/${totalPages} • AliveThread Bot`,
          iconURL: interaction.client.user.displayAvatarURL()
        })
        .setTimestamp();

      pageThreads.forEach((thread, index) => {
        const globalIndex = startIndex + index + 1;
        const locked = thread.locked ? "🔒" : "";
        const messageCount = thread.messageCount ? `(${thread.messageCount} msgs)` : "";
        
        // Format archive timestamp if available
        let archivedTime = "";
        if (thread.archiveTimestamp) {
          try {
            const timestamp = Math.floor(Number(thread.archiveTimestamp) / 1000);
            archivedTime = `\n**Archived:** <t:${timestamp}:R>`;
          } catch (err) {
            archivedTime = "\n**Archived:** Unknown time";
          }
        }
        
        embed.addFields({
          name: `${globalIndex}. ${thread.name || 'Unnamed Thread'} ${locked}`,
          value: `🗃️ Archived ${messageCount}\n**ID:** \`${thread.threadId}\`\n**Parent:** <#${thread.parentId}>${archivedTime}`,
          inline: false
        });
      });

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

    const embed = generateEmbed(currentPage);
    const buttons = generateButtons(currentPage, totalPages);

    const message = await interaction.editReply({
      embeds: [embed],
      components: totalPages > 1 ? [buttons] : [new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('refresh')
          .setLabel('🔄 Refresh')
          .setStyle(ButtonStyle.Success)
      )]
    });

    // Only create collector if there are multiple pages
    if (totalPages > 1) {
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
            // Refresh data from database
            const updatedServer = await prisma.server.findUnique({
              where: { guildId: guild.id },
              include: {
                threads: {
                  where: {
                    archived: true
                  },
                  orderBy: { archiveTimestamp: 'desc' }
                }
              }
            });
            
            if (updatedServer) {
              threads.length = 0;
              threads.push(...updatedServer.threads);
            }
            break;
        }

        const newEmbed = generateEmbed(currentPage);
        const newButtons = generateButtons(currentPage, totalPages);

        await buttonInteraction.editReply({
          embeds: [newEmbed],
          components: [newButtons]
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
    }

  } catch (err) {
    console.error('Error in listDeadThreads:', err);
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({
        content: "❌ Error fetching dead threads from database.",
      });
    } else {
      return interaction.reply({
        content: "❌ Error fetching dead threads from database.",
        ephemeral: true,
      });
    }
  }
}

module.exports = { listDeadThreads };