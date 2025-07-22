#!/usr/bin/env node

import database from './database/mongodb.js';
import eloCalculator from './elo/calculator.js';
import matchFetcher from './utils/matchFetcher.js';
import leaderboard from './utils/leaderboard.js';
import fileManager from './utils/fileManager.js';

class LeagueEloSystem {
  constructor() {
    this.commands = {
      elo: {
        description: 'ELO calculation commands',
        subcommands: {
          single: 'Process a single game by ID',
          all: 'Process all available games',
          compare: 'Compare ELO calculation methods'
        }
      },
      fetch: {
        description: 'Fetch matches from Riot API',
        subcommands: {
          puuid: 'Fetch by PUUID',
          riotid: 'Fetch by Riot ID (gameName#tagLine)',
          summoner: 'Fetch by summoner name'
        }
      },
      leaderboard: {
        description: 'Display leaderboard and player stats',
        subcommands: {
          show: 'Show the leaderboard',
          player: 'Show specific player stats',
          top: 'Show top players by category'
        }
      },
      migrate: {
        description: 'Migration utilities',
        subcommands: {
          players: 'Migrate players from JSON files to MongoDB',
          games: 'Move legacy game folders to new structure',
          matches: 'Move legacy match files to new structure',
          all: 'Run all migrations'
        }
      },
      db: {
        description: 'Database utilities',
        subcommands: {
          connect: 'Test database connection',
          indexes: 'Create database indexes',
          stats: 'Show database statistics'
        }
      }
    };
  }

  async init() {
    try {
      await database.connect();
      await database.createIndexes();
    } catch (error) {
      console.error('Failed to initialize:', error.message);
      process.exit(1);
    }
  }

  async cleanup() {
    await database.disconnect();
  }

  showHelp() {
    console.log('League ELO System v2.0');
    console.log('=====================\n');
    console.log('Usage: node src/main.js <command> [subcommand] [args...]\n');
    
    Object.entries(this.commands).forEach(([cmd, info]) => {
      console.log(`${cmd.toUpperCase()}:`);
      console.log(`  ${info.description}\n`);
      
      Object.entries(info.subcommands).forEach(([sub, desc]) => {
        console.log(`  ${cmd} ${sub} - ${desc}`);
      });
      console.log('');
    });

    console.log('Examples:');
    console.log('  node src/main.js elo single 670885753');
    console.log('  node src/main.js elo all');
    console.log('  node src/main.js elo compare 670885753');
    console.log('  node src/main.js fetch puuid <puuid> [numGames]');
    console.log('  node src/main.js fetch riotid <gameName> <tagLine> [numGames]');
    console.log('  node src/main.js leaderboard show [minGames]');
    console.log('  node src/main.js leaderboard player <playerName>');
    console.log('  node src/main.js migrate all');
  }

  // ELO Commands
  async handleEloCommands(subcommand, args) {
    switch (subcommand) {
      case 'single':
        if (!args[0]) {
          console.error('Game ID required. Usage: elo single <gameId>');
          return;
        }
        await eloCalculator.processGame(args[0]);
        break;

      case 'all':
        await eloCalculator.processAllGames();
        break;

      case 'compare':
        if (args[0]) {
          await eloCalculator.compareEloMethods(args[0]);
        } else {
          // Compare all games
          const gameDirectories = fileManager.getAllGameDirectories();
          for (const { gameId } of gameDirectories) {
            console.log(`\n=== Comparing methods for Game ${gameId} ===`);
            await eloCalculator.compareEloMethods(gameId);
          }
        }
        break;

      default:
        console.error('Unknown ELO subcommand. Available: single, all, compare');
    }
  }

  // Fetch Commands
  async handleFetchCommands(subcommand, args) {
    switch (subcommand) {
      case 'puuid':
        if (!args[0]) {
          console.error('PUUID required. Usage: fetch puuid <puuid> [numGames]');
          return;
        }
        const numGames = parseInt(args[1]) || 3;
        await matchFetcher.fetchMatches(args[0], numGames);
        break;

      case 'riotid':
        if (!args[0] || !args[1]) {
          console.error('Riot ID required. Usage: fetch riotid <gameName> <tagLine> [numGames]');
          return;
        }
        const numGamesRiot = parseInt(args[2]) || 3;
        await matchFetcher.fetchMatchesByRiotId(args[0], args[1], numGamesRiot);
        break;

      case 'summoner':
        if (!args[0]) {
          console.error('Summoner name required. Usage: fetch summoner <summonerName> [numGames]');
          return;
        }
        const numGamesSummoner = parseInt(args[1]) || 3;
        await matchFetcher.fetchMatchesBySummonerName(args[0], numGamesSummoner);
        break;

      default:
        console.error('Unknown fetch subcommand. Available: puuid, riotid, summoner');
    }
  }

