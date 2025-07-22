import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

async function removeCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

  try {
    console.log('🔍 Fetching all registered commands...');

    // Get all global commands
    const commands = await rest.get(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID)
    );

    if (commands.length === 0) {
      console.log('❌ No commands found to remove.');
      return;
    }

    console.log(`⚠️ Found ${commands.length} commands to remove:`);
    commands.forEach((command, index) => {
      console.log(`${index + 1}. ${command.name} (ID: ${command.id})`);
    });

    // Confirm removal (in a real script, you might want to add a prompt)
    console.log('\n🗑️ Removing all commands...');

    // Remove all commands by setting an empty array
    const data = await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: [] },
    );

    console.log(`✅ Successfully removed all application (/) commands.`);
    console.log(`📊 Commands remaining: ${data.length}`);
  } catch (error) {
    console.error('❌ Error removing commands:', error);
  }
}

async function removeSpecificCommand(commandName) {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

  try {
    console.log(`🔍 Looking for command: ${commandName}`);

    // Get all commands
    const commands = await rest.get(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID)
    );

    const commandToDelete = commands.find(cmd => cmd.name === commandName);

    if (!commandToDelete) {
      console.log(`❌ Command "${commandName}" not found.`);
      return;
    }

    // Delete the specific command
    await rest.delete(
      Routes.applicationCommand(process.env.DISCORD_CLIENT_ID, commandToDelete.id)
    );

    console.log(`✅ Successfully deleted command: ${commandName}`);
  } catch (error) {
    console.error(`❌ Error removing command "${commandName}":`, error);
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

// Get command line arguments
const args = process.argv.slice(2);
const specificCommand = args[0];

if (specificCommand) {
  console.log(`🎯 Removing specific command: ${specificCommand}`);
  removeSpecificCommand(specificCommand);
} else {
  console.log('🗑️ Removing ALL commands...');
  console.log('💡 To remove a specific command, use: node remove-commands.js <command-name>');
  removeCommands();
}
