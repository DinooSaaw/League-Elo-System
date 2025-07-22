import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
import database from '../database/mongodb.js';
import { loadCommands } from './handlers/commandHandler.js';
import { loadEvents } from './handlers/eventHandler.js';

dotenv.config();

class DiscordBot {
  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });

    this.setupGracefulShutdown();
  }

  setupGracefulShutdown() {
    // Graceful shutdown
    const shutdown = async () => {
      console.log('\\n📴 Shutting down Discord bot...');
      try {
        await database.disconnect();
        this.client.destroy();
        console.log('✅ Bot shutdown complete');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }

  async start() {
    if (!process.env.DISCORD_BOT_TOKEN) {
      console.error('❌ DISCORD_BOT_TOKEN not found in environment variables');
      process.exit(1);
    }

    try {
      // Initialize database connection
      console.log('🔌 Connecting to database...');
      await database.connect();
      await database.createIndexes();

      // Load commands and events
      await loadCommands(this.client);
      await loadEvents(this.client);

      // Start the bot
      console.log('🤖 Starting Discord bot...');
      await this.client.login(process.env.DISCORD_BOT_TOKEN);
    } catch (error) {
      console.error('❌ Failed to start Discord bot:', error);
      process.exit(1);
    }
  }
}

// Start the bot
const bot = new DiscordBot();
bot.start();
