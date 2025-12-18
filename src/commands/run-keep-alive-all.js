async function runKeepAliveNowAll(interaction, guild, prisma) {
  try {
    await interaction.deferReply({ ephemeral: true });
    const client = interaction.client;

    console.log('Starting manual keep-alive all process...');
    await keepAliveFn(client, prisma);

    return interaction.editReply({
      content: '✅ Keep-alive process for all threads has been completed.'
    });
  } catch (error) {
    console.error('Error in runKeepAliveNowAll:', error);
    return interaction.editReply({
      content: '❌ An error occurred while trying to keep all threads alive.'
    });
  }
}