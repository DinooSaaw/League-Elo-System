import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import database from '../../database/mongodb.js';

export default {
  data: new SlashCommandBuilder()
    .setName('dbstats')
    .setDescription('Display database statistics'),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const players = await database.getAllPlayers();
      const games = await database.getAllGames();
      const matches = await database.getCollection('matches');
      const matchCount = await matches.countDocuments();

      const avgElo = players.length > 0 ? Math.round(players.reduce((sum, p) => sum + (p.elo || 0), 0) / players.length) : 0;
      const totalGames = players.reduce((sum, p) => sum + (p.games || 0), 0);

      const embed = new EmbedBuilder()
        .setColor(0x9932CC)
        .setTitle('📊 Database Statistics')
        .addFields(
          { name: '👥 Players', value: `\`${players.length}\``, inline: true },
          { name: '🎮 Games', value: `\`${games.length}\``, inline: true },
          { name: '📁 Matches', value: `\`${matchCount}\``, inline: true },
          { name: '📈 Average ELO', value: `\`${avgElo}\``, inline: true },
          { name: '🎯 Total Games Played', value: `\`${totalGames}\``, inline: true },
          { name: '🗄️ Database', value: `\`${process.env.MONGODB_DB_NAME || 'elo'}\``, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'Powered By The Brightest Candle', iconURL: 'https://cdn.discordapp.com/avatars/679647972539105298/5dc8eae2a3a97e0ebbec852d4e969411.webp?size=300' });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      throw new Error(`Database stats failed: ${error.message}`);
    }
  },
};
