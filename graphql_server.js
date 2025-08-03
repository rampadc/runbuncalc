const { ApolloServer } = require("@apollo/server");
const { startStandaloneServer } = require("@apollo/server/standalone");
const { gql } = require("graphql-tag");

// Import necessary calculation classes from @smogon/calc
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
			`Setdex file for Generation ${genNum} not found at ${filePath}. Make sure it exists relative to ${__dirname}`,
		);
	}
	const fileContent = fs.readFileSync(filePath, "utf8");

	// Use a limited sandbox to evaluate the file content safely
	const sandbox = {};
	const script = new vm.Script(fileContent);
	try {
		// Run the script in the created context
		script.runInNewContext(sandbox);
	} catch (evalError) {
		throw new Error(
			`Error evaluating setdex file ${filePath}: ${evalError.message}`,
		);
	}

	if (!sandbox[varName]) {
		throw new Error(
			`Variable '${varName}' not found in ${filePath} after evaluation. Ensure the file defines this variable.`,
		);
	}

	return sandbox[varName];
}

// Dynamically load Pokémon set data for each generation
// This needs to be done once when the server is loaded.
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

// Default IVs and EVs for convenience
const defaultIVs = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
const defaultEVs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

/**
 * Helper function to prepare Pokémon options, potentially loading from a trainer set.
 * @param {number} genNum - The generation number.
 * @param {object} rawPokemonConfig - The raw Pokémon configuration from input options.
 * @returns {object} The complete Pokémon options object ready for `new Pokemon()` constructor.
 * @throws {Error} If Pokémon name is missing or trainer set not found.
 */
