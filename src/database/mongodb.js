import { MongoClient, ServerApiVersion } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

class Database {
  constructor() {
    this.client = null;
    this.db = null;
    this.isConnected = false;
  }

  async connect() {
    if (this.isConnected) return this.db;

    try {
      // Use MongoDB connection string from environment or default to local
      const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
      const dbName = process.env.MONGODB_DB_NAME || 'league_elo_system';

      this.client = new MongoClient(uri, {
        serverApi: {
          version: ServerApiVersion.v1,
          strict: true,
          deprecationErrors: true,
        }
      });

      await this.client.connect();
      this.db = this.client.db(dbName);
      this.isConnected = true;

      console.log('✅ Connected to MongoDB');
      return this.db;
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error.message);
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.isConnected = false;
      console.log('📴 Disconnected from MongoDB');
    }
  }

  async getCollection(name) {
    if (!this.isConnected) {
      await this.connect();
    }
    return this.db.collection(name);
  }

  // Player operations
  async getPlayer(name) {
    const players = await this.getCollection('players');
    return await players.findOne({ name });
  }

  async savePlayer(playerData) {
    const players = await this.getCollection('players');
    const { name, ...data } = playerData;
    
    return await players.updateOne(
      { name },
      { 
        $set: { 
          ...data, 
          updatedAt: new Date() 
        },
        $setOnInsert: { 
          name,
          createdAt: new Date() 
        }
      },
      { upsert: true }
    );
  }

  async getAllPlayers(filter = {}) {
    const players = await this.getCollection('players');
    return await players.find(filter).toArray();
  }

  async getLeaderboard(minGames = 2) {
    const players = await this.getCollection('players');
    return await players
      .find({ games: { $gte: minGames } })
      .sort({ elo: -1 })
      .toArray();
  }

  // Game operations
  async saveGame(gameData) {
    const games = await this.getCollection('games');
    const { gameId, ...data } = gameData;
    
    return await games.updateOne(
      { gameId },
      { 
        $set: { 
          ...data, 
          updatedAt: new Date() 
        },
        $setOnInsert: { 
          gameId,
          createdAt: new Date() 
        }
      },
      { upsert: true }
    );
  }

  async getGame(gameId) {
    const games = await this.getCollection('games');
    return await games.findOne({ gameId });
  }

  async getAllGames() {
    const games = await this.getCollection('games');
    return await games.find({}).toArray();
  }

  // Match operations
  async saveMatch(matchData) {
    const matches = await this.getCollection('matches');
    const { matchId, ...data } = matchData;
    
    return await matches.updateOne(
      { matchId },
      { 
        $set: { 
          ...data, 
          updatedAt: new Date() 
        },
        $setOnInsert: { 
          matchId,
          createdAt: new Date() 
        }
      },
      { upsert: true }
    );
  }

  async getMatch(matchId) {
    const matches = await this.getCollection('matches');
    return await matches.findOne({ matchId });
  }

  // Migration helpers
  async migratePlayersFromFiles(playerDir) {
    const fs = await import('fs');
    const path = await import('path');
    
    if (!fs.existsSync(playerDir)) {
      console.log('No player directory found for migration');
      return;
    }

    const files = fs.readdirSync(playerDir).filter(f => f.endsWith('.json'));
    let migrated = 0;

    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(playerDir, file), 'utf-8'));
        const name = file.replace('.json', '');
        
        await this.savePlayer({ name, ...data });
        migrated++;
      } catch (error) {
        console.error(`Failed to migrate ${file}:`, error.message);
      }
    }

    console.log(`✅ Migrated ${migrated} players to MongoDB`);
    return migrated;
  }

  async createIndexes() {
    try {
      const players = await this.getCollection('players');
      const games = await this.getCollection('games');
      const matches = await this.getCollection('matches');

      // Create indexes for better performance
      await players.createIndex({ name: 1 }, { unique: true });
      await players.createIndex({ elo: -1 });
      await players.createIndex({ games: -1 });
      
      await games.createIndex({ gameId: 1 }, { unique: true });
      await games.createIndex({ createdAt: -1 });
      
      await matches.createIndex({ matchId: 1 }, { unique: true });
      await matches.createIndex({ createdAt: -1 });

      console.log('✅ Database indexes created');
    } catch (error) {
      console.error('❌ Failed to create indexes:', error.message);
    }
  }
}

// Export singleton instance
export default new Database();
