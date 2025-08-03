// This file will contain the CLI function for Pokémon damage calculation.

// Import necessary classes from the calculation engine
// Assuming '@smogon/calc' module is available in node_modules
const {
	Generations,
	Pokemon,
	Move,
	Field,
	calculate,
} = require("@smogon/calc");

// Node.js built-in modules for file system operations and path manipulation
const fs = require("fs");
const path = require("path");
// Node.js built-in module for vm, for safer evaluation of non-module JS files
const vm = require("vm");

/**
 * Helper to dynamically load and evaluate old-style setdex files.
 * These files (e.g., gen8.js) typically define global variables (like `var SETDEX_SS = {...}`)
 * rather than using `module.exports`. This function executes the file content
 * in a sandboxed VM context to capture that variable.
 * @param {number} genNum - The generation number (e.g., 8 for gen8.js).
 * @param {string} varName - The name of the global variable to extract (e.g., 'SETDEX_SS').
 * @returns {object} The loaded setdex object for the specified generation.
 * @throws {Error} If the file is not found or the variable is not defined within it.
 */
function loadSetdex(genNum, varName) {
	const filePath = path.join(__dirname, `src/js/data/sets/gen${genNum}.js`);

	if (!fs.existsSync(filePath)) {
		throw new Error(
			`Setdex file for Generation ${genNum} not found at ${filePath}`,
		);
	}
	const fileContent = fs.readFileSync(filePath, "utf8");

	// Use a limited sandbox to evaluate the file content safely
	const sandbox = {};
	const script = new vm.Script(fileContent);
	try {
		script.runInNewContext(sandbox);
	} catch (evalError) {
		throw new Error(
			`Error evaluating setdex file ${filePath}: ${evalError.message}`,
		);
	}

	if (!sandbox[varName]) {
		throw new Error(
			`Variable \'${varName}\' not found in ${filePath} after evaluation.`,
		);
	}

	return sandbox[varName];
}

// Dynamically load Pokémon set data for each generation
// This needs to be done once when the script is loaded.
const SETDEX_BY_GEN = {
	1: loadSetdex(1, "SETDEX_RBY"),
	2: loadSetdex(2, "SETDEX_GSC"),
	3: loadSetdex(3, "SETDEX_ADV"),
	4: loadSetdex(4, "SETDEX_DPP"),
	5: loadSetdex(5, "SETDEX_BW"),
	6: loadSetdex(6, "SETDEX_XY"),
	7: loadSetdex(7, "SETDEX_SM"),
	8: loadSetdex(8, "SETDEX_SS"),
	9: loadSetdex(9, "SETDEX_SV"),
};

/**
 * Helper function to build a Pokémon options object, optionally loading from a trainer set.
 * @param {number} genNum - The Pokémon generation number.
 * @param {object} rawPokemonOptions - The raw Pokémon options provided by the user.
 * @param {object} defaultIVs - Default IVs to merge.
 * @param {object} defaultEVs - Default EVs to merge.
 * @returns {object} A complete Pokémon options object ready for the Pokemon constructor.
 * @throws {Error} If Pokémon name is missing or trainer set not found.
 */