function getPokemonOptions(genNum, rawPokemonConfig) {
	let pokemonOptions = {
		name: rawPokemonConfig?.name, // Name might be undefined if trainerPokemon is used
		level: rawPokemonConfig?.level || 100,
		ability: rawPokemonConfig?.ability,
		item: rawPokemonConfig?.item,
		nature: rawPokemonConfig?.nature || "Serious",
		ivs: { ...defaultIVs, ...rawPokemonConfig?.ivs },
		evs: { ...defaultEVs, ...rawPokemonConfig?.evs },
		boosts: rawPokemonConfig?.boosts || {},
		curHP: rawPokemonConfig?.curHP,
		status: rawPokemonConfig?.status || "",
		isDynamaxed: rawPokemonConfig?.isDynamaxed || false,
		moves: rawPokemonConfig?.moves || [], // Initial moves from direct input
	};

	if (rawPokemonConfig?.trainerPokemon) {
		const { speciesName, trainerName } = rawPokemonConfig.trainerPokemon;

		const setdex = SETDEX_BY_GEN[genNum];
		if (!setdex) {
			throw new Error(
				`Pokémon set data not found for Generation ${genNum}. Please ensure the data files (e.g., gen8.js) are correctly loaded.`,
			);
		}

		const speciesSets = setdex[speciesName];
		if (!speciesSets) {
			throw new Error(
				`Pokémon species '${speciesName}' not found in sets for Generation ${genNum}.`,
			);
		}

		let trainerSet = null;
		for (const setName in speciesSets) {
			const currentSet = speciesSets[setName];
			const trainerNameRegex = new RegExp(`\\b${trainerName}\\b`, "i");
			if (
				trainerNameRegex.test(setName) ||
				(currentSet.trainer && trainerNameRegex.test(currentSet.trainer))
			) {
				trainerSet = currentSet;
				break;
			}
			const setNameFirstWord = setName.split(" ")[0];
			const trainerNameFirstWord = trainerName.split(" ")[0];
			if (!trainerSet && setNameFirstWord === trainerNameFirstWord) {
				trainerSet = currentSet;
			}
		}

		if (!trainerSet && speciesSets[trainerName]) {
			trainerSet = speciesSets[trainerName];
		}

		if (!trainerSet) {
			throw new Error(
				`Trainer '${trainerName}' with Pokémon '${speciesName}' not found in sets for Generation ${genNum}.`,
			);
		}

		// Override properties with trainer set data, merging IVs/EVs specifically
		pokemonOptions.name = speciesName; // Ensure name is from the set's speciesName
		pokemonOptions.level = trainerSet.level || pokemonOptions.level;
		pokemonOptions.ability = trainerSet.ability || pokemonOptions.ability;
		pokemonOptions.item = trainerSet.item || pokemonOptions.item;
		pokemonOptions.nature = trainerSet.nature || pokemonOptions.nature;
		// Merge provided IVs/EVs on top of set's, which are on top of defaults
		pokemonOptions.ivs = {
			...defaultIVs,
			...trainerSet.ivs,
			...rawPokemonConfig?.ivs,
		};
		pokemonOptions.evs = {
			...defaultEVs,
			...trainerSet.evs,
			...rawPokemonConfig?.evs,
		};
		pokemonOptions.moves = trainerSet.moves || pokemonOptions.moves; // Trainer moves take precedence
		// boosts, curHP, status, isDynamaxed typically not in trainer sets; keep existing/defaults.
		pokemonOptions.boosts = pokemonOptions.boosts || {};
		pokemonOptions.curHP = pokemonOptions.curHP;
		pokemonOptions.status = pokemonOptions.status || "";
		pokemonOptions.isDynamaxed = pokemonOptions.isDynamaxed || false;
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

	const move = new Move(gen, moveName, { isCrit: isCrit });

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

// Define your GraphQL schema using GraphQL SDL (Schema Definition Language)
const typeDefs = gql`
	# Input type for Pokemon stats (IVs, EVs, Boosts)
	input StatsInput {
		hp: Int
		atk: Int
		def: Int
		spa: Int
		spd: Int
		spe: Int
	}

	# Output type for Pokemon stats (IVs, EVs, Boosts)
	type StatsOutput {
		hp: Int
		atk: Int
		def: Int
		spa: Int
		spd: Int
		spe: Int
	}

	# Input type for loading a Pokémon from a trainer set
	input TrainerPokemonInput {
		speciesName: String!
		trainerName: String!
	}

	# Input type for configuring a Pokémon
	input PokemonConfigInput {
		name: String
		level: Int
		ability: String
		item: String
		nature: String
		ivs: StatsInput
		evs: StatsInput
		boosts: StatsInput
		curHP: Int
		status: String
		isDynamaxed: Boolean
		moves: [String!]
		trainerPokemon: TrainerPokemonInput
	}

	# Input type for side-specific field conditions
	input SideInput {
		isSR: Boolean
		spikes: Int
		isReflect: Boolean
		isLightScreen: Boolean
	}

	# Input type for global battlefield conditions
	input FieldInput {
		weather: String
		terrain: String
		isGravity: Boolean
		isMagicRoom: Boolean
		isWonderRoom: Boolean
		isBeadsOfRuin: Boolean
		isTabletsOfRuin: Boolean
		isSwordOfRuin: Boolean
		isVesselOfRuin: Boolean
		pokemon1Side: SideInput
		pokemon2Side: SideInput
	}

	# Main input type for the calculateDamage query
	input CalculateDamageInput {
		generation: Int!
		pokemon1: PokemonConfigInput!
		pokemon2: PokemonConfigInput!
		field: FieldInput
	}

	# Output types
	type PokemonSummary {
		name: String!
		level: Int!
		ability: String!
		item: String!
	}

	type HitResult {
		damageRange: [Int!]!
		percentageRange: [Float!]!
		koChance: String!
		description: String!
	}

	type MoveCalculationResult {
		moveName: String!
		normalHit: HitResult!
		criticalHit: HitResult!
	}

	type AttackDirectionResult {
		attacker: PokemonSummary!
		defender: PokemonSummary!
		moves: [MoveCalculationResult!]
		message: String # For cases where attacker has no moves
	}

	type CalculationResult {
		generation: Int!
		pokemon1: PokemonSummary!
		pokemon2: PokemonSummary!
		pokemon1AttackingPokemon2: AttackDirectionResult!
		pokemon2AttackingPokemon1: AttackDirectionResult!
	}

	# NEW TYPE: Represents a Pokémon set found for a trainer
	type TrainerPokemonSet {
		speciesName: String!
		setName: String!
		level: Int
		ability: String
		item: String
		nature: String
		ivs: StatsOutput
		evs: StatsOutput
		moves: [String!]!
	}

	type Query {
		calculateDamage(options: CalculateDamageInput!): CalculationResult!
		# NEW QUERY: Get a list of Pokémon sets for a given trainer in a specific generation
		getTrainerPokemonSets(
			generation: Int!
			trainerName: String!
		): [TrainerPokemonSet!]!
	}
`;

// Resolvers define how to fetch the types defined in your schema
const resolvers = {
	Query: {
		calculateDamage: (parent, { options }) => {
			const gen = Generations.get(options.generation || 9);

			// Prepare Pokemon options using the helper function
			const pokemon1Options = getPokemonOptions(gen.num, options.pokemon1);
			const pokemon2Options = getPokemonOptions(gen.num, options.pokemon2);

			// Create Pokemon instances
			const pokemon1 = new Pokemon(
				gen,
				pokemon1Options.name,
				pokemon1Options,
			);
			const pokemon2 = new Pokemon(
				gen,
				pokemon2Options.name,
				pokemon2Options,
			);

			const results = {
				generation: gen.num,
				pokemon1: {
					name: pokemon1.name,
					level: pokemon1.level,
					ability: pokemon1.ability || "N/A",
					item: pokemon1.item || "N/A",
				},
				pokemon2: {
					name: pokemon2.name,
					level: pokemon2.level,
					ability: pokemon2.ability || "N/A",
					item: pokemon2.item || "N/A",
				},
				pokemon1AttackingPokemon2: {},
				pokemon2AttackingPokemon1: {},
			};

			// --- Calculate Pokemon 1 attacking Pokemon 2 ---
			if (pokemon1Options.moves.length > 0) {
				const fieldP1toP2 = new Field({
					...options.field,
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
							fieldP1toP2,
							false,
						),
						criticalHit: getFormattedResult(
							gen,
							pokemon1,
							pokemon2,
							moveName,
							fieldP1toP2,
							true,
						),
					});
				}
				results.pokemon1AttackingPokemon2 = {
					attacker: results.pokemon1, // Reuse summary
					defender: results.pokemon2, // Reuse summary
					moves: moveCalculations,
				};
			} else {
				results.pokemon1AttackingPokemon2 = {
					message: `${pokemon1.name} has no moves to calculate.`,
					attacker: results.pokemon1,
					defender: results.pokemon2,
					moves: [], // Ensure moves array is present, even if empty due to message
				};
			}

			// --- Calculate Pokemon 2 attacking Pokemon 1 ---
			if (pokemon2Options.moves.length > 0) {
				const fieldP2toP1 = new Field({
					...options.field,
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
							fieldP2toP1,
							false,
						),
						criticalHit: getFormattedResult(
							gen,
							pokemon2,
							pokemon1,
							moveName,
							fieldP2toP1,
							true,
						),
					});
				}
				results.pokemon2AttackingPokemon1 = {
					attacker: results.pokemon2, // Reuse summary
					defender: results.pokemon1, // Reuse summary
					moves: moveCalculations,
				};
			} else {
				results.pokemon2AttackingPokemon1 = {
					message: `${pokemon2.name} has no moves to calculate.`,
					attacker: results.pokemon2,
					defender: results.pokemon1,
					moves: [], // Ensure moves array is present, even if empty due to message
				};
			}

			return results;
		},

		// NEW RESOLVER: getTrainerPokemonSets
		getTrainerPokemonSets: (parent, { generation, trainerName }) => {
			const setdex = SETDEX_BY_GEN[generation];
			if (!setdex) {
				throw new Error(
					`Pokémon set data not found for Generation ${generation}.`,
				);
			}

			const trainerPokemonList = [];
			// Use a more flexible regex for trainer name to match various forms (e.g., "Fisherman Elliot" matches "Fisherman Elliot", "Elliot")
			const trainerNameRegex = new RegExp(
				`\\b${trainerName.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`,
				"i",
			);

			for (const speciesName in setdex) {
				const speciesSets = setdex[speciesName];
				for (const setName in speciesSets) {
					const currentSet = speciesSets[setName];

					// Check if the set name or an explicit 'trainer' field contains the trainerName
					// The 'trainer' field is not consistently present, so we prioritize matching in setName
					if (
						trainerNameRegex.test(setName) ||
						(currentSet.trainer &&
							trainerNameRegex.test(currentSet.trainer))
					) {
						trainerPokemonList.push({
							speciesName: speciesName,
							setName: setName,
							level: currentSet.level,
							ability: currentSet.ability || "N/A", // Default if not present
							item: currentSet.item || "N/A", // Default if not present
							nature: currentSet.nature || "Serious", // Default if not present
							ivs: currentSet.ivs || defaultIVs, // Default if not present
							evs: currentSet.evs || defaultEVs, // Default if not present
							moves: currentSet.moves || [], // Default to empty array if no moves
						});
					}
				}
			}

			// Return the list (can be empty if no sets found, which is GraphQL idiomatic for lists)
			return trainerPokemonList;
		},
	},
};

// The ApolloServer constructor requires two parameters: your schema
// definition and your set of resolvers.
const server = new ApolloServer({
	typeDefs,
	resolvers,
});

// Start the server
startStandaloneServer(server, {
	listen: { port: 4000 },
}).then(({ url }) => {
	console.log(`🚀 GraphQL Server ready at ${url}`);
	console.log(`Access GraphQL Playground/Sandbox at ${url}`);
});
