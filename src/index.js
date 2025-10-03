require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { Client, GatewayIntentBits, REST, Routes, ChannelType } = require("discord.js");
const { formatUptime } = require("./utils/formatUptime");
const fs = require("fs");
const { scanThreads } = require("./commands/scan-threads");
const { listThreads } = require("./commands/list-threads");
const { listDeadThreads } = require("./commands/list-dead-threads");
const { keepAliveCommand } = require("./commands/keep-alive");

console.log("🚀 STARTING BOT...");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
});

const prisma = new PrismaClient();

const commands = [
  {
    name: "health",
    description: "Check if the bot is alive",
  },
  {
    name: "scan-threads",
    description: "Scan all threads in the server and save them",
  },
  {
    name: "list-threads",
    description: "List all saved threads",
  },
  {
    name: "list-dead-threads",
    description: "List all dead threads",
  },
  {
    name: "keep-alive",
    description: "Keep a specific thread alive",
  },
];

const CLIENT_ID = process.env.CLIENT_ID;
const TOKEN = process.env.TOKEN;

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    console.log("Registering slash commands...");
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("Slash commands registered.");
  } catch (err) {
    console.error(err);
  }
})();

client.once("clientReady", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const permissions = 380104723520;
  const inviteLink = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&permissions=${permissions}&scope=bot%20applications.commands`;
  console.log(`Invite the bot using this link: ${inviteLink}`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, guild } = interaction;

  if (!guild) {
    return interaction.reply({
      content: "This command can only be used in a server.",
      flags: "Ephemeral",
    });
  }

  if (commandName === "health") {
    const uptime = process.uptime();
    const uptimeFormatted = formatUptime(uptime);

    return interaction.reply({
      embeds: [
        {
          color: 0xfbbf24,
          title: "Bot Health Check",
          description: "The bot is running smoothly! ✅",
          fields: [
            { name: "Status", value: "🟢 Online", inline: true },
            {
              name: "Ping",
              value: `${interaction.client.ws.ping} ms`,
              inline: true,
            },
            { name: "Uptime", value: uptimeFormatted, inline: true },
          ],
          timestamp: new Date(),
          footer: { text: "AliveThread Bot" },
        },
      ],
    });
  }

  if (commandName === "scan-threads") {
    await scanThreads(interaction, guild, prisma);
  }

  if (commandName === "list-threads") {
    await listThreads(interaction, guild, prisma);
  }

  if (commandName === "list-dead-threads") {
    await listDeadThreads(interaction, guild, prisma);
  }

  if (commandName === "keep-alive") {
    await keepAliveCommand(interaction, guild, prisma);
  }
});

client.login(TOKEN);
