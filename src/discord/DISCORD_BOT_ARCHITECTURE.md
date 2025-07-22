# 🤖 Discord Bot Command & Event Handler System

This document explains the modular Discord bot architecture with separate command handlers, event handlers, and deployment utilities.

## 📁 New Directory Structure

```bash
src/discord/
├── bot.js                          # Main bot entry point
├── 📁 commands/                    # Individual command files
│   ├── leaderboard.js             # /leaderboard command
│   ├── player.js                  # /player command
│   ├── elo.js                     # /elo command with subcommands
│   ├── dbstats.js                 # /dbstats command
│   ├── fetch.js                   # /fetch command with subcommands
│   └── help.js                    # /help command
├── 📁 events/                     # Individual event files
│   ├── ready.js                   # Bot ready event
│   └── interactionCreate.js       # Slash command interactions
├── 📁 handlers/                   # Command and event handlers
│   ├── commandHandler.js          # Loads and handles commands
│   └── eventHandler.js            # Loads and handles events
└── 📁 deploy/                     # Command deployment utilities
    ├── deploy-commands.js          # Deploy commands to Discord
    ├── list-commands.js            # List registered commands
    └── remove-commands.js          # Remove commands from Discord
```

## 🚀 Quick Start

### 1. Set up Environment Variables

Add these to your `.env` file:

```env
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
```

### 2. Deploy Commands to Discord

Before running the bot for the first time, deploy the commands:

```bash
npm run bot:deploy
```

### 3. Start the Bot

```bash
npm run bot
```

## 📋 Available NPM Scripts

### Bot Management

- `npm run bot` - Start the Discord bot
- `npm run bot:deploy` - Deploy all commands to Discord
- `npm run bot:list` - List all registered commands
- `npm run bot:remove` - Remove all commands from Discord

### Command Management Examples

```bash
# Deploy commands
npm run bot:deploy

# List current commands
npm run bot:list

# Remove specific command
npm run bot:remove help

# Remove all commands
npm run bot:remove
```

## 🔧 Adding New Commands

### 1. Create Command File

Create a new file in `src/discord/commands/newcommand.js`:

```javascript
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('newcommand')
    .setDescription('Description of the new command')
    .addStringOption(option =>
      option.setName('input')
        .setDescription('Input description')
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();
    
    const input = interaction.options.getString('input');
    
    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ New Command')
      .setDescription(`You entered: ${input}`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
```

### 2. Deploy the Command

```bash
npm run bot:deploy
```

The command will automatically be loaded and registered!

## 🎯 Adding New Events

### 1. Create Event File

Create a new file in `src/discord/events/newevent.js`:

```javascript
export default {
  name: 'guildMemberAdd',  // Discord.js event name
  once: false,             // Set to true for once() instead of on()
  async execute(member) {
    console.log(`New member joined: ${member.user.tag}`);
    // Event logic here
  },
};
```

### 2. Restart the Bot

Events are loaded on startup, so restart the bot:

```bash
npm run bot
```

## 🔄 Command Handler Features

### Command Handler: Automatic Loading

- Scans `commands/` directory for `.js` files
- Validates command structure (`data` and `execute` properties)
- Adds commands to client collection

### Error Handling

- Catches command execution errors
- Sends user-friendly error messages
- Logs detailed errors to console

### Command Structure

Each command file exports:

- `data`: SlashCommandBuilder instance
- `execute`: Async function handling the interaction

## 📡 Event Handler Features

### Event Handler: Automatic Loading

- Scans `events/` directory for `.js` files
- Validates event structure (`name` and `execute` properties)
- Registers events with Discord client

### Event Types

- `once: true` - Event fires only once (e.g., ready)
- `once: false` - Event fires multiple times (e.g., messageCreate)

### Event Structure

Each event file exports:

- `name`: Discord.js event name
- `once`: Boolean for once vs on
- `execute`: Function handling the event

## 🛠️ Deployment Utilities

### Deploy Commands (`deploy-commands.js`)

- Loads all command files
- Converts to JSON format
- Registers with Discord API globally
- Shows deployment progress

### List Commands (`list-commands.js`)

- Fetches all registered commands from Discord
- Displays command names, IDs, and descriptions
- Shows total count

### Remove Commands (`remove-commands.js`)

- Remove all commands: `npm run bot:remove`
- Remove specific command: `npm run bot:remove commandname`
- Useful for cleaning up during development

## 🔍 Debugging & Development

### Command Issues

1. Check command file structure
2. Verify `data` and `execute` exports
3. Run `npm run bot:deploy` after changes
4. Check console for loading errors

### Event Issues

1. Verify event name matches Discord.js events
2. Check `name` and `execute` exports
3. Restart bot after adding events
4. Check console for loading errors

### Deployment Issues

1. Verify `DISCORD_BOT_TOKEN` and `DISCORD_CLIENT_ID`
2. Check bot permissions in Discord
3. Ensure bot is added to target servers

## 🎨 Command Categories

### Current Commands

- **Leaderboard**: `/leaderboard`, `/player`
- **ELO Processing**: `/elo all`, `/elo single`, `/elo compare`
- **Data Fetching**: `/fetch riotid`, `/fetch puuid`
- **Utilities**: `/dbstats`, `/help`

### Adding Command Categories

Commands are automatically categorized by their functionality. To add new categories:

1. Create commands in the `commands/` directory
2. Use consistent naming and descriptions
3. Deploy with `npm run bot:deploy`

## ✨ Benefits of Modular Structure

### ✅ **Maintainability**

- Each command in its own file
- Easy to find and modify specific functionality
- Clear separation of concerns

### ✅ **Scalability**

- Easy to add new commands and events
- No need to modify main bot file
- Automatic loading system

### ✅ **Development**

- Hot-swappable commands via deployment
- Individual command testing
- Better error isolation

### ✅ **Organization**

- Logical file structure
- Consistent command format
- Centralized handlers

---

This modular approach makes the Discord bot much more maintainable and allows for easy expansion of functionality! 🎉