function getPokemonOptions(genNum, rawPokemonOptions, defaultIVs, defaultEVs) {
	let pokemonOptions = {
		name: rawPokemonOptions?.name, // Name might be undefined if trainerPokemon is used
		level: rawPokemonOptions?.level || 100,
		ability: rawPokemonOptions?.ability,
		item: rawPokemonOptions?.item,
		nature: rawPokemonOptions?.nature || "Serious",
		ivs: { ...defaultIVs, ...rawPokemonOptions?.ivs },
		evs: { ...defaultEVs, ...rawPokemonOptions?.evs },
		boosts: rawPokemonOptions?.boosts || {},
		curHP: rawPokemonOptions?.curHP,
		status: rawPokemonOptions?.status || "",
		isDynamaxed: rawPokemonOptions?.isDynamaxed || false,
		moves: rawPokemonOptions?.moves || [], // Initial moves from direct input
	};

	if (rawPokemonOptions?.trainerPokemon) {
		const { speciesName, trainerName } = rawPokemonOptions.trainerPokemon;

		const setdex = SETDEX_BY_GEN[genNum];
		if (!setdex) {
			throw new Error(
				`Pokémon set data not found for Generation ${genNum}. Please ensure the data files (e.g., gen8.js) correctly export their SETDEX_GENX variable.`,
			);
		}

		const speciesSets = setdex[speciesName];
		if (!speciesSets) {
			throw new Error(
				`Pokémon species '${speciesName}' not found in sets for Generation ${genNum}.`,
			);
		}

		let trainerSet = null;
		// Some set names include trainer names, others might be just the trainer's name.
		// Iterate through all sets for the species to find the one by trainerName.
		// Prioritize exact match or inclusion, then try by first word of trainer name.
		for (const setName in speciesSets) {
			const currentSet = speciesSets[setName];
			const trainerNameRegex = new RegExp(`\\b${trainerName}\\b`, "i");
			// Check if the set's name contains the full trainerName or if currentSet.trainer property matches
			if (
				trainerNameRegex.test(setName) ||
				(currentSet.trainer && trainerNameRegex.test(currentSet.trainer))
			) {
				trainerSet = currentSet;
				break; // Found a strong match, use this one
			}
			// Fallback: if no direct match, check if the first word of the set name matches the trainer's first name
			// This is a weaker match, only consider if no stronger match is found later.
			const setNameFirstWord = setName.split(" ")[0];
			const trainerNameFirstWord = trainerName.split(" ")[0];
			if (!trainerSet && setNameFirstWord === trainerNameFirstWord) {
				trainerSet = currentSet; // This is a candidate, but continue searching for better match
			}
		}

		// Final fallback: sometimes the trainerName itself is the key directly
		if (!trainerSet && speciesSets[trainerName]) {
			trainerSet = speciesSets[trainerName];
		}

		if (!trainerSet) {
			throw new Error(
				`Trainer '${trainerName}' with Pokémon '${speciesName}' not found in sets for Generation ${genNum}.`,
			);
		}

		// Apply trainer set properties to pokemonOptions
		pokemonOptions.name = speciesName; // Ensure the name is correctly set from speciesName
		pokemonOptions.level = trainerSet.level || 100;
		pokemonOptions.ability = trainerSet.ability;
		pokemonOptions.item = trainerSet.item;
		pokemonOptions.nature = trainerSet.nature || "Serious";
		pokemonOptions.ivs = { ...defaultIVs, ...trainerSet.ivs }; // Merge set IVs with defaults
		pokemonOptions.evs = { ...defaultEVs, ...trainerSet.evs }; // Merge set EVs with defaults

		// boosts, curHP, status, isDynamaxed are typically not in trainer sets,
		// so we keep whatever was initially provided in rawPokemonOptions or their defaults.
		pokemonOptions.boosts = pokemonOptions.boosts || {};
		pokemonOptions.curHP = pokemonOptions.curHP;
		pokemonOptions.status = pokemonOptions.status || "";
		pokemonOptions.isDynamaxed = pokemonOptions.isDynamaxed || false;

		pokemonOptions.moves = trainerSet.moves || pokemonOptions.moves; // Trainer moves override
	}

	if (!pokemonOptions.name) {
		throw new Error(
			"Pokémon name is required. Please specify 'name' or 'trainerPokemon.speciesName'.",
		);
	}

	return pokemonOptions;
}

/**
 * Helper function to calculate and format results for a given critical hit status.
 * @param {Generation} gen - The current generation object.
 * @param {Pokemon} attacker - The attacking Pokémon instance.
 * @param {Pokemon} defender - The defending Pokémon instance.
 * @param {string} moveName - The name of the move.
 * @param {Field} field - The battle field instance.
 * @param {boolean} isCrit - True for critical hit, false for normal.
 * @returns {object} Formatted calculation results.
 */
const getFormattedResult = (
	gen,
	attacker,
	defender,
	moveName,
	field,
	isCrit,
) => {
	let minDamage,
		maxDamage,
		minPercentage,
		maxPercentage,
		koChanceText,
		descriptionText;

	// Create a new move object with the specified critical hit status
	const move = new Move(gen, moveName, { isCrit: isCrit });

	// If the move has 0 base power, it's typically a status move and deals no damage.
	// Critical hits are not applicable to non-damaging moves.
	if (move.bp === 0) {
		minDamage = 0;
		maxDamage = 0;
		minPercentage = 0;
		maxPercentage = 0;
		koChanceText = "No damaging effect";
		descriptionText = `${move.name} is a non-damaging move.`;
		if (isCrit) {
			descriptionText = `${move.name} is a non-damaging move, so it cannot critically hit.`;
		}
	} else {
		try {
			const currentResult = calculate(
				gen, // Pass the generation object first
				attacker,
				defender,
				move,
				field,
			);

			const [dmgMin, dmgMax] = currentResult.range();

			// Check if max damage is 0 (immune, no effect, or highly resisted)
			if (dmgMax === 0) {
				minDamage = 0;
				maxDamage = 0;
				minPercentage = 0;
				maxPercentage = 0;
				koChanceText = "Immune / No damaging effect";
				descriptionText = `${move.name} had no damaging effect on ${defender.name}.`;
			} else {
				minDamage = dmgMin;
				maxDamage = dmgMax;
				minPercentage =
					Math.floor((minDamage * 1000) / defender.maxHP()) / 10;
				maxPercentage =
					Math.floor((maxDamage * 1000) / defender.maxHP()) / 10;
				koChanceText = currentResult.kochance().text;
				descriptionText = currentResult.desc();
			}
		} catch (calcError) {
			// Fallback for unexpected errors from currentResult.range() or similar
			minDamage = 0;
			maxDamage = 0;
			minPercentage = 0;
			maxPercentage = 0;
			koChanceText = "Calculation Error / No effect";
			descriptionText = `${move.name} could not be calculated: ${calcError.message}`;
		}
	}

	return {
		damageRange: [minDamage, maxDamage],
		percentageRange: [minPercentage, maxPercentage],
		koChance: koChanceText,
		description: descriptionText,
	};
};