  // Leaderboard Commands
  async handleLeaderboardCommands(subcommand, args) {
    switch (subcommand) {
      case 'show':
      case undefined:
        const minGames = parseInt(args[0]) || 2;
        await leaderboard.displayLeaderboard(minGames);
        break;

      case 'player':
        if (!args[0]) {
          console.error('Player name required. Usage: leaderboard player <playerName>');
          return;
        }
        await leaderboard.getPlayerStats(args[0]);
        break;

      case 'top':
        const category = args[0] || 'elo';
        const limit = parseInt(args[1]) || 10;
        await leaderboard.displayTopPlayers(category, limit);
        break;

      default:
        console.error('Unknown leaderboard subcommand. Available: show, player, top');
    }
  }

  // Migration Commands
  async handleMigrationCommands(subcommand, args) {
    switch (subcommand) {
      case 'players':
        const playerDir = fileManager.playerDir;
        await database.migratePlayersFromFiles(playerDir);
        break;

      case 'games':
        fileManager.migrateLegacyGameFolders();
        console.log('✅ Game folders migration completed');
        break;

      case 'matches':
        fileManager.migrateLegacyMatchFiles();
        console.log('✅ Match files migration completed');
        break;

      case 'all':
        console.log('Running all migrations...\n');
        
        // 1. Migrate file structure
        fileManager.migrateLegacyGameFolders();
        fileManager.migrateLegacyMatchFiles();
        
        // 2. Migrate players to database
        const playerDirPath = fileManager.playerDir;
        await database.migratePlayersFromFiles(playerDirPath);
        
        console.log('\n✅ All migrations completed successfully!');
        break;

      default:
        console.error('Unknown migration subcommand. Available: players, games, matches, all');
    }
  }

  // Database Commands
  async handleDatabaseCommands(subcommand, args) {
    switch (subcommand) {
      case 'connect':
        console.log('Testing database connection...');
        try {
          const db = await database.connect();
          console.log('✅ Database connection successful');
          console.log(`Connected to: ${db.databaseName}`);
        } catch (error) {
          console.error('❌ Database connection failed:', error.message);
        }
        break;

      case 'indexes':
        await database.createIndexes();
        break;

      case 'stats':
        try {
          const players = await database.getAllPlayers();
          const games = await database.getAllGames();
          const matches = await database.getCollection('matches');
          const matchCount = await matches.countDocuments();

          console.log('=== Database Statistics ===');
          console.log(`Players: ${players.length}`);
          console.log(`Games: ${games.length}`);
          console.log(`Matches: ${matchCount}`);
          
          if (players.length > 0) {
            const avgElo = players.reduce((sum, p) => sum + (p.elo || 0), 0) / players.length;
            const totalGames = players.reduce((sum, p) => sum + (p.games || 0), 0);
            console.log(`Average ELO: ${Math.round(avgElo)}`);
            console.log(`Total Games Played: ${totalGames}`);
          }
        } catch (error) {
          console.error('Error fetching database stats:', error.message);
        }
        break;

      default:
        console.error('Unknown database subcommand. Available: connect, indexes, stats');
    }
  }

  async run() {
    const [,, command, subcommand, ...args] = process.argv;

    if (!command || command === 'help' || command === '--help' || command === '-h') {
      this.showHelp();
      return;
    }

    await this.init();

    try {
      switch (command.toLowerCase()) {
        case 'elo':
          await this.handleEloCommands(subcommand, args);
          break;

        case 'fetch':
          await this.handleFetchCommands(subcommand, args);
          break;

        case 'leaderboard':
        case 'lb':
          await this.handleLeaderboardCommands(subcommand, args);
          break;

        case 'migrate':
          await this.handleMigrationCommands(subcommand, args);
          break;

        case 'db':
        case 'database':
          await this.handleDatabaseCommands(subcommand, args);
          break;

        default:
          console.error(`Unknown command: ${command}`);
          this.showHelp();
      }
    } catch (error) {
      console.error('Error:', error.message);
      if (process.env.DEBUG) {
        console.error(error.stack);
      }
    } finally {
      await this.cleanup();
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n📴 Shutting down gracefully...');
  await database.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n📴 Shutting down gracefully...');
  await database.disconnect();
  process.exit(0);
});

// Run the application
const app = new LeagueEloSystem();
app.run().catch(error => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
