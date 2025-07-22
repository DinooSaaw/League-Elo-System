import fs from 'fs';
import { parse } from 'jsonc-parser';
import Ajv from 'ajv';
import database from '../database/mongodb.js';
import fileManager from '../utils/fileManager.js';

class EloCalculator {
  constructor() {
    this.config = null;
    this.ajv = new Ajv();
    this.participantSchema = {
      type: 'object',
      properties: {
        kills: { type: 'number' },
        deaths: { type: 'number' },
        assists: { type: 'number' },
        totalMinionsKilled: { type: 'number' },
        neutralMinionsKilled: { type: 'number' },
        timePlayed: { type: 'number' },
        win: { type: 'boolean' },
        teamId: { type: 'number' },
        summonerName: { type: 'string' },
        riotIdGameName: { type: 'string' },
        riotIdTagline: { type: 'string' }
      },
      required: ['kills', 'deaths', 'assists', 'timePlayed', 'win', 'teamId'],
    };
    this.validateParticipant = this.ajv.compile(this.participantSchema);
    this.loadConfig();
  }

  loadConfig() {
    try {
      this.config = parse(fs.readFileSync('elo-config.jsonc', 'utf-8'));
    } catch (error) {
      console.error('Failed to load config:', error.message);
      throw error;
    }
  }

  // Load current ELO from database
  async loadPlayerElo(name) {
    const player = await database.getPlayer(name);
    return player ? (player.elo ?? this.config.baseElo) : this.config.baseElo;
  }

  // Get player name from participant data
  getPlayerName(participant) {
    return fileManager.getPlayerName(participant);
  }

  // Get participant role/position
  getRole(participant) {
    return (participant.individualPosition || participant.teamPosition || 'UNKNOWN').toUpperCase();
  }

  // Calculate normalized performance stats
  calculatePerformanceStats(participant, gameLengthSeconds) {
    const timeMinutes = Math.max(1, (participant.timePlayed || 1) / 60);
    const wardsPlaced = participant.wardsPlaced || participant.visionWardsBoughtInGame || 0;
    const wardsCleared = participant.wardsKilled || 0;
    const turretDamage = participant.damageDealtToTurrets || participant.challenges?.damageDealtToTurrets || 0;
    const killParticipation = participant.challenges?.killParticipation || 0;

    return {
      kda: participant.deaths > 0 ? (participant.kills + participant.assists) / participant.deaths : (participant.kills + participant.assists) || 1,
      kdaRaw: participant.kills + participant.assists - participant.deaths,
      killParticipation,
      damagePerMinute: (participant.totalDamageDealtToChampions || 0) / timeMinutes,
      visionScorePerMinute: (participant.visionScore || 0) / timeMinutes,
      csPerMinute: (participant.totalMinionsKilled || 0) / timeMinutes,
      goldPerMinute: (participant.goldEarned || 0) / timeMinutes,
      wardsPlaced,
      wardsCleared,
      turretDamage,
      objectiveParticipation: this.calculateObjectiveParticipation(participant),
      survivalRate: timeMinutes / Math.max(1, participant.deaths),
      utilityScore: this.calculateUtilityScore(participant),
      earlyGamePerformance: this.calculateEarlyGamePerformance(participant),
      lateGamePerformance: this.calculateLateGamePerformance(participant),
      teamFightParticipation: this.calculateTeamFightParticipation(participant),
      soloKills: participant.challenges?.soloKills || 0,
      comebackFactor: this.calculateComebackFactor(participant)
    };
  }

  calculateObjectiveParticipation(participant) {
    const dragonKills = participant.dragonKills || 0;
    const baronKills = participant.baronKills || 0;
    const turretKills = participant.turretKills || 0;
    const inhibitorKills = participant.inhibitorKills || 0;
    return dragonKills * 3 + baronKills * 5 + turretKills * 2 + inhibitorKills * 4;
  }

  calculateUtilityScore(participant) {
    const healsAndShields = participant.challenges?.effectiveHealAndShielding || 0;
    const ccScore = participant.challenges?.enemyChampionImmobilizations || 0;
    const visionScore = participant.visionScore || 0;
    return healsAndShields / 100 + ccScore * 2 + visionScore;
  }

  calculateEarlyGamePerformance(participant) {
    const earlyKills = participant.challenges?.killsNearEnemyTurret || 0;
    const earlyFarm = participant.challenges?.laneMinionsFirst10Minutes || 0;
    const firstBlood = (participant.firstBloodKill ? 10 : 0) + (participant.firstBloodAssist ? 5 : 0);
    return earlyKills * 3 + earlyFarm / 10 + firstBlood;
  }

  calculateLateGamePerformance(participant) {
    const lateKills = participant.challenges?.killsAfterHiddenWithAlly || 0;
    const teamFights = participant.challenges?.teamDamagePercentage || 0;
    return lateKills * 2 + teamFights * 50;
  }

  calculateTeamFightParticipation(participant) {
    const multikills = (participant.doubleKills || 0) * 2 + 
                       (participant.tripleKills || 0) * 4 + 
                       (participant.quadraKills || 0) * 8 + 
                       (participant.pentaKills || 0) * 16;
    const teamFightKills = participant.challenges?.killsInAllLanes || 0;
    return multikills + teamFightKills;
  }

  calculateComebackFactor(participant) {
    const goldDeficit = participant.challenges?.maxGoldDeficit || 0;
    const comeback = goldDeficit > 1000 ? Math.log(goldDeficit / 1000) : 0;
    return comeback;
  }

  // Traditional ELO calculation
  async calculateTraditionalElo(participants) {
    const method = this.config.calculationMethods?.traditional;
    if (!method || !method.enabled) return participants;

    // Load current ELOs
    for (const p of participants) {
      p.currentElo = await this.loadPlayerElo(this.getPlayerName(p));
    }

    // Calculate average game length and performance stats
    const avgGameLength = participants.reduce((sum, p) => sum + (p.timePlayed || 0), 0) / participants.length;

    // Group by teams
    const teams = {};
    participants.forEach(p => {
      if (!teams[p.teamId]) teams[p.teamId] = [];
      teams[p.teamId].push(p);
    });

    const teamIds = Object.keys(teams);
    if (teamIds.length !== 2) {
      console.warn('Expected 2 teams, found:', teamIds.length);
      return participants;
    }

    const team1 = teams[teamIds[0]];
    const team2 = teams[teamIds[1]];

    // Calculate team averages
    const avgEloTeam1 = team1.reduce((sum, p) => sum + p.currentElo, 0) / team1.length;
    const avgEloTeam2 = team2.reduce((sum, p) => sum + p.currentElo, 0) / team2.length;

    const expected1 = 1 / (1 + Math.pow(10, (avgEloTeam2 - avgEloTeam1) / 400));
    const expected2 = 1 - expected1;

    const actual1 = team1[0].win ? 1 : 0;
    const actual2 = 1 - actual1;

    const k = this.config.kFactor || 32;

    // Calculate ELO changes for each player
    [team1, team2].forEach((team, idx) => {
      const expected = idx === 0 ? expected1 : expected2;
      const actual = idx === 0 ? actual1 : actual2;
      
      team.forEach(p => {
        const performanceStats = this.calculatePerformanceStats(p, avgGameLength);
        
        // Calculate performance score
        let performanceScore = 0;
        const weights = this.config.performanceWeights;
        
        performanceScore += performanceStats.kda * weights.kda;
        performanceScore += (performanceStats.damagePerMinute / 500) * weights.damage;
        performanceScore += performanceStats.visionScorePerMinute * weights.vision;
        performanceScore += (performanceStats.objectiveParticipation / 10) * weights.objectives;
        performanceScore += (performanceStats.csPerMinute / 8) * weights.farm;
        performanceScore += (performanceStats.survivalRate / 10) * weights.survival;
        performanceScore += (performanceStats.utilityScore / 50) * weights.utility;

        p.performanceScore = performanceScore;

        // Calculate ELO change
        const baseChange = k * (actual - expected);
        const performanceModifier = (performanceScore - 1) * method.maxPerformanceBonus * method.performanceWeight;
        const totalChange = baseChange * method.teamResultWeight + performanceModifier;

        p.traditionalEloChange = Math.round(totalChange);
        p.traditionalNewElo = Math.round(p.currentElo + p.traditionalEloChange);
      });
    });

    return participants;
  }

