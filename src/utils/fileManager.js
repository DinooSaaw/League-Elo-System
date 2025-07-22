import fs from 'fs';
import path from 'path';

export class FileManager {
  constructor() {
    this.gamesDir = path.join(process.cwd(), 'games');
    this.matchesDir = path.join(process.cwd(), 'matches');
    this.playerDir = path.join(process.cwd(), 'player'); // Legacy
  }

  // Ensure directories exist
  ensureDirectories() {
    if (!fs.existsSync(this.gamesDir)) {
      fs.mkdirSync(this.gamesDir, { recursive: true });
    }
    if (!fs.existsSync(this.matchesDir)) {
      fs.mkdirSync(this.matchesDir, { recursive: true });
    }
  }

  // Game file operations
  getGameDirectory(gameId) {
    return path.join(this.gamesDir, `game_${gameId}`);
  }

  getParticipantFiles(gameId) {
    const dir = this.getGameDirectory(gameId);
    if (!fs.existsSync(dir)) {
      throw new Error(`Game folder not found: ${dir}`);
    }
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => path.join(dir, f));
  }

  saveGameParticipants(gameId, participants) {
    const dir = this.getGameDirectory(gameId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    for (const participant of participants) {
      const name = this.getPlayerName(participant);
      const filename = this.sanitizeFilename(name);
      const filePath = path.join(dir, `${filename}.json`);
      fs.writeFileSync(filePath, JSON.stringify(participant, null, 2));
    }
  }

  // Match file operations
  saveMatchData(matchData, filename) {
    this.ensureDirectories();
    const filePath = path.join(this.matchesDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(matchData, null, 2));
    return filePath;
  }

  getMatchFiles() {
    if (!fs.existsSync(this.matchesDir)) {
      return [];
    }
    return fs.readdirSync(this.matchesDir)
      .filter(f => f.endsWith('.json'))
      .map(f => path.join(this.matchesDir, f));
  }

  // Legacy operations for migration
  getAllGameDirectories() {
    const cwd = process.cwd();
    // Check both legacy location and new games folder
    const legacyDirs = fs.readdirSync(cwd).filter(f => /^game_\d+$/.test(f));
    
    let gamesDirs = [];
    if (fs.existsSync(this.gamesDir)) {
      gamesDirs = fs.readdirSync(this.gamesDir).filter(f => /^game_\d+$/.test(f));
    }

    // Return both with full paths
    return [
      ...legacyDirs.map(dir => ({ path: path.join(cwd, dir), gameId: dir.replace('game_', ''), isLegacy: true })),
      ...gamesDirs.map(dir => ({ path: path.join(this.gamesDir, dir), gameId: dir.replace('game_', ''), isLegacy: false }))
    ];
  }

  // Move legacy game folders to new structure
  migrateLegacyGameFolders() {
    const cwd = process.cwd();
    const legacyDirs = fs.readdirSync(cwd).filter(f => /^game_\d+$/.test(f));
    
    this.ensureDirectories();
    
    for (const dir of legacyDirs) {
      const oldPath = path.join(cwd, dir);
      const newPath = path.join(this.gamesDir, dir);
      
      try {
        fs.renameSync(oldPath, newPath);
        console.log(`Moved ${dir} to games folder`);
      } catch (error) {
        console.error(`Failed to move ${dir}:`, error.message);
      }
    }
  }

  // Move legacy match files to new structure
  migrateLegacyMatchFiles() {
    const cwd = process.cwd();
    const matchFiles = fs.readdirSync(cwd).filter(f => f.startsWith('Match_') && f.endsWith('.json'));
    
    this.ensureDirectories();
    
    for (const file of matchFiles) {
      const oldPath = path.join(cwd, file);
      const newPath = path.join(this.matchesDir, file);
      
      try {
        fs.renameSync(oldPath, newPath);
        console.log(`Moved ${file} to matches folder`);
      } catch (error) {
        console.error(`Failed to move ${file}:`, error.message);
      }
    }
  }

  // Utility functions
  getPlayerName(participant) {
    return (participant.riotIdGameName && participant.riotIdGameName.trim()) ||
           (participant.summonerName && participant.summonerName.trim()) ||
           (participant.riotIdTagline && participant.riotIdTagline.trim()) ||
           'unknown';
  }

  sanitizeFilename(name) {
    return name.replace(/[^a-zA-Z0-9#_\-]/g, '_');
  }

  // Logging operations
  appendToLog(entry) {
    const logPath = path.join(process.cwd(), 'elo-log.csv');
    fs.appendFileSync(logPath, entry + '\n');
  }

  formatTimestamp() {
    const now = new Date();
    let hours = now.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;
    return `${now.getFullYear().toString().slice(2)}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}-${hours}-${String(now.getMinutes()).padStart(2,'0')}-${ampm}`;
  }
}

export default new FileManager();
