import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import eloCalculator from '../../elo/calculator.js';

export default {
  data: new SlashCommandBuilder()
    .setName('elo')
    .setDescription('Process ELO calculations')
    .addSubcommand(subcommand =>
      subcommand
        .setName('all')
        .setDescription('Process all available games')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('single')
        .setDescription('Process a single game')
        .addStringOption(option =>
          option.setName('gameid')
            .setDescription('Game ID to process')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('compare')
        .setDescription('Compare ELO calculation methods')
        .addStringOption(option =>
          option.setName('gameid')
            .setDescription('Game ID to compare')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const subcommand = interaction.options.getSubcommand();

    try {
      let resultText = '';

      switch (subcommand) {
        case 'all':
          await eloCalculator.processAllGames();
          resultText = 'Successfully processed all available games!';
          break;

        case 'single':
          const gameId = interaction.options.getString('gameid');
          await eloCalculator.processGame(gameId);
          resultText = `Successfully processed game ${gameId}!`;
          break;

        case 'compare':
          const compareGameId = interaction.options.getString('gameid');
          await eloCalculator.compareEloMethods(compareGameId);
          resultText = `Successfully compared ELO methods for game ${compareGameId}!`;
          break;
      }

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ ELO Processing Complete')
        .setDescription(resultText)
        .setTimestamp()
        .setFooter({ text: 'Powered By The Brightest Candle', iconURL: 'https://cdn.discordapp.com/avatars/679647972539105298/5dc8eae2a3a97e0ebbec852d4e969411.webp?size=300' });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      throw new Error(`ELO processing failed: ${error.message}`);
    }
  },
};
