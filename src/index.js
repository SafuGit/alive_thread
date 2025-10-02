require("dotenv").config();
const { Client, GatewayIntentBits, REST, Routes } = require("discord.js");

console.log("🚀 STARTING BOT...");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
});

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

client.login(TOKEN);