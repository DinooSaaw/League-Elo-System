import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

async function listCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

  try {
    console.log('🔍 Fetching all registered commands...');

    // Get global commands
    const globalCommands = await rest.get(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID)
    );

    console.log('\n📋 Global Commands:');
    console.log('===================');
    
    if (globalCommands.length === 0) {
      console.log('❌ No global commands found.');
    } else {
      globalCommands.forEach((command, index) => {
        console.log(`${index + 1}. ${command.name} (ID: ${command.id})`);
        console.log(`   Description: ${command.description}`);
        if (command.options && command.options.length > 0) {
          console.log(`   Options: ${command.options.length}`);
        }
        console.log('');
      });
    }

    console.log(`✅ Total commands found: ${globalCommands.length}`);
    
    return globalCommands;
  } catch (error) {
    console.error('❌ Error fetching commands:', error);
  }
}

// Check for required environment variables
if (!process.env.DISCORD_BOT_TOKEN) {
  console.error('❌ DISCORD_BOT_TOKEN not found in environment variables');
  process.exit(1);
}

if (!process.env.DISCORD_CLIENT_ID) {
  console.error('❌ DISCORD_CLIENT_ID not found in environment variables');
  process.exit(1);
}

// List commands
listCommands();
