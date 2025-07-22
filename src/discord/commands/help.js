import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Display help information'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('🤖 League ELO System Bot')
      .setDescription('Available commands for the League ELO System')
      .addFields(
        {
          name: '🏆 Leaderboard Commands',
          value: '`/leaderboard [mingames]` - Show ELO leaderboard\\n`/player <name>` - Show player stats',
          inline: false
        },
        {
          name: '⚔️ ELO Commands', 
          value: '`/elo all` - Process all games\\n`/elo single <gameid>` - Process single game\\n`/elo compare <gameid>` - Compare ELO methods',
          inline: false
        },
        {
          name: '📥 Fetch Commands',
          value: '`/fetch riotid <name> <tag> [games]` - Fetch by Riot ID\\n`/fetch puuid <puuid> [games]` - Fetch by PUUID',
          inline: false
        },
        {
          name: '📊 Utility Commands',
          value: '`/dbstats` - Database statistics\\n`/help` - Show this help message',
          inline: false
        }
      )
      .setFooter({ text: 'Powered By The Brightest Candle', iconURL: 'https://cdn.discordapp.com/avatars/679647972539105298/5dc8eae2a3a97e0ebbec852d4e969411.webp?size=300' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
