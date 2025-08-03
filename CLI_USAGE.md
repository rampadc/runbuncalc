# Pokémon Damage Calculator CLI Usage

This document explains how to use the `cli_calc.js` script to perform Pokémon damage calculations directly from your terminal.

## Overview

The `cli_calc.js` script allows you to calculate damage between two Pokémon, simulating attacks from both sides. It provides detailed results for both normal and critical hits, and can even load pre-defined Pokémon sets from in-game trainers. The output is provided in a structured JSON format.

## Prerequisites

*   Node.js installed on your system.
*   All project dependencies installed. Navigate to the `runbuncalc` directory in your terminal and run:
    ```bash
    npm install
    ```

## How to Run the CLI

The `cli_calc.js` file exports a function called `calculateDamageCLI`. You can run it using Node.js by providing a JavaScript object containing your calculation options.

The general way to run it is:

```bash
node -e 'require("./cli_calc").calculateDamageCLI({ /* YOUR_OPTIONS_OBJECT_HERE */ });'
```

Replace `/* YOUR_OPTIONS_OBJECT_HERE */` with the specific configuration for your calculation.

**Important Note on Trainer Data:**
The CLI loads trainer Pokémon sets from files like `runbuncalc/src/js/data/sets/genX.js`. These files define their data as global variables (e.g., `var SETDEX_SS = {...}`). For Node.js to read this data, the script uses a special `vm` module to evaluate these files. This setup is already handled within `cli_calc.js`.

## `calculateDamageCLI` Options

The `calculateDamageCLI` function expects a single JavaScript object with the following structure:

```javascript
{
    generation: Number, // REQUIRED: The Pokémon generation number (e.g., 9 for Scarlet/Violet, 8 for Sword/Shield).
    pokemon1: { // REQUIRED: Configuration for the first Pokémon
        name: String, // Species name (required if not loading from trainerPokemon)
        level: Number, // [Optional, default: 100]
        ability: String, // [Optional]
        item: String, // [Optional]
        nature: String, // [Optional, default: 'Serious']
        ivs: { // [Optional, default: {hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31}]
            hp: Number, atk: Number, def: Number, spa: Number, spd: Number, spe: Number
        },
        evs: { // [Optional, default: {hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0}]
            hp: Number, atk: Number, def: Number, spa: Number, spd: Number, spe: Number
        },
        boosts: { /* stat: level */ }, // [Optional, default: {}] e.g., {atk: 2} for +2 Attack
        curHP: Number, // [Optional] Current HP
        status: String, // [Optional, default: ''] e.g., 'Poison', 'Burn', 'Paralyzed', 'Badly Poisoned', 'Asleep', 'Frozen'
        isDynamaxed: Boolean, // [Optional, default: false]
        moves: [String], // [Optional] Array of move names. Overridden if trainerPokemon is used.
        trainerPokemon: { // [Optional] Load this Pokémon from a predefined trainer set
            speciesName: String, // The Pokémon species name (e.g., "Staryu", "Ampharos-Mega")
            trainerName: String, // The exact name of the trainer (e.g., "Fisherman Elliot", "Leader Wattson")
        }
    },
    pokemon2: { // REQUIRED: Configuration for the second Pokémon (same structure as pokemon1)
        name: String,
        level: Number,
        ability: String,
        item: String,
        nature: String,
        ivs: { hp: Number, atk: Number, def: Number, spa: Number, spd: Number, spe: Number },
        evs: { hp: Number, atk: Number, def: Number, spa: Number, spd: Number, spe: Number },
        boosts: { /* stat: level */ },
        curHP: Number,
        status: String,
        isDynamaxed: Boolean,
        moves: [String],
        trainerPokemon: {
            speciesName: String,
            trainerName: String,
        }
    },
    field: { // [Optional, default: {}] Details about the battle field conditions
        weather: String, // [Optional] e.g., 'Rain', 'Sun', 'Sand', 'Hail', 'Snow'
        terrain: String, // [Optional] e.g., 'Electric', 'Grassy', 'Misty', 'Psychic'
        isGravity: Boolean, // [Optional, default: false]
        isMagicRoom: Boolean, // [Optional, default: false]
        isWonderRoom: Boolean, // [Optional, default: false]
        isBeadsOfRuin: Boolean, // [Optional, default: false] Gen 9 Ruinous Abilities
        isTabletsOfRuin: Boolean, // [Optional, default: false] Gen 9 Ruinous Abilities
        isSwordOfRuin: Boolean, // [Optional, default: false] Gen 9 Ruinous Abilities
        isVesselOfRuin: Boolean, // [Optional, default: false] Gen 9 Ruinous Abilities
        pokemon1Side: { // [Optional, default: {}] Side conditions affecting Pokémon 1
            isSR: Boolean, // [Optional, default: false] Stealth Rock
            spikes: Number, // [Optional, default: 0] Spikes layers (0, 1, 2, 3)
            isReflect: Boolean, // [Optional, default: false]
            isLightScreen: Boolean, // [Optional, default: false]
            // ... other side conditions
        },
        pokemon2Side: { // [Optional, default: {}] Side conditions affecting Pokémon 2
            isSR: Boolean, // [Optional, default: false] Stealth Rock
            spikes: Number, // [Optional, default: 0] Spikes layers (0, 1, 2, 3)
            isReflect: Boolean, // [Optional, default: false]
            isLightScreen: Boolean, // [Optional, default: false]
            // ... other side conditions
        }
    }
}
```

## Output Format

The CLI will print a JSON object to standard output. The structure is as follows:

```json
{
  "generation": 9,
  "pokemon1": {
    "name": "Garchomp",
    "level": 100,
    "ability": "Rough Skin",
    "item": "Choice Band",
    "moves": [] // basic info, full moves calculated below
  },
  "pokemon2": {
    "name": "Corviknight",
    "level": 100,
    "ability": "Pressure",
    "item": "Leftovers",
    "moves": []
  },
  "pokemon1AttackingPokemon2": { // Results when Pokemon 1 attacks Pokemon 2
    "attacker": { "name": "Garchomp", "level": 100, "ability": "Rough Skin", "item": "Choice Band" },
    "defender": { "name": "Corviknight", "level": 100, "ability": "Pressure", "item": "Leftovers" },
    "moves": [
      {
        "moveName": "Dragon Claw",
        "normalHit": {
          "damageRange": [68, 81],
          "percentageRange": [17, 20.2],
          "koChance": "possible 6HKO after Stealth Rock and Leftovers recovery",
          "description": "31 Atk Choice Band Garchomp Dragon Claw vs. 31 HP / 31+ Def Corviknight: 68-81 (17 - 20.2%) -- possible 6HKO after Stealth Rock and Leftovers recovery"
        },
        "criticalHit": {
          "damageRange": [102, 121],
          "percentageRange": [25.5, 30.2],
          "koChance": "97.5% chance to 4HKO after Stealth Rock and Leftovers recovery",
          "description": "31 Atk Choice Band Garchomp Dragon Claw vs. 31 HP / 31+ Def Corviknight on a critical hit: 102-121 (25.5 - 30.2%) -- 97.5% chance to 4HKO after Stealth Rock and Leftovers recovery"
        }
      },
      // ... other moves from Pokemon 1
    ]
  },
  "pokemon2AttackingPokemon1": { // Results when Pokemon 2 attacks Pokemon 1
    "attacker": { "name": "Corviknight", "level": 100, "ability": "Pressure", "item": "Leftovers" },
    "defender": { "name": "Garchomp", "level": 100, "ability": "Rough Skin", "item": "Choice Band" },
    "moves": [
      {
        "moveName": "Brave Bird",
        "normalHit": { /* ... */ },
        "criticalHit": { /* ... */ }
      },
      // ... other moves from Pokemon 2
    ]
  }
}
```

### Handling No Moves / Immunities

*   If a Pokémon has no moves defined (either directly or from a trainer set), its attacking section will have a `message` field instead of `moves`.
*   If a move deals 0 damage due to immunity, extreme resistance, or is a status move (0 base power), its `damageRange` and `percentageRange` will be `[0, 0]`, and the `koChance` and `description` will reflect "No damaging effect" or "Immune".

## Examples

To run an example, copy the `node -e '...'` command and paste it into your terminal from the `runbuncalc` directory.

### Example 1: Two Custom Pokémon Attacking Each Other (Garchomp vs. Corviknight)

This example calculates the damage when a custom Garchomp attacks a custom Corviknight, and vice-versa, with Stealth Rock on Corviknight's side.

```bash
node -e 'require("./cli_calc").calculateDamageCLI({
    generation: 9, // Scarlet/Violet
    pokemon1: {
        name: "Garchomp",
        level: 100,
        ability: "Rough Skin",
        item: "Choice Band",
        nature: "Jolly",
        evs: { atk: 252, spe: 252 },
        ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
        moves: ["Dragon Claw", "Earthquake", "Stone Edge", "Swords Dance"]
    },
    pokemon2: {
        name: "Corviknight",
        level: 100,
        ability: "Pressure",
        item: "Leftovers",
        nature: "Impish",
        evs: { hp: 252, def: 252 },
        ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
        moves: ["Brave Bird", "Body Press", "Iron Defense", "Roost"]
    },
    field: {
        weather: null,
        terrain: null,
        pokemon1Side: { isSR: false, spikes: 0, isReflect: false, isLightScreen: false },
        pokemon2Side: { isSR: true, spikes: 0, isReflect: false, isLightScreen: false }
    }
});'
```

### Example 2: Using a Trainer's Pokémon for Pokémon 1 (Fisherman Elliot's Staryu vs. Snorlax)

This example loads "Fisherman Elliot"'s Staryu from Generation 8 set data as `pokemon1`, and calculates its moves against a custom Snorlax. It will also show Snorlax's moves against Staryu.

```bash
node -e 'require("./cli_calc").calculateDamageCLI({
    generation: 8, // Gen 8 for Fisherman Elliot
    pokemon1: {
        trainerPokemon: {
            speciesName: "Staryu",
            trainerName: "Fisherman Elliot",
        },
    },
    pokemon2: {
        name: "Snorlax", 
        level: 13, 
        ability: "Thick Fat",
        item: "Leftovers",
        nature: "Impish",
        evs: { hp: 252, def: 252 },
        ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
        moves: ["Body Slam", "Curse", "Rest"]
    },
    field: {} // Default field
});'
```

### Example 3: Using a Trainer's Pokémon for Pokémon 2 (Excadrill vs. Leader Wattson's Ampharos-Mega)

This example pits a custom Excadrill against "Leader Wattson"'s Ampharos-Mega from Generation 8 set data (as `pokemon2`), simulating attacks from both sides.

```bash
node -e 'require("./cli_calc").calculateDamageCLI({
    generation: 8,
    pokemon1: {
        name: "Excadrill",
        level: 100,
        ability: "Mold Breaker",
        item: "Choice Band",
        nature: "Jolly",
        evs: { atk: 252, spe: 252 },
        ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
        moves: ["Earthquake", "Iron Head", "Rock Slide"]
    },
    pokemon2: {
        trainerPokemon: {
            speciesName: "Ampharos-Mega",
            trainerName: "Leader Wattson",
        },
    },
    field: {}
});'
```

This documentation should provide a clear guide on how to use the `cli_calc.js` tool.