/**
 * Performs Pokémon damage calculations between two Pokémon in both directions (Pokemon 1 attacking Pokemon 2, and vice-versa).
 * Output results in JSON format, including both normal and critical hit calculations for each move.
 *
 * @param {object} options - Options for the calculation.
 * @param {number} options.generation - The Pokémon generation number (e.g., 9 for Scarlet/Violet).
 * @param {object} options.pokemon1 - Details for the first Pokémon.
 * @param {string} [options.pokemon1.name] - Pokémon 1 species name. Required unless `trainerPokemon` is used.
 * @param {number} [options.pokemon1.level=100] - Pokémon 1's level.
 * @param {string} [options.pokemon1.ability] - Pokémon 1's ability.
 * @param {string} [options.pokemon1.item] - Pokémon 1's item.
 * @param {string} [options.pokemon1.nature=\'Serious\'] - Pokémon 1's nature.
 * @param {object} [options.pokemon1.ivs={hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31}] - Pokémon 1's IVs for all 6 stats.
 * @param {object} [options.pokemon1.evs={hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0}] - Pokémon 1's EVs for all 6 stats.
 * @param {object} [options.pokemon1.boosts={}] - Pokémon 1's stat boosts.
 * @param {number} [options.pokemon1.curHP] - Pokémon 1's current HP.
 * @param {string} [options.pokemon1.status=\'\'] - Pokémon 1's status condition.
 * @param {boolean} [options.pokemon1.isDynamaxed=false] - Whether Pokémon 1 is Dynamaxed.
 * @param {string[]} [options.pokemon1.moves] - An array of move names for Pokémon 1. Overridden if `trainerPokemon` is used.
 * @param {object} [options.pokemon1.trainerPokemon] - Use a Pokémon set for Pokémon 1 from a specific trainer.
 * @param {string} options.pokemon1.trainerPokemon.speciesName - The Pokémon species name (e.g., "Staryu").
 * @param {string} options.pokemon1.trainerPokemon.trainerName - The name of the trainer (e.g., "Fisherman Elliot").
 *
 * @param {object} options.pokemon2 - Details for the second Pokémon.
 * @param {string} [options.pokemon2.name] - Pokémon 2 species name. Required unless `trainerPokemon` is used.
 * @param {number} [options.pokemon2.level=100] - Pokémon 2's level.
 * @param {string} [options.pokemon2.ability] - Pokémon 2's ability.
 * @param {string} [options.pokemon2.item] - Pokémon 2's item.
 * @param {string} [options.pokemon2.nature=\'Serious\'] - Pokémon 2's nature.
 * @param {object} [options.pokemon2.ivs={hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31}] - Pokémon 2's IVs for all 6 stats.
 * @param {object} [options.pokemon2.evs={hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0}] - Pokémon 2's EVs for all 6 stats.
 * @param {object} [options.pokemon2.boosts={}] - Pokémon 2's stat boosts.
 * @param {number} [options.pokemon2.curHP] - Pokémon 2's current HP.
 * @param {string} [options.pokemon2.status=\'\'] - Pokémon 2's status condition.
 * @param {boolean} [options.pokemon2.isDynamaxed=false] - Whether Pokémon 2 is Dynamaxed.
 * @param {string[]} [options.pokemon2.moves] - An array of move names for Pokémon 2. Overridden if `trainerPokemon` is used.
 * @param {object} [options.pokemon2.trainerPokemon] - Use a Pokémon set for Pokémon 2 from a specific trainer.
 * @param {string} options.pokemon2.trainerPokemon.speciesName - The Pokémon species name (e.g., "Staryu").
 * @param {string} options.pokemon2.trainerPokemon.trainerName - The name of the trainer (e.g., "Fisherman Elliot").
 *
 * @param {object} [options.field={}] - Details for the battle field.
 * @param {string} [options.field.weather] - Current weather (e.g., \'Rain\', \'Sun\').
 * @param {string} [options.field.terrain] - Current terrain (e.g., \'Electric\', \'Grassy\').
 * @param {boolean} [options.field.isGravity=false] - Whether Gravity is active.
 * @param {boolean} [options.field.isMagicRoom=false] - Whether Magic Room is active.
 * @param {boolean} [options.field.isWonderRoom=false] - Whether Wonder Room is active.
 * @param {boolean} [options.field.isBeadsOfRuin=false] - Whether Beads of Ruin is active.
 * @param {boolean} [options.field.isTabletsOfRuin=false] - Whether Tablets of Ruin is active.
 * @param {boolean} [options.field.isSwordOfRuin=false] - Whether Sword of Ruin is active.
 * @param {boolean} [options.field.isVesselOfRuin=false] - Whether Vessel of Ruin is active.
 * @param {object} [options.field.pokemon1Side={}] - Side conditions for Pokémon 1.
 * @param {boolean} [options.field.pokemon1Side.isSR=false] - Stealth Rock on Pokémon 1's side.
 * @param {number} [options.field.pokemon1Side.spikes=0] - Spikes layers on Pokémon 1's side.
 * @param {boolean} [options.field.pokemon1Side.isReflect=false] - Reflect on Pokémon 1's side.
 * @param {boolean} [options.field.pokemon1Side.isLightScreen=false] - Light Screen on Pokémon 1's side.
 * @param {object} [options.field.pokemon2Side={}] - Side conditions for Pokémon 2.
 * @param {boolean} [options.field.pokemon2Side.isSR=false] - Stealth Rock on Pokémon 2's side.
 * @param {number} [options.field.pokemon2Side.spikes=0] - Spikes layers on Pokémon 2's side.
 * @param {boolean} [options.field.pokemon2Side.isReflect=false] - Reflect on Pokémon 2's side.
 * @param {boolean} [options.field.pokemon2Side.isLightScreen=false] - Light Screen on Pokémon 2's side.
 */
