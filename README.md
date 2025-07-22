# League ELO System v2.0

A comprehensive, clean, and organized ELO rating system for League of Legends matches with MongoDB integration.

## 🚀 Features

- **Clean Project Structure**: Organized folders for games, matches, and source code
- **MongoDB Integration**: All player data stored in MongoDB for better performance
- **Convenient Entry Point**: Simple `npm start` commands for all operations
- **Multiple ELO Calculation Methods**: Traditional, Hybrid, and Lane Comparison algorithms
- **Match Fetching**: Automatic fetching from Riot Games API
- **Comprehensive Leaderboards**: Multiple ranking categories and detailed player statistics
- **Migration Tools**: Easy migration from legacy file-based storage

## 📁 Clean Project Structure

``` bash
League Elo System/
├── 📁 src/                       # Source code (organized)
│   ├── main.js                   # Main application logic
│   ├── 📁 database/
│   │   └── mongodb.js            # MongoDB connection and operations
│   ├── 📁 elo/
│   │   └── calculator.js         # ELO calculation algorithms
│   └── 📁 utils/
│       ├── fileManager.js        # File operations and migration
│       ├── matchFetcher.js       # Riot API integration
│       └── leaderboard.js        # Leaderboard and player statistics
├── 📁 games/                     # Game participant data (organized by game_ID)
├── 📁 matches/                   # Complete match data from Riot API
├── 📁 legacy/                    # Legacy files (moved from root)
├── 📁 player/                    # Legacy player data (for reference)
├── index.js                      # Main entry point
├── package.json                  # Dependencies and convenient scripts
├── elo-config.jsonc             # ELO calculation configuration
└── README.md                    # This file
```

## � Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment (optional for basic usage)

Create a `.env` file in the root directory:

```env
# MongoDB Configuration (defaults to local MongoDB)
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=league_elo_system

# Riot Games API Key (required only for fetching new matches)
# RIOT_API_KEY=your_riot_api_key_here
```

### 3. Start using the system

**View help and available commands:**

```bash
npm start help
```

**Quick commands for common tasks:**

```bash
# View current leaderboard
npm run leaderboard

# Process all games and calculate ELO
npm run elo

# Check database statistics
npm run db:stats

# Migrate data (if upgrading)
npm run migrate
```

**Manual commands for specific operations:**

```bash
# Process specific game
npm start elo single 670885753

# Fetch new matches (requires API key)
npm start fetch riotid PlayerName TAG1

# View specific player stats
npm start leaderboard player "kadeem alford"
```

## 📋 Available Commands

All commands can be run with `npm start <command>` or the convenient shortcuts:

### Quick NPM Scripts

- `npm run leaderboard` - Show current leaderboard
- `npm run elo` - Process all games
- `npm run db:stats` - Database statistics
- `npm run migrate` - Run all migrations
- `npm run help` - Show help information

### Manual Commands

- `npm start fetch puuid <puuid> [numGames]` - Fetch by PUUID
- `npm start fetch riotid <gameName> <tagLine> [numGames]` - Fetch by Riot ID
- `npm start fetch summoner <summonerName> [numGames]` - Fetch by summoner name

### Leaderboard & Statistics

- `npm start leaderboard show [minGames]` - Show leaderboard
- `npm start leaderboard player <playerName>` - Show player stats
- `npm start leaderboard top <category> [limit]` - Top players by category

### Migration & Database

- `npm start migrate all` - Run all migrations
- `npm start migrate players` - Migrate players to MongoDB
- `npm start db stats` - Show database statistics
- `npm start db connect` - Test database connection

## ⚙️ Configuration

The ELO calculation behavior is configured in `elo-config.jsonc`:

### Calculation Methods

- **Hybrid** (default): Performance-weighted ELO with base changes
- **Traditional**: Classic team-based ELO with performance modifiers
- **Lane Comparison**: Compare players within their roles

### Performance Weights

Configure how different game statistics affect ELO calculations:

- KDA, Damage, Vision, Objectives, Farm, Survival, Utility

### Role-Specific Priorities

Different weights for different roles (TOP, JUNGLE, MIDDLE, BOTTOM, UTILITY)

## 🗄️ Database Schema

### Players Collection

```javascript
{
  name: "PlayerName",
  elo: 1250,
  games: 15,
  totalWins: 8,
  totalLosses: 7,
  totalKills: 120,
  totalDeaths: 95,
  totalAssists: 180,
  avgKills: 8.0,
  avgDeaths: 6.3,
  avgAssists: 12.0,
  winLoss: "8:7",
  eloHistory: [...],
  performanceHistory: [...],
  createdAt: Date,
  updatedAt: Date
}
```

### Games Collection

```javascript
{
  gameId: "670885753",
  participants: [...],
  processedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Matches Collection

```javascript
{
  matchId: "OC1_670885753",
  gameId: "670885753",
  matchData: {...}, // Full Riot API response
  gameMode: "CLASSIC",
  gameDuration: 2793,
  participants: [...],
  createdAt: Date,
  updatedAt: Date
}
```

## 🔄 Migration from v1.x

If you're upgrading from the legacy version:

1. **Run the migration command**:

   ```bash
   npm start migrate all
   ```

2. **This will**:
   - Move `game_*` folders to `games/` directory
   - Move `Match_*.json` files to `matches/` directory
   - Import all player JSON files to MongoDB
   - Create database indexes

3. **Verify migration**:

   ```bash
   npm start db stats
   npm start leaderboard show
   ```

## 🎮 ELO Calculation Methods

### Hybrid Method (Default)

- Base ELO change: ±25 points
- Performance multiplier: Adjusts based on individual performance
- Win/Loss reduction: Reduces ELO change for poor wins or good losses

### Traditional Method

- Team-based ELO calculation with expected win probability
- Performance modifiers based on individual statistics
- Weighted combination of team result and individual performance

### Lane Comparison Method

- Compares players within their specific roles
- Role-specific stat priorities (e.g., supports prioritize vision)
- Relative performance ranking within lane/role

## 🏆 Leaderboard Features

- **Minimum Games Filter**: Only show players with sufficient games
- **Multiple Categories**: ELO, Games Played, Win Rate, Average KDA
- **Player Statistics**: Detailed individual player performance
- **ELO History**: Track ELO changes over time
- **Performance Trends**: Analyze performance patterns

## 🔧 Development

### Adding New ELO Methods

1. Create method in `src/elo/calculator.js`
2. Add configuration in `elo-config.jsonc`
3. Update the `calculateAllEloMethods` function

### Adding New Commands

1. Add command structure to `src/main.js`
2. Create handler function
3. Update help text and documentation

### Database Operations

Use the database module for all MongoDB operations:

```javascript
import database from './database/mongodb.js';

const player = await database.getPlayer('PlayerName');
await database.savePlayer(playerData);
```

## 📊 Performance Tips

- **Indexes**: Database indexes are automatically created for optimal query performance
- **Batch Processing**: Process multiple games efficiently with `elo all`
- **History Limits**: Player history is limited to last 50 entries to prevent bloat
- **Connection Pooling**: MongoDB connections are reused efficiently

## 🐛 Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   - Ensure MongoDB is running
   - Check connection string in `.env`
   - Verify firewall settings

2. **Riot API Rate Limits**
   - The system automatically handles rate limits
   - Ensure your API key is valid and not expired

3. **Migration Issues**
   - Backup your data before migration
   - Check file permissions
   - Ensure MongoDB is accessible

4. **Missing Game Data**
   - Verify game folders exist in correct location
   - Check participant JSON file format
   - Run data validation

### Debug Mode

Set `DEBUG=true` in your environment for detailed error logs:

```bash
DEBUG=true npm start elo all
```

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Support

For issues and questions:

- Check the troubleshooting section
- Review the logs for error details
- Create an issue on GitHub with detailed information
