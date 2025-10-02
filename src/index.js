require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { Client, GatewayIntentBits, REST, Routes } = require("discord.js");
const { formatUptime } = require("./utils/formatUptime");

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
    name: "keep-alive", 
    description: "Keep saved threads alive" 
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
          color: 0xFBBF24,
          title: "Bot Health Check",
          description: "The bot is running smoothly! ✅",
          fields: [
            { name: "Status", value: "🟢 Online", inline: true },
            { name: "Ping", value: `${interaction.client.ws.ping} ms`, inline: true },
            { name: "Uptime", value: uptimeFormatted, inline: true },
            { name: "Guilds", value: `${interaction.client.guilds.cache.size}`, inline: true },
          ],
          timestamp: new Date(),
          footer: { text: "AliveThread Bot" }
        }
      ]
    })
  }
});

client.login(TOKEN);