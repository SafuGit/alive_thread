# AliveThread Discord Bot - AI Coding Agent Instructions

## Project Overview
AliveThread is a Discord bot that manages forum threads to prevent automatic closure. It uses Discord.js v14, Prisma with PostgreSQL, and implements slash commands for thread management.

## Architecture & Key Components

### Database Schema Pattern
- **Server-Thread Relationship**: One-to-many via `Server.guildId` ↔ `Thread.serverId`
- **Discord ID Mapping**: `Server.guildId` maps to Discord guild, `Thread.threadId` maps to Discord thread
- **Upsert Pattern**: Always use `prisma.{model}.upsert()` for Discord entities to handle existing records
- **BigInt Fields**: `archiveTimestamp`, `lastPinTimestamp` are BigInt (Discord snowflakes)

```javascript
// Standard upsert pattern for Discord entities
await prisma.server.upsert({
  where: { guildId: guild.id },
  update: { name: guild.name },
  create: { guildId: guild.id, name: guild.name },
});
```

### Discord.js Patterns
- **Interaction Handling**: Always check `interaction.isChatInputCommand()` first
- **Guild-Only Commands**: Validate `interaction.guild` exists for server-specific commands
- **Deferred Replies**: Use `interaction.deferReply()` for operations >3 seconds
- **Thread Fetching**: Active threads via `channel.threads.fetchActive()`, archived via `channel.threads.fetchArchived()`

### Command Structure
Commands are registered globally in the startup sequence:
```javascript
const commands = [
  { name: "health", description: "..." },
  { name: "scan-threads", description: "..." },
  // Add new commands here
];
```

## Development Workflow

### Database Operations
```bash
# After schema changes
npm run db:generate     # Generate Prisma client
npm run db:migrate      # Create and apply migrations
npm run db:studio       # Open Prisma Studio GUI
```

### Bot Development
```bash
npm run dev            # Development with nodemon
npm start              # Production start
```

### Environment Setup
Required `.env` variables:
- `CLIENT_ID`: Discord application ID
- `TOKEN`: Discord bot token  
- `DATABASE_URL`: PostgreSQL connection string

## Project-Specific Conventions

### Error Handling Pattern
```javascript
try {
  await interaction.deferReply();
  // async operations
  return interaction.editReply({ content: "Success" });
} catch (err) {
  console.error(err);
  if (interaction.deferred || interaction.replied) {
    return interaction.editReply({ content: "❌ Error message" });
  } else {
    return interaction.reply({ content: "❌ Error message", ephemeral: true });
  }
}
```

### Thread Data Synchronization
When working with Discord threads, sync ALL available properties to database:
```javascript
// Include all thread properties in upsert operations
await prisma.thread.upsert({
  where: { threadId: thread.id },
  update: {
    name: thread.name,
    parentId: thread.parentId,
    locked: thread.locked,
    // ... all other thread properties
  },
  create: {
    threadId: thread.id,
    serverId: server.id,
    // ... complete thread data
  },
});
```

### Utilities Location
- Place reusable utilities in `src/utils/`
- Use CommonJS `require()` syntax (project uses Node.js modules)
- Example: `formatUptime.js` exports time formatting function

## Key Files & Directories
- `src/index.js`: Main bot entry point, command registration and handling
- `src/prisma/schema.prisma`: Database schema (custom location via package.json)
- `src/prisma/migrations/`: Auto-generated migration files
- `src/utils/`: Shared utility functions
- `package.json`: Contains Prisma schema path configuration

## Discord Integration Notes
- Bot requires specific intents: `Guilds`, `GuildMessages`, `GuildMessageReactions`, `MessageContent`
- Uses Discord permissions value `380104723520` for invite links
- Supports both text channels and forum channels for thread discovery
- Handles both active and archived threads in scanning operations

## Common Operations
- **Adding Commands**: Update `commands` array and add handler in `interactionCreate` event
- **Schema Changes**: Modify `schema.prisma`, run migrations, regenerate client
- **New Utilities**: Add to `src/utils/`, export with CommonJS syntax
- **Thread Operations**: Always fetch through Discord API first, then sync to database