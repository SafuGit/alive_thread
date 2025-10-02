require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { Client, GatewayIntentBits, REST, Routes, ChannelType } = require("discord.js");
const { formatUptime } = require("./utils/formatUptime");
const fs = require("fs");

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
    description: "Keep saved threads alive",
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
            console.warn(`Failed to fetch threads for channel ${channel.name}:`, threadErr.message);
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
});

client.login(TOKEN);
