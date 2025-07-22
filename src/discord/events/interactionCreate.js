import { EmbedBuilder } from 'discord.js';
import { handleCommand } from '../handlers/commandHandler.js';

export default {
  name: 'interactionCreate',
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;

    try {
      await handleCommand(interaction);
    } catch (error) {
      console.error('Error handling command:', error);
      
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Error')
        .setDescription(`An error occurred: ${error.message}`)
        .setTimestamp();

      const errorMessage = { embeds: [errorEmbed], ephemeral: true };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  },
};