  // Hybrid ELO calculation
  async calculateHybridElo(participants) {
    const method = this.config.calculationMethods?.hybrid;
    if (!method || !method.enabled) return participants;

    // Load current ELOs
    for (const p of participants) {
      if (!p.currentElo) {
        p.currentElo = await this.loadPlayerElo(this.getPlayerName(p));
      }
    }

    const avgGameLength = participants.reduce((sum, p) => sum + (p.timePlayed || 0), 0) / participants.length;

    participants.forEach(p => {
      const performanceStats = this.calculatePerformanceStats(p, avgGameLength);
      
      // Calculate performance score
      let performanceScore = 0;
      const weights = this.config.performanceWeights;
      
      performanceScore += performanceStats.kda * weights.kda;
      performanceScore += (performanceStats.damagePerMinute / 500) * weights.damage;
      performanceScore += performanceStats.visionScorePerMinute * weights.vision;
      performanceScore += (performanceStats.objectiveParticipation / 10) * weights.objectives;
      performanceScore += (performanceStats.csPerMinute / 8) * weights.farm;
      performanceScore += (performanceStats.survivalRate / 10) * weights.survival;
      performanceScore += (performanceStats.utilityScore / 50) * weights.utility;

      p.performanceScore = performanceScore;

      // Base ELO change
      let eloChange = p.win ? method.baseEloChange : -method.baseEloChange;

      // Apply performance multiplier
      const performanceMultiplier = (performanceScore - 1) * method.performanceMultiplier;
      
      if (p.win && performanceScore < 0.8) {
        // Poor win performance
        eloChange *= method.winBonusReduction;
      } else if (!p.win && performanceScore > 1.2) {
        // Good loss performance
        eloChange *= method.lossPenaltyReduction;
      }
      
      eloChange += performanceMultiplier;

      p.hybridEloChange = Math.round(eloChange);
      p.hybridNewElo = Math.round(p.currentElo + p.hybridEloChange);
    });

    return participants;
  }

  // Main calculation function
  async calculateAllEloMethods(participants) {
    // Validate participants
    participants.forEach((p, idx) => {
      if (!this.validateParticipant(p)) {
        console.warn(`Invalid participant data at index ${idx}, continuing anyway`);
      }
    });

    // Run all enabled methods
    await this.calculateTraditionalElo(participants);
    await this.calculateHybridElo(participants);

    return participants;
  }

  // Save player stats to database
  async savePlayerStats(gameId, participants) {
    for (const participant of participants) {
      const name = this.getPlayerName(participant);
      
      // Load existing stats or create new
      let stats = await database.getPlayer(name) || {
        totalKills: 0,
        totalAssists: 0,
        totalDeaths: 0,
        totalGold: 0,
        totalWins: 0,
        totalLosses: 0,
        games: 0,
        elo: this.config.baseElo,
        eloHistory: [],
        performanceHistory: []
      };

      const oldElo = stats.elo ?? this.config.baseElo;

      // Determine which ELO to use (priority: hybrid > traditional)
      let newElo = oldElo;
      let method = 'none';
      let eloChange = 0;

      if (this.config.calculationMethods?.hybrid?.enabled && participant.hybridNewElo !== undefined) {
        newElo = participant.hybridNewElo;
        eloChange = participant.hybridEloChange;
        method = 'hybrid';
      } else if (this.config.calculationMethods?.traditional?.enabled && participant.traditionalNewElo !== undefined) {
        newElo = participant.traditionalNewElo;
        eloChange = participant.traditionalEloChange;
        method = 'traditional';
      }

      // Update aggregated stats
      stats.totalKills += participant.kills ?? 0;
      stats.totalAssists += participant.assists ?? 0;
      stats.totalDeaths += participant.deaths ?? 0;
      stats.totalGold += participant.goldEarned ?? 0;
      stats.totalWins += participant.win ? 1 : 0;
      stats.totalLosses += participant.win ? 0 : 1;
      stats.games += 1;
      stats.elo = newElo;
      stats.avgKills = stats.totalKills / stats.games;
      stats.avgAssists = stats.totalAssists / stats.games;
      stats.avgDeaths = stats.totalDeaths / stats.games;
      stats.avgGold = stats.totalGold / stats.games;
      stats.winLoss = `${stats.totalWins}:${stats.totalLosses}`;

      // Add to history
      if (!stats.eloHistory) stats.eloHistory = [];
      if (!stats.performanceHistory) stats.performanceHistory = [];

      stats.eloHistory.push({
        gameId,
        oldElo,
        newElo,
        change: eloChange,
        method,
        timestamp: new Date().toISOString()
      });

      stats.performanceHistory.push({
        gameId,
        performanceScore: participant.performanceScore,
        role: this.getRole(participant),
        win: participant.win,
        timestamp: new Date().toISOString()
      });

      // Keep only last 50 entries
      if (stats.eloHistory.length > 50) stats.eloHistory = stats.eloHistory.slice(-50);
      if (stats.performanceHistory.length > 50) stats.performanceHistory = stats.performanceHistory.slice(-50);

      // Save to database
      await database.savePlayer({ name, ...stats });

      // Log ELO change
      const diff = eloChange;
      const colorStart = diff > 0 ? '\x1b[32m' : diff < 0 ? '\x1b[31m' : '\x1b[37m';
      const colorEnd = '\x1b[0m';
      const sign = diff > 0 ? '+' : '';
      console.log(`${name} [${method}] ELO: ${oldElo} -> ${newElo} (${colorStart}${sign}${diff}${colorEnd})`);

      // Append to log file
      const timestamp = fileManager.formatTimestamp();
      fileManager.appendToLog(`${timestamp},${name},${oldElo},${newElo},${method}`);
    }
  }

