import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import database from '../../database/mongodb.js';

export default {
  data: new SlashCommandBuilder()
    .setName('player')
    .setDescription('Display stats for a specific player')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Player name')
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const playerName = interaction.options.getString('name');
    const player = await database.getPlayer(playerName);

    if (!player) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Player Not Found')
        .setDescription(`Player "${playerName}" not found in the database.`)
        .setTimestamp()
        .setFooter({ text: 'Powered By The Brightest Candle', iconURL: 'https://cdn.discordapp.com/avatars/679647972539105298/5dc8eae2a3a97e0ebbec852d4e969411.webp?size=300' });

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const winRate = player.games > 0 ? ((player.totalWins / player.games) * 100).toFixed(1) : '0.0';
    const kda = player.avgDeaths > 0 ? ((player.avgKills + player.avgAssists) / player.avgDeaths).toFixed(2) : (player.avgKills + player.avgAssists).toFixed(2);

    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle(`🎮 ${player.name}`)
      .setDescription('Player Statistics')
      .addFields(
        { name: '📊 ELO Rating', value: `\`${player.elo}\``, inline: true },
        { name: '🎯 Games Played', value: `\`${player.games}\``, inline: true },
        { name: '🏆 Win Rate', value: `\`${winRate}%\``, inline: true },
        { name: '⚔️ W/L Record', value: `\`${player.winLoss || '0:0'}\``, inline: true },
        { name: '💀 KDA Ratio', value: `\`${kda}\``, inline: true },
        { name: '💰 Avg Gold', value: `\`${Math.round(player.avgGold || 0)}\``, inline: true }
      )
      .setTimestamp();

    // Add recent ELO history if available
    if (player.eloHistory && player.eloHistory.length > 0) {
      const recentGames = player.eloHistory.slice(-5).reverse();
      let historyText = '';
      
      recentGames.forEach(game => {
        const change = game.change;
        const changeText = change > 0 ? `+${change}` : `${change}`;
        const emoji = change > 0 ? '📈' : change < 0 ? '📉' : '➡️';
        historyText += `${emoji} \`${game.oldElo} → ${game.newElo}\` (${changeText})\\n`;
      });

      embed.addFields({ name: '📈 Recent ELO History', value: historyText, inline: false });
    }

    embed.setFooter({ text: 'Powered By The Brightest Candle', iconURL: 'https://cdn.discordapp.com/avatars/679647972539105298/5dc8eae2a3a97e0ebbec852d4e969411.webp?size=300' });

    await interaction.editReply({ embeds: [embed] });
  },
};
