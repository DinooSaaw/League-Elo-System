import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import database from '../../database/mongodb.js';

export default {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Display the ELO leaderboard')
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Type of leaderboard to display (default: elo)')
        .setRequired(false)
        .addChoices(
          { name: 'ELO Rating', value: 'elo' },
          { name: 'Games Played', value: 'games' },
          { name: 'Win Rate', value: 'winrate' },
          { name: 'KDA Ratio', value: 'kda' }
        )
    )
    .addIntegerOption(option =>
      option.setName('mingames')
        .setDescription('Minimum games played (default: 2)')
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const leaderboardType = interaction.options.getString('type') || 'elo';
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

    // Sort players based on leaderboard type
    let sortedPlayers = [...players];
    let titleEmoji = '🏆';
    let titleText = 'ELO Leaderboard';
    let valueFormatter;

    switch (leaderboardType) {
      case 'elo':
        sortedPlayers.sort((a, b) => b.elo - a.elo);
        titleEmoji = '🏆';
        titleText = 'ELO Leaderboard';
        valueFormatter = (player) => `ELO: \`${player.elo}\``;
        break;
      
      case 'games':
        sortedPlayers.sort((a, b) => b.games - a.games);
        titleEmoji = '🎮';
        titleText = 'Games Played Leaderboard';
        valueFormatter = (player) => `Games: \`${player.games}\``;
        break;
      
      case 'winrate':
        sortedPlayers.sort((a, b) => {
          const aWinRate = a.games > 0 ? (a.totalWins / a.games) : 0;
          const bWinRate = b.games > 0 ? (b.totalWins / b.games) : 0;
          return bWinRate - aWinRate;
        });
        titleEmoji = '📈';
        titleText = 'Win Rate Leaderboard';
        valueFormatter = (player) => {
          const winRate = player.games > 0 ? ((player.totalWins / player.games) * 100).toFixed(1) : '0.0';
          return `Win Rate: \`${winRate}%\``;
        };
        break;
      
      case 'kda':
        sortedPlayers.sort((a, b) => {
          const aKda = a.avgDeaths > 0 ? (a.avgKills + a.avgAssists) / a.avgDeaths : (a.avgKills + a.avgAssists);
          const bKda = b.avgDeaths > 0 ? (b.avgKills + b.avgAssists) / b.avgDeaths : (b.avgKills + b.avgAssists);
          return bKda - aKda;
        });
        titleEmoji = '⚔️';
        titleText = 'KDA Ratio Leaderboard';
        valueFormatter = (player) => {
          const kda = player.avgDeaths > 0 ? ((player.avgKills + player.avgAssists) / player.avgDeaths).toFixed(2) : (player.avgKills + player.avgAssists).toFixed(2);
          return `KDA: \`${kda}\``;
        };
        break;
    }

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle(`${titleEmoji} ${titleText}`)
      .setDescription(`Players with ${minGames}+ games played`)
      .setTimestamp();

    // Add top 10 players
    const topPlayers = sortedPlayers.slice(0, 10);
    let leaderboardText = '';

    topPlayers.forEach((player, index) => {
      const rank = index + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
      const mainValue = valueFormatter(player);
      const winRate = player.games > 0 ? ((player.totalWins / player.games) * 100).toFixed(1) : '0.0';
      
      leaderboardText += `${medal} **${player.name}**\n`;
      leaderboardText += `    ${mainValue} | Games: \`${player.games}\` | Win Rate: \`${winRate}%\`\n\n`;
    });

    embed.addFields({ name: 'Rankings', value: leaderboardText, inline: false });

    // Add stats
    const totalPlayers = sortedPlayers.length;
    const avgElo = Math.round(sortedPlayers.reduce((sum, p) => sum + p.elo, 0) / totalPlayers);
    const totalGames = sortedPlayers.reduce((sum, p) => sum + p.games, 0);

    // Add type-specific statistics
    let typeSpecificStats = [];
    
    switch (leaderboardType) {
      case 'elo':
        const highestElo = sortedPlayers[0]?.elo || 0;
        const lowestElo = sortedPlayers[sortedPlayers.length - 1]?.elo || 0;
        typeSpecificStats = [
          { name: '📈 Average ELO', value: `\`${avgElo}\``, inline: true },
          { name: '🔥 Highest ELO', value: `\`${highestElo}\``, inline: true },
          { name: '� Lowest ELO', value: `\`${lowestElo}\``, inline: true }
        ];
        break;
      
      case 'games':
        const mostGames = sortedPlayers[0]?.games || 0;
        const avgGames = Math.round(totalGames / totalPlayers);
        typeSpecificStats = [
          { name: '🎮 Most Games', value: `\`${mostGames}\``, inline: true },
          { name: '📊 Average Games', value: `\`${avgGames}\``, inline: true },
          { name: '🏆 Total Games', value: `\`${totalGames}\``, inline: true }
        ];
        break;
      
      case 'winrate':
        const bestWinRate = sortedPlayers[0] ? ((sortedPlayers[0].totalWins / sortedPlayers[0].games) * 100).toFixed(1) : '0.0';
        const avgWinRate = (sortedPlayers.reduce((sum, p) => sum + (p.games > 0 ? (p.totalWins / p.games) : 0), 0) / totalPlayers * 100).toFixed(1);
        typeSpecificStats = [
          { name: '🏆 Best Win Rate', value: `\`${bestWinRate}%\``, inline: true },
          { name: '📊 Average Win Rate', value: `\`${avgWinRate}%\``, inline: true },
          { name: '📈 Average ELO', value: `\`${avgElo}\``, inline: true }
        ];
        break;
      
      case 'kda':
        const bestKda = sortedPlayers[0] ? (sortedPlayers[0].avgDeaths > 0 ? ((sortedPlayers[0].avgKills + sortedPlayers[0].avgAssists) / sortedPlayers[0].avgDeaths).toFixed(2) : (sortedPlayers[0].avgKills + sortedPlayers[0].avgAssists).toFixed(2)) : '0.00';
        const avgKda = (sortedPlayers.reduce((sum, p) => sum + (p.avgDeaths > 0 ? (p.avgKills + p.avgAssists) / p.avgDeaths : (p.avgKills + p.avgAssists)), 0) / totalPlayers).toFixed(2);
        typeSpecificStats = [
          { name: '⚔️ Best KDA', value: `\`${bestKda}\``, inline: true },
          { name: '📊 Average KDA', value: `\`${avgKda}\``, inline: true },
          { name: '👥 Total Players', value: `\`${totalPlayers}\``, inline: true }
        ];
        break;
    }

    embed.addFields(...typeSpecificStats);

    embed.setFooter({ text: 'Powered By The Brightest Candle', iconURL: 'https://cdn.discordapp.com/avatars/679647972539105298/5dc8eae2a3a97e0ebbec852d4e969411.webp?size=300' });

    await interaction.editReply({ embeds: [embed] });
  },
};