function calculateDamageCLI(options) {
	const gen = Generations.get(options.generation || 9); // Default to Gen 9

	// Ensure IVs and EVs are properly defaulted for all 6 stats if not provided
	const defaultIVs = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
	const defaultEVs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

	try {
		// Prepare options for pokemon1 and pokemon2 using the helper
		const pokemon1Options = getPokemonOptions(
			gen.num,
			options.pokemon1,
			defaultIVs,
			defaultEVs,
		);
		const pokemon2Options = getPokemonOptions(
			gen.num,
			options.pokemon2,
			defaultIVs,
			defaultEVs,
		);

		// Create Pokemon instances
		const pokemon1 = new Pokemon(gen, pokemon1Options.name, pokemon1Options);
		const pokemon2 = new Pokemon(gen, pokemon2Options.name, pokemon2Options);

		// Construct field options, using pokemon1Side and pokemon2Side from input
		const fieldOptions = {
			weather: options.field?.weather,
			terrain: options.field?.terrain,
			isGravity: options.field?.isGravity || false,
			isMagicRoom: options.field?.isMagicRoom || false,
			isWonderRoom: options.field?.isWonderRoom || false,
			isBeadsOfRuin: options.field?.isBeadsOfRuin || false,
			isTabletsOfRuin: options.field?.isTabletsOfRuin || false,
			isSwordOfRuin: options.field?.isSwordOfRuin || false,
			isVesselOfRuin: options.field?.isVesselOfRuin || false,
			// Field sides are named pokemon1Side and pokemon2Side in the input,
			// these need to be mapped to attackerSide and defenderSide for the Field constructor.
			// This mapping depends on which pokemon is currently attacking.
		};

		const results = {};

		// --- Calculate Pokemon 1 attacking Pokemon 2 ---
		if (pokemon1Options.moves.length > 0) {
			const currentField = new Field({
				...fieldOptions,
				attackerSide: options.field?.pokemon1Side || {},
				defenderSide: options.field?.pokemon2Side || {},
			});

			const moveCalculations = [];
			for (const moveName of pokemon1Options.moves) {
				moveCalculations.push({
					moveName: moveName,
					normalHit: getFormattedResult(
						gen,
						pokemon1,
						pokemon2,
						moveName,
						currentField,
						false,
					),
					criticalHit: getFormattedResult(
						gen,
						pokemon1,
						pokemon2,
						moveName,
						currentField,
						true,
					),
				});
			}
			results.pokemon1AttackingPokemon2 = {
				attacker: {
					name: pokemon1.name,
					level: pokemon1.level,
					ability: pokemon1.ability || "N/A",
					item: pokemon1.item || "N/A",
				},
				defender: {
					name: pokemon2.name,
					level: pokemon2.level,
					ability: pokemon2.ability || "N/A",
					item: pokemon2.item || "N/A",
				},
				moves: moveCalculations,
			};
		} else {
			results.pokemon1AttackingPokemon2 = {
				message: `${pokemon1.name} has no moves to calculate.`,
				attacker: {
					name: pokemon1.name,
					level: pokemon1.level,
					ability: pokemon1.ability || "N/A",
					item: pokemon1.item || "N/A",
				},
				defender: {
					name: pokemon2.name,
					level: pokemon2.level,
					ability: pokemon2.ability || "N/A",
					item: pokemon2.item || "N/A",
				},
			};
		}

		// --- Calculate Pokemon 2 attacking Pokemon 1 ---
		if (pokemon2Options.moves.length > 0) {
			const currentField = new Field({
				...fieldOptions,
				attackerSide: options.field?.pokemon2Side || {}, // Pokemon 2's side is now attacker
				defenderSide: options.field?.pokemon1Side || {}, // Pokemon 1's side is now defender
			});

			const moveCalculations = [];
			for (const moveName of pokemon2Options.moves) {
				moveCalculations.push({
					moveName: moveName,
					normalHit: getFormattedResult(
						gen,
						pokemon2,
						pokemon1,
						moveName,
						currentField,
						false,
					),
					criticalHit: getFormattedResult(
						gen,
						pokemon2,
						pokemon1,
						moveName,
						currentField,
						true,
					),
				});
			}
			results.pokemon2AttackingPokemon1 = {
				attacker: {
					name: pokemon2.name,
					level: pokemon2.level,
					ability: pokemon2.ability || "N/A",
					item: pokemon2.item || "N/A",
				},
				defender: {
					name: pokemon1.name,
					level: pokemon1.level,
					ability: pokemon1.ability || "N/A",
					item: pokemon1.item || "N/A",
				},
				moves: moveCalculations,
			};
		} else {
			results.pokemon2AttackingPokemon1 = {
				message: `${pokemon2.name} has no moves to calculate.`,
				attacker: {
					name: pokemon2.name,
					level: pokemon2.level,
					ability: pokemon2.ability || "N/A",
					item: pokemon2.item || "N/A",
				},
				defender: {
					name: pokemon1.name,
					level: pokemon1.level,
					ability: pokemon1.ability || "N/A",
					item: pokemon1.item || "N/A",
				},
			};
		}

		console.log(JSON.stringify(results, null, 2));
	} catch (error) {
		console.error("Error during calculation:", error.message);
		console.error(
			"Please ensure Pokémon names, move names, trainer/species combinations, and other parameters are correct for the specified generation.",
		);
	}
}

