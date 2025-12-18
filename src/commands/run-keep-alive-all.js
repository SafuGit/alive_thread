const { runKeepAliveNow } = require("../services/cron");

async function runKeepAliveNowAll(interaction, guild, prisma) {
  try {
    // Only allow server administrators to run this
    if (!interaction.memberPermissions || !interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ content: '❌ You must be an administrator to run this command.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    const client = interaction.client;

    console.log('Starting manual keep-alive all process...');
    const result = await runKeepAliveNow(client, prisma);

    if (result && result.skipped) {
      return interaction.editReply({ content: '⚠️ A keep-alive run is already in progress. Skipped.' });
    }

    return interaction.editReply({
      content: `✅ Keep-alive process finished: ${result.successCount || 0} success, ${result.failureCount || 0} failures (processed ${result.processed || 0})`
    });
  } catch (error) {
    console.error('Error in runKeepAliveNowAll:', error);
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({ content: '❌ An error occurred while trying to keep all threads alive.' });
    }
    return interaction.reply({ content: '❌ An error occurred while trying to keep all threads alive.', ephemeral: true });
  }
}

module.exports = { runKeepAliveNowAll };