import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import matchFetcher from '../../utils/matchFetcher.js';

export default {
  data: new SlashCommandBuilder()
    .setName('fetch')
    .setDescription('Fetch matches from Riot API')
    .addSubcommand(subcommand =>
      subcommand
        .setName('riotid')
        .setDescription('Fetch by Riot ID')
        .addStringOption(option =>
          option.setName('gamename')
            .setDescription('Game name (e.g., PlayerName)')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('tagline')
            .setDescription('Tag line (e.g., TAG1)')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option.setName('numgames')
            .setDescription('Number of games to fetch (default: 3)')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('puuid')
        .setDescription('Fetch by PUUID')
        .addStringOption(option =>
          option.setName('puuid')
            .setDescription('Player PUUID')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option.setName('numgames')
            .setDescription('Number of games to fetch (default: 3)')
            .setRequired(false)
        )
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const subcommand = interaction.options.getSubcommand();
    const numGames = interaction.options.getInteger('numgames') || 3;

    try {
      let results;

      switch (subcommand) {
        case 'riotid':
          const gameName = interaction.options.getString('gamename');
          const tagLine = interaction.options.getString('tagline');
          results = await matchFetcher.fetchMatchesByRiotId(gameName, tagLine, numGames);
          break;

        case 'puuid':
          const puuid = interaction.options.getString('puuid');
          results = await matchFetcher.fetchMatches(puuid, numGames);
          break;
      }

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Match Fetch Complete')
        .setDescription(`Successfully fetched ${results.length} match(es)!`)
        .addFields(
          { name: '📥 Matches Fetched', value: `\`${results.length}\``, inline: true },
          { name: '🎮 Games to Process', value: `\`${numGames}\``, inline: true }
        )
        .setTimestamp();

      if (results.length > 0) {
        let matchList = '';
        results.forEach((result, index) => {
          matchList += `${index + 1}. Game ${result.gameId} - \`${result.filename}\`\\n`;
        });
        embed.addFields({ name: '📁 Saved Files', value: matchList, inline: false });
      }

      embed.setFooter({ text: 'Powered By The Brightest Candle', iconURL: 'https://cdn.discordapp.com/avatars/679647972539105298/5dc8eae2a3a97e0ebbec852d4e969411.webp?size=300' });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      throw new Error(`Match fetching failed: ${error.message}`);
    }
  },
};
