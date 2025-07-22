import { REST, Routes } from 'discord.js';
import { Collection } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function deployCommands() {
  const commands = [];
  const commandsPath = path.join(__dirname, '..', 'commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  console.log('🔄 Loading commands for deployment...');

  // Load all command files
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    try {
      const command = await import(`file://${filePath}`);
      const commandData = command.default;

      if ('data' in commandData && 'execute' in commandData) {
        commands.push(commandData.data.toJSON());
        console.log(`✅ Loaded command: ${commandData.data.name}`);
      } else {
        console.log(`⚠️ [WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
      }
    } catch (error) {
      console.error(`❌ Error loading command ${file}:`, error);
    }
  }

  // Construct and prepare an instance of the REST module
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

  try {
    console.log(`🚀 Started refreshing ${commands.length} application (/) commands.`);

    // The put method is used to fully refresh all commands in the guild with the current set
    const data = await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: commands },
    );

    console.log(`✅ Successfully reloaded ${data.length} application (/) commands globally.`);
    console.log('📋 Deployed commands:', data.map(cmd => cmd.name).join(', '));
  } catch (error) {
    console.error('❌ Error deploying commands:', error);
  }
}

// Check for required environment variables
if (!process.env.DISCORD_BOT_TOKEN) {
  console.error('❌ DISCORD_BOT_TOKEN not found in environment variables');
  process.exit(1);
}

if (!process.env.DISCORD_CLIENT_ID) {
  console.error('❌ DISCORD_CLIENT_ID not found in environment variables');
  console.log('💡 Add your bot\'s client ID to .env file: DISCORD_CLIENT_ID=your_client_id_here');
  process.exit(1);
}

// Deploy commands
deployCommands();