  // Process a single game
  async processGame(gameId) {
    try {
      const files = fileManager.getParticipantFiles(gameId);
      const participants = files.map(file => {
        const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
        return data;
      });

      console.log(`Processing ${participants.length} participants for game ${gameId}...`);

      // Calculate ELO using all methods
      const updatedParticipants = await this.calculateAllEloMethods(participants);

      // Save updated stats to database
      await this.savePlayerStats(gameId, updatedParticipants);

      // Save game data to database
      await database.saveGame({
        gameId,
        participants: updatedParticipants.map(p => ({
          name: this.getPlayerName(p),
          champion: p.championName,
          kills: p.kills,
          deaths: p.deaths,
          assists: p.assists,
          win: p.win,
          performanceScore: p.performanceScore
        })),
        processedAt: new Date()
      });

      return updatedParticipants;
    } catch (error) {
      console.error(`Error processing game ${gameId}:`, error.message);
      throw error;
    }
  }

  // Process all games
  async processAllGames() {
    const gameDirectories = fileManager.getAllGameDirectories();
    
    for (const { gameId, path: gamePath, isLegacy } of gameDirectories) {
      console.log(`\n=== Processing Game ${gameId} ${isLegacy ? '(legacy)' : ''} ===`);
      try {
        await this.processGame(gameId);
      } catch (error) {
        console.error(`Error processing game ${gameId}:`, error.message);
      }
    }
  }

  // Compare ELO methods for a specific game
  async compareEloMethods(gameId) {
    // Enable all methods temporarily
    const originalConfig = { ...this.config.calculationMethods };
    
    this.config.calculationMethods.traditional.enabled = true;
    this.config.calculationMethods.hybrid.enabled = true;

    try {
      const participants = await this.processGame(gameId);
      
      console.log('\n=== ELO METHOD COMPARISON ===');
      participants.forEach(p => {
        const name = this.getPlayerName(p);
        console.log(`\n${name}:`);
        
        if (p.traditionalNewElo !== undefined) {
          const tDiff = p.traditionalEloChange;
          const tColor = tDiff > 0 ? '\x1b[32m' : tDiff < 0 ? '\x1b[31m' : '\x1b[37m';
          const tSign = tDiff > 0 ? '+' : '';
          const tEnd = '\x1b[0m';
          console.log(`  Traditional: ${p.traditionalNewElo} (${tColor}${tSign}${tDiff}${tEnd})`);
        }
        
        if (p.hybridNewElo !== undefined) {
          const hDiff = p.hybridEloChange;
          const hColor = hDiff > 0 ? '\x1b[32m' : hDiff < 0 ? '\x1b[31m' : '\x1b[37m';
          const hSign = hDiff > 0 ? '+' : '';
          const hEnd = '\x1b[0m';
          console.log(`  Hybrid: ${p.hybridNewElo} (${hColor}${hSign}${hDiff}${hEnd})`);
        }
      });
    } finally {
      // Restore original config
      this.config.calculationMethods = originalConfig;
    }
  }
}

export default new EloCalculator();
