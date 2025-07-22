import fetch from 'node-fetch';
import dotenv from 'dotenv';
import database from '../database/mongodb.js';
import fileManager from '../utils/fileManager.js';

dotenv.config();

class MatchFetcher {
  constructor() {
    this.apiKey = process.env.RIOT_API_KEY;
    if (!this.apiKey) {
      throw new Error('Missing RIOT_API_KEY in environment');
    }

    this.regions = {
      oce: { platform: 'oc1', match: 'sea' },
      na: { platform: 'na1', match: 'americas' },
      euw: { platform: 'euw1', match: 'europe' }
    };

    this.region = this.regions.oce.platform;
    this.matchRegion = this.regions.oce.match;
  }

  // Network request with retry logic
  async riotFetch(url, tries = 3) {
    for (let attempt = 1; attempt <= tries; attempt++) {
      const res = await fetch(url, {
        headers: { 'X-Riot-Token': this.apiKey },
        timeout: 10000
      });

      if (res.status === 429 && attempt < tries) {
        const wait = (+res.headers.get('Retry-After') || 1) * 1000;
        console.log(`Rate limited, waiting ${wait}ms...`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status} ${res.statusText}: ${text}`);
      }

      return res.json();
    }
  }

  // API wrapper methods
  async getSummonerPUUID(summonerName) {
    const url = `https://${this.region}.api.riotgames.com/lol/summoner/v4/summoners/by-name/${encodeURIComponent(summonerName)}`;
    return (await this.riotFetch(url)).puuid;
  }

  async getSummonerByPUUID(puuid) {
    const url = `https://${this.region}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`;
    return this.riotFetch(url);
  }

  async getPUUIDByRiotId(gameName, tagLine) {
    const url = `https://asia.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
    return (await this.riotFetch(url)).puuid;
  }

  async getLastMatchIds(puuid, count = 3) {
    const url = `https://${this.matchRegion}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=${count}`;
    return this.riotFetch(url);
  }

  async getMatchDetails(matchId) {
    const url = `https://${this.matchRegion}.api.riotgames.com/lol/match/v5/matches/${matchId}`;
    return this.riotFetch(url);
  }

  // File operations
  sanitizeFilename(name) {
    return fileManager.sanitizeFilename(name);
  }

  async saveMatchData(match) {
    const gameId = match.info.gameId || match.metadata.matchId || 'unknown_game';
    const d = new Date(match.info.gameStartTimestamp);
    const stamp = d.toISOString().slice(2, 16).replace(/[:T]/g, '-');
    const filename = `Match_${stamp}_${match.metadata.matchId}.json`;

    // Save to matches folder
    const filePath = fileManager.saveMatchData(match, filename);

    // Save to database
    await database.saveMatch({
      matchId: match.metadata.matchId,
      gameId,
      matchData: match,
      filename,
      gameMode: match.info.gameMode,
      gameDuration: match.info.gameDuration,
      gameStartTimestamp: match.info.gameStartTimestamp,
      participants: match.info.participants.map(p => ({
        puuid: p.puuid,
        summonerName: p.summonerName,
        riotIdGameName: p.riotIdGameName,
        riotIdTagline: p.riotIdTagline,
        championName: p.championName,
        teamId: p.teamId,
        win: p.win
      }))
    });

    return { filePath, filename, gameId };
  }

  async saveAllParticipants(match) {
    if (!match?.info?.participants) return;

    const gameId = match.info.gameId || match.metadata.matchId || 'unknown_game';
    
    // Save participants to games folder
    fileManager.saveGameParticipants(gameId, match.info.participants);

    console.log(`Saved ${match.info.participants.length} participants for game ${gameId}`);
    return gameId;
  }

  // Format match info for display
  formatMatchData(match, summonerName) {
    if (!match?.info?.participants?.length) {
      return 'Invalid match data: No participants.';
    }

    const participant = match.info.participants.find(p => {
      if (typeof p.riotIdGameName === 'string' && typeof summonerName === 'string') {
        return p.riotIdGameName.toLowerCase() === summonerName.toLowerCase();
      } else if (typeof p.summonerName === 'string' && typeof summonerName === 'string') {
        return p.summonerName.toLowerCase() === summonerName.toLowerCase();
      }
      return false;
    });

    if (!participant) {
      const first = match.info.participants[0];
      return `No matching player found. Example: ${first.riotIdGameName || first.summonerName || 'unknown'} | Champion: ${first.championName} | K/D/A: ${first.kills}/${first.deaths}/${first.assists}`;
    }

    return `Last Match for ${participant.riotIdGameName || participant.summonerName}:
  Champion: ${participant.championName}
  K/D/A: ${participant.kills}/${participant.deaths}/${participant.assists}
  Win: ${participant.win}
  Game Mode: ${match.info.gameMode}
  Date: ${new Date(match.info.gameStartTimestamp).toLocaleString()}`;
  }

  // Main fetch function
  async fetchMatches(puuid, numGames = 3) {
    try {
      const summoner = await this.getSummonerByPUUID(puuid);
      const matchIds = await this.getLastMatchIds(puuid, numGames);

      const results = [];

      for (const matchId of matchIds) {
        console.log(`Fetching match ${matchId}...`);
        
        const match = await this.getMatchDetails(matchId);
        
        // Display match info
        const output = this.formatMatchData(match, summoner.name);
        console.log(output);

        // Save match data and participants
        const { filePath, filename, gameId } = await this.saveMatchData(match);
        await this.saveAllParticipants(match);

        console.log(`Match data saved to ${filename}`);
        
        results.push({
          matchId,
          gameId,
          filePath,
          filename,
          match
        });
      }

      return results;
    } catch (error) {
      console.error('Error fetching matches:', error.message);
      throw error;
    }
  }

  // Fetch by Riot ID
  async fetchMatchesByRiotId(gameName, tagLine, numGames = 3) {
    const puuid = await this.getPUUIDByRiotId(gameName, tagLine);
    return this.fetchMatches(puuid, numGames);
  }

  // Fetch by summoner name
  async fetchMatchesBySummonerName(summonerName, numGames = 3) {
    const puuid = await this.getSummonerPUUID(summonerName);
    return this.fetchMatches(puuid, numGames);
  }
}

export default new MatchFetcher();
