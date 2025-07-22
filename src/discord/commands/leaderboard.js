import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import database from '../../database/mongodb.js';

export default {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Display the ELO leaderboard')
    .addIntegerOption(option =>
      option.setName('mingames')
        .setDescription('Minimum games played (default: 2)')
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const minGames = interaction.options.getInteger('mingames') || 2;
    const players = await database.getLeaderboard(minGames);

    if (players.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle('📊 ELO Leaderboard')
        .setDescription(`No players found with minimum ${minGames} games played.`)
        .setTimestamp()
        .setFooter({ text: 'Powered By The Brightest Candle', iconURL: 'https://cdn.discordapp.com/avatars/679647972539105298/5dc8eae2a3a97e0ebbec852d4e969411.webp?size=300' });

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('🏆 ELO Leaderboard')
      .setDescription(`Players with ${minGames}+ games played`)
      .setTimestamp();

    // Add top 10 players
    const topPlayers = players.slice(0, 10);
    let leaderboardText = '';

    topPlayers.forEach((player, index) => {
      const rank = index + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
      const winRate = player.games > 0 ? ((player.totalWins / player.games) * 100).toFixed(1) : '0.0';
      
      leaderboardText += `${medal} **${player.name}**\\n`;
      leaderboardText += `    ELO: \`${player.elo}\` | Games: \`${player.games}\` | Win Rate: \`${winRate}%\`\\n\\n`;
    });

    embed.addFields({ name: 'Rankings', value: leaderboardText, inline: false });

    // Add stats
    const totalPlayers = players.length;
    const avgElo = Math.round(players.reduce((sum, p) => sum + p.elo, 0) / totalPlayers);
    const totalGames = players.reduce((sum, p) => sum + p.games, 0);

    embed.addFields(
      { name: '📈 Average ELO', value: `\`${avgElo}\``, inline: true },
      { name: '👥 Total Players', value: `\`${totalPlayers}\``, inline: true },
      { name: '🎮 Total Games', value: `\`${totalGames}\``, inline: true }
    );

    embed.setFooter({ text: 'Powered By The Brightest Candle', iconURL: 'https://cdn.discordapp.com/avatars/679647972539105298/5dc8eae2a3a97e0ebbec852d4e969411.webp?size=300' });

    await interaction.editReply({ embeds: [embed] });
  },
};