// Example usage (uncomment to test):
/*
// Example 1: Basic calculation with direct Pokémon definition (two-way)
calculateDamageCLI({
    generation: 9, // Scarlet/Violet
    pokemon1: {
        name: "Garchomp",
        level: 100,
        ability: "Rough Skin",
        item: "Choice Band",
        nature: "Jolly",
        evs: { atk: 252, spe: 252 },
        ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
        moves: ["Dragon Claw", "Earthquake", "Stone Edge", "Swords Dance"],
    },
    pokemon2: {
        name: "Corviknight",
        level: 100,
        ability: "Pressure",
        item: "Leftovers",
        nature: "Impish",
        evs: { hp: 252, def: 252 },
        ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
        moves: ["Brave Bird", "Body Press", "Iron Defense", "Roost"],
    },
    field: {
        weather: null,
        terrain: null,
        pokemon1Side: { isSR: false, spikes: 0, isReflect: false, isLightScreen: false },
        pokemon2Side: { isSR: true, spikes: 0, isReflect: false, isLightScreen: false }, // SR on Corviknight's side initially
    }
});
*/

/*
// Example 2: Use trainer's Pokémon for Pokemon 1 (e.g., Fisherman Elliot's Staryu)
calculateDamageCLI({
    generation: 8, // Gen 8 for Fisherman Elliot
    pokemon1: {
        trainerPokemon: {
            speciesName: "Staryu",
            trainerName: "Fisherman Elliot",
        },
    },
    pokemon2: {
        name: "Snorlax", // A common Gen 8 threat
        level: 13,
        ability: "Thick Fat",
        item: "Leftovers",
        nature: "Impish",
        evs: { hp: 252, def: 252 },
        ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }
    },
    field: {} // Default field
});
*/

/*
// Example 3: Use trainer's Pokémon for Pokemon 2 (e.g., Leader Wattson's Ampharos-Mega)
calculateDamageCLI({
    generation: 8,
    pokemon1: {
        name: "Excadrill",
        level: 100,
        ability: "Mold Breaker",
        item: "Choice Band",
        nature: "Jolly",
        evs: { atk: 252, spe: 252 },
        ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
        moves: ["Earthquake", "Iron Head", "Rock Slide"],
    },
    pokemon2: {
        trainerPokemon: {
            speciesName: "Ampharos-Mega",
            trainerName: "Leader Wattson",
        },
    },
    field: {}
});
*/

// To make this callable as a CLI tool:
// You'd typically use a tool like 'commander' or 'yargs' for parsing command line arguments.
// For simplicity, we can export the function and run it with node directly,
// passing a hardcoded options object or parsing process.argv manually.

// Example of how you might run this from the command line:
// node -e 'require("./runbuncalc/cli_calc").calculateDamageCLI({ /* options here */ })'

// For a more robust CLI, you would add argument parsing logic here.
// For now, exporting the function for potential direct calls or testing.
module.exports = { calculateDamageCLI };
