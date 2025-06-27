# Enhanced ELO Calculation System

This system implements three different ELO calculation methods to provide flexibility in rating players based on different criteria.

## Available Calculation Methods

### 1. Traditional ELO with Performance Modifiers

- **File**: Uses `traditional` method in config
- **Description**: Classic team-based ELO with individual performance adjustments
- **How it works**:
  - Calculates expected win probability based on team average ELO
  - Applies base ELO change based on actual vs expected result
  - Adds performance modifiers based on individual stats (KDA, damage, vision, etc.)
  - All losing team members always lose ELO (never zero or positive), regardless of performance
  - Good for balanced team-focused rating with individual skill recognition

**Configuration**:

```json
"traditional": {
  "enabled": true/false,
  "performanceWeight": 0.4,     // How much performance affects ELO (0-1)
  "teamResultWeight": 0.6,      // How much team result affects ELO (0-1)
  "maxPerformanceBonus": 120,   // Max ELO gain from good performance
  "minPerformanceBonus": -80    // Max ELO loss from poor performance
}
```

### 2. Lane-Based Comparison System

- **File**: Uses `laneComparison` method in config
- **Description**: Compares players primarily against their lane opponents
- **How it works**:
  - Groups players by position (TOP, JUNGLE, MIDDLE, BOTTOM, UTILITY)
  - Calculates performance scores based on role-specific priorities
  - Ranks players within their lane and awards/penalizes based on relative performance
  - Combines lane performance with team result and individual stats
  - All losing team members always lose ELO (never zero or positive), regardless of performance
  - Great for role-specific skill evaluation

**Configuration**:

```json
"laneComparison": {
  "enabled": true/false,
  "laneWeight": 0.5,        // Weight of lane opponent comparison
  "teamWeight": 0.3,        // Weight of team performance
  "individualWeight": 0.2,  // Weight of individual stats
  "maxLaneBonus": 80,       // Max ELO from lane performance
  "maxTeamBonus": 60,       // Max ELO from team result
  "maxIndividualBonus": 40  // Max ELO from individual performance
}
```

### 3. Hybrid Performance-Based System

- **File**: Uses `hybrid` method in config
- **Description**: Performance-first system that guarantees wins always give positive ELO and losses always give negative ELO
- **How it works**:
  - **WINS always give positive ELO**: Base amount reduced if you got carried, increased if you performed well
  - **LOSSES always give negative ELO**: Base amount reduced if you played well, increased if you performed poorly
  - All losing team members always lose ELO (never zero or positive), regardless of performance
  - Minimum win gain: +5 ELO (even if carried)
  - Minimum loss penalty: -5 ELO (even if you played well)
  - Perfect for individual skill recognition while maintaining win/loss importance

> **Recommended Default:** The Hybrid method is the default and recommended for most use cases. It ensures wins always give positive ELO and losses always give negative ELO, with the amount based on performance.

**Configuration**:

```json
"hybrid": {
  "enabled": true/false,
  "baseEloChange": 25,          // Base ELO change (wins: +25, losses: -25)
  "performanceMultiplier": 1.5, // Additional ELO based on performance
  "winBonusReduction": 0.4,     // Poor performance wins: 25 * 0.4 = +10 minimum
  "lossPenaltyReduction": 0.4   // Good performance losses: 25 * 0.4 = -10 minimum
}
```

## Performance Stats Calculated

The system evaluates players across multiple dimensions:

- **KDA**: Kill/Death/Assist ratio and raw performance
- **Damage**: Damage per minute to champions
- **Vision**: Vision score per minute (role-adjusted)
- **Farm**: CS per minute (role-relevant)
- **Objectives**: Dragon/Baron/Tower participation
- **Survival**: Death frequency and positioning
- **Utility**: Healing/shielding/crowd control
- **Early Game**: Performance in first 10-15 minutes
- **Late Game**: Performance in team fights and late game
- **Lane Performance**: Direct comparison with lane opponents

## Lane-Specific Priorities

Different roles are evaluated with different stat priorities:

- **TOP**: Damage (30%), Farm (25%), Survival (20%), Objectives (15%), KDA (10%)
- **JUNGLE**: Objectives (35%), KDA (25%), Vision (20%), Farm (15%), Utility (5%)
- **MIDDLE**: Damage (35%), KDA (25%), Farm (20%), Objectives (15%), Survival (5%)
- **BOTTOM**: Damage (40%), Farm (25%), KDA (20%), Survival (10%), Objectives (5%)
- **UTILITY**: Vision (35%), Utility (25%), KDA (20%), Survival (15%), Objectives (5%)

## Usage

### Single Game Analysis

```bash
node elo-enhanced.js single <gameId>
```

### All Games

```bash
node elo-enhanced.js all
```

### Method Comparison

```bash
node elo-enhanced.js compare [gameId]
```

## Configuration

Edit `elo-config.jsonc` to:

- Enable/disable specific calculation methods
- Adjust weights and multipliers
- Modify role-specific priorities
- Set maximum ELO changes

## Example Results

From the test game, here's how the different methods rated the same players:

**kadeem alford** (Strong performer):

- Traditional: +132 (Team win + excellent individual performance)
- Lane Comparison: +89 (Dominated his lane matchup)
- Hybrid: +29 (Good performance in winning game)

**sublimeSquid** (Mixed performance, on losing team):

- Traditional: -1 (Always negative for losers)
- Lane Comparison: -1 (Always negative for losers)
- Hybrid: -20 (Always negative for losers)

This shows how each method captures different aspects of player performance and can be used based on what you want to emphasize in your rating system.
