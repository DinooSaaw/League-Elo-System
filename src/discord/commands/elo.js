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
      let result = null;
      let resultText = '';

      switch (subcommand) {
        case 'all':
          await eloCalculator.processAllGames();
          resultText = 'Successfully processed all available games!';
          
          const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ ELO Processing Complete')
            .setDescription(resultText)
            .setTimestamp()
            .setFooter({ text: 'Powered By The Brightest Candle', iconURL: 'https://cdn.discordapp.com/avatars/679647972539105298/5dc8eae2a3a97e0ebbec852d4e969411.webp?size=300' });

          await interaction.editReply({ embeds: [embed] });
          return;

        case 'single':
          const gameId = interaction.options.getString('gameid');
          result = await eloCalculator.processGame(gameId);
          
          // Create detailed embed for single game
          const singleEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle(`⚔️ Game ${gameId} - ELO Changes`)
            .setDescription(`Processed ${result.participants.length} participants`)
            .setTimestamp()
            .setFooter({ text: 'Powered By The Brightest Candle', iconURL: 'https://cdn.discordapp.com/avatars/679647972539105298/5dc8eae2a3a97e0ebbec852d4e969411.webp?size=300' });

          // Sort by ELO change (highest first)
          const sortedParticipants = result.participants.sort((a, b) => b.eloChange - a.eloChange);

          let playerChanges = '';
          sortedParticipants.forEach(p => {
            const changeEmoji = p.eloChange > 0 ? '📈' : p.eloChange < 0 ? '📉' : '➡️';
            const changeText = p.eloChange > 0 ? `+${p.eloChange}` : `${p.eloChange}`;
            const winEmoji = p.win ? '🏆' : '💀';
            const kda = `${p.kills}/${p.deaths}/${p.assists}`;
            
            playerChanges += `${changeEmoji} **${p.name}** ${winEmoji}\n`;
            playerChanges += `    \`${p.oldElo} → ${p.newElo}\` (${changeText}) | ${kda} | ${p.champion}\n\n`;
          });

          singleEmbed.addFields(
            { name: '📊 ELO Changes', value: playerChanges, inline: false },
            { name: '⚙️ Method', value: `\`${result.participants[0]?.method || 'none'}\``, inline: true },
            { name: '🎮 Game ID', value: `\`${gameId}\``, inline: true }
          );

          await interaction.editReply({ embeds: [singleEmbed] });
          return;

        case 'compare':
          const compareGameId = interaction.options.getString('gameid');
          result = await eloCalculator.compareEloMethods(compareGameId);
          
          // Create comparison embed
          const compareEmbed = new EmbedBuilder()
            .setColor(0x9932CC)
            .setTitle(`🔬 Game ${compareGameId} - Method Comparison`)
            .setDescription(`Comparing Traditional vs Hybrid ELO calculations`)
            .setTimestamp()
            .setFooter({ text: 'Powered By The Brightest Candle', iconURL: 'https://cdn.discordapp.com/avatars/679647972539105298/5dc8eae2a3a97e0ebbec852d4e969411.webp?size=300' });

          let comparisonText = '';
          result.participants.forEach(p => {
            const winEmoji = p.win ? '🏆' : '💀';
            const kda = `${p.kills}/${p.deaths}/${p.assists}`;
            
            comparisonText += `${winEmoji} **${p.name}** (${kda})\n`;
            comparisonText += `    Current: \`${p.currentElo}\`\n`;
            
            if (p.traditional) {
              const tChange = p.traditional.change > 0 ? `+${p.traditional.change}` : `${p.traditional.change}`;
              comparisonText += `    Traditional: \`${p.traditional.newElo}\` (${tChange})\n`;
            }
            
            if (p.hybrid) {
              const hChange = p.hybrid.change > 0 ? `+${p.hybrid.change}` : `${p.hybrid.change}`;
              comparisonText += `    Hybrid: \`${p.hybrid.newElo}\` (${hChange})\n`;
            }
            
            comparisonText += '\n';
          });

          compareEmbed.addFields(
            { name: '📊 Method Comparison', value: comparisonText, inline: false },
            { name: '🎮 Game ID', value: `\`${compareGameId}\``, inline: true },
            { name: '⚠️ Note', value: 'This comparison does not save changes to database', inline: true }
          );

          await interaction.editReply({ embeds: [compareEmbed] });
          return;
      }

    } catch (error) {
      throw new Error(`ELO processing failed: ${error.message}`);
    }
  },
};
