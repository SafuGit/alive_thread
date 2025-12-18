const express = require('express');

const startHealthServer = (client, prisma) => {
  const app = express();
  const port = process.env.PORT || 3000;

  // Health check endpoint for Azure Container Instances
  app.get('/health', async (req, res) => {
    try {
      // Check bot status
      const botStatus = client.readyAt ? 'ready' : 'not_ready';

      // Check database connection
      await prisma.$queryRaw`SELECT 1`;

      res.status(200).json({
        status: 'healthy',
        bot: botStatus,
        database: 'connected',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
      });
    } catch (error) {
      console.error('Health check failed:', error);
      res.status(500).json({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Readiness probe
  app.get('/ready', (req, res) => {
    const isReady = client.readyAt !== null;
    res.status(isReady ? 200 : 503).json({
      ready: isReady,
      timestamp: new Date().toISOString()
    });
  });

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`🏥 Health server running on port ${port}`);
  });

  return server;
};

module.exports = { startHealthServer };