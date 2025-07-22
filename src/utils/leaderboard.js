import database from '../database/mongodb.js';

class Leaderboard {
  constructor() {
    this.minGames = 2; // Minimum games to appear on leaderboard
  }

  async getLeaderboard(minGames = this.minGames) {
    try {
      const players = await database.getLeaderboard(minGames);
      return players;
    } catch (error) {
      console.error('Error fetching leaderboard:', error.message);
      throw error;
    }
  }

  async displayLeaderboard(minGames = this.minGames) {
    try {
      const players = await this.getLeaderboard(minGames);

      if (players.length === 0) {
        console.log('No players found with the minimum required games.');
        return;
      }

      console.log('=== ELO Leaderboard ===');
      console.log(`(Minimum ${minGames} games played)\n`);

      players.forEach((player, index) => {
        const rank = (index + 1).toString().padStart(2, ' ');
        const name = player.name.padEnd(20);
        const elo = player.elo.toString().padStart(4);
        const games = player.games.toString().padStart(3);
        const winLoss = player.winLoss || `${player.totalWins || 0}:${player.totalLosses || 0}`;
        const winRate = player.totalWins && player.games ? 
          `(${((player.totalWins / player.games) * 100).toFixed(1)}%)` : '';

        console.log(
          `${rank}. ${name} ELO: ${elo}  Games: ${games}  W/L: ${winLoss.padEnd(8)} ${winRate}`
        );
      });

      // Show additional stats
      const totalPlayers = players.length;
      const averageElo = Math.round(players.reduce((sum, p) => sum + p.elo, 0) / totalPlayers);
      const totalGames = players.reduce((sum, p) => sum + p.games, 0);

      console.log('\n=== Statistics ===');
      console.log(`Total Players: ${totalPlayers}`);
      console.log(`Average ELO: ${averageElo}`);
      console.log(`Total Games Played: ${totalGames}`);

      // Top performers
      const topElo = players[0];
      const mostGames = players.reduce((max, p) => p.games > max.games ? p : max, players[0]);
      const bestWinRate = players
        .filter(p => p.games >= 5)
        .reduce((max, p) => {
          const winRate = p.totalWins / p.games;
          const maxWinRate = max.totalWins / max.games;
          return winRate > maxWinRate ? p : max;
        }, players.find(p => p.games >= 5) || players[0]);

      console.log('\n=== Top Performers ===');
      console.log(`Highest ELO: ${topElo.name} (${topElo.elo})`);
      console.log(`Most Games: ${mostGames.name} (${mostGames.games} games)`);
      if (bestWinRate && bestWinRate.games >= 5) {
        const winRate = ((bestWinRate.totalWins / bestWinRate.games) * 100).toFixed(1);
        console.log(`Best Win Rate: ${bestWinRate.name} (${winRate}% over ${bestWinRate.games} games)`);
      }

      return players;
    } catch (error) {
      console.error('Error displaying leaderboard:', error.message);
      throw error;
    }
  }

  async getPlayerStats(playerName) {
    try {
      const player = await database.getPlayer(playerName);
      if (!player) {
        console.log(`Player "${playerName}" not found.`);
        return null;
      }

      console.log(`\n=== ${player.name} Stats ===`);
      console.log(`ELO: ${player.elo}`);
      console.log(`Games Played: ${player.games}`);
      console.log(`Win/Loss: ${player.winLoss || `${player.totalWins}:${player.totalLosses}`}`);
      
      if (player.games > 0) {
        const winRate = ((player.totalWins / player.games) * 100).toFixed(1);
        console.log(`Win Rate: ${winRate}%`);
        
        console.log(`\nAverage Stats:`);
        console.log(`  Kills: ${player.avgKills?.toFixed(1) || 'N/A'}`);
        console.log(`  Deaths: ${player.avgDeaths?.toFixed(1) || 'N/A'}`);
        console.log(`  Assists: ${player.avgAssists?.toFixed(1) || 'N/A'}`);
        console.log(`  Gold: ${player.avgGold?.toFixed(0) || 'N/A'}`);

        // Show recent ELO history
        if (player.eloHistory && player.eloHistory.length > 0) {
          console.log(`\nRecent ELO History (last 5 games):`);
          const recentHistory = player.eloHistory.slice(-5);
          recentHistory.forEach(entry => {
            const date = new Date(entry.timestamp).toLocaleDateString();
            const change = entry.change > 0 ? `+${entry.change}` : entry.change.toString();
            const color = entry.change > 0 ? '\x1b[32m' : entry.change < 0 ? '\x1b[31m' : '\x1b[37m';
            const colorEnd = '\x1b[0m';
            console.log(`  ${date}: ${entry.oldElo} -> ${entry.newElo} (${color}${change}${colorEnd}) [${entry.method}]`);
          });
        }
      }

      return player;
    } catch (error) {
      console.error('Error fetching player stats:', error.message);
      throw error;
    }
  }

  async getTopPlayers(category = 'elo', limit = 10) {
    try {
      let players;
      
      switch (category.toLowerCase()) {
        case 'elo':
          players = await database.getLeaderboard(this.minGames);
          break;
        case 'games':
          players = await database.getAllPlayers({ games: { $gte: this.minGames } });
          players.sort((a, b) => b.games - a.games);
          break;
        case 'winrate':
          players = await database.getAllPlayers({ games: { $gte: 5 } });
          players.sort((a, b) => (b.totalWins / b.games) - (a.totalWins / a.games));
          break;
        case 'kills':
          players = await database.getAllPlayers({ games: { $gte: this.minGames } });
          players.sort((a, b) => (b.avgKills || 0) - (a.avgKills || 0));
          break;
        default:
          throw new Error(`Unknown category: ${category}`);
      }

      return players.slice(0, limit);
    } catch (error) {
      console.error('Error fetching top players:', error.message);
      throw error;
    }
  }

  async displayTopPlayers(category = 'elo', limit = 10) {
    try {
      const players = await this.getTopPlayers(category, limit);
      
      console.log(`\n=== Top ${limit} Players by ${category.toUpperCase()} ===`);
      
      players.forEach((player, index) => {
        const rank = (index + 1).toString().padStart(2, ' ');
        const name = player.name.padEnd(20);
        
        let value;
        switch (category.toLowerCase()) {
          case 'elo':
            value = player.elo.toString();
            break;
          case 'games':
            value = player.games.toString();
            break;
          case 'winrate':
            value = `${((player.totalWins / player.games) * 100).toFixed(1)}%`;
            break;
          case 'kills':
            value = (player.avgKills || 0).toFixed(1);
            break;
        }
        
        console.log(`${rank}. ${name} ${value}`);
      });

      return players;
    } catch (error) {
      console.error('Error displaying top players:', error.message);
      throw error;
    }
  }
}

export default new Leaderboard();
