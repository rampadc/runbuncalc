// This file will contain the CLI function for Pokémon damage calculation.

// Import necessary classes from the calculation engine
// Assuming 'calc' module is available, either through a bundler or direct import path
// In a real CLI, you'd likely need to set up node resolution or build this part.
const {
	Generations,
	Pokemon,
	Move,
	Field,
	calculate,
} = require("@smogon/calc");

/**
 * Performs a Pokémon damage calculation based on provided arguments and prints the result in JSON format.
 * @param {object} options - Options for the calculation.
 * @param {number} options.generation - The Pokémon generation number (e.g., 9 for Scarlet/Violet).
 * @param {object} options.attacker - Details for the attacking Pokémon.
 * @param {string} options.attacker.name - Attacker's species name.
 * @param {number} [options.attacker.level=100] - Attacker's level.
 * @param {string} [options.attacker.ability] - Attacker's ability.
 * @param {string} [options.attacker.item] - Attacker's item.
 * @param {string} [options.attacker.nature='Serious'] - Attacker's nature.
 * @param {object} [options.attacker.ivs={hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31}] - Attacker's IVs for all 6 stats.
 * @param {object} [options.attacker.evs={hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0}] - Attacker's EVs for all 6 stats.
 * @param {object} [options.attacker.boosts={}] - Attacker's stat boosts (e.g., {atk: 2}).
 * @param {number} [options.attacker.curHP] - Attacker's current HP.
 * @param {string} [options.attacker.status=''] - Attacker's status condition.
 * @param {boolean} [options.attacker.isDynamaxed=false] - Whether the attacker is Dynamaxed.
 * @param {string[]} options.moves - An array of move names to be used by the attacker.
 * @param {object} options.defender - Details for the defending Pokémon.
 * @param {string} options.defender.name - Defender's species name.
 * @param {number} [options.defender.level=100] - Defender's level.
 * @param {string} [options.defender.ability] - Defender's ability.
 * @param {string} [options.defender.item] - Defender's item.
 * @param {string} [options.defender.nature='Serious'] - Defender's nature.
 * @param {object} [options.defender.ivs={hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31}] - Defender's IVs for all 6 stats.
 * @param {object} [options.defender.evs={hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0}] - Defender's EVs for all 6 stats.
 * @param {object} [options.defender.boosts={}] - Defender's stat boosts.
 * @param {number} [options.defender.curHP] - Defender's current HP.
 * @param {string} [options.defender.status=''] - Defender's status condition.
 * @param {boolean} [options.defender.isDynamaxed=false] - Whether the defender is Dynamaxed.
 * @param {object} [options.field={}] - Details for the battle field.
 * @param {string} [options.field.weather] - Current weather (e.g., 'Rain', 'Sun').
 * @param {string} [options.field.terrain] - Current terrain (e.g., 'Electric', 'Grassy').
 * @param {boolean} [options.field.isGravity=false] - Whether Gravity is active.
 * @param {boolean} [options.field.isMagicRoom=false] - Whether Magic Room is active.
 * @param {boolean} [options.field.isWonderRoom=false] - Whether Wonder Room is active.
 * @param {boolean} [options.field.isBeadsOfRuin=false] - Whether Beads of Ruin is active.
 * @param {boolean} [options.field.isTabletsOfRuin=false] - Whether Tablets of Ruin is active.
 * @param {boolean} [options.field.isSwordOfRuin=false] - Whether Sword of Ruin is active.
 * @param {boolean} [options.field.isVesselOfRuin=false] - Whether Vessel of Ruin is active.
 * @param {object} [options.field.attackerSide={}] - Attacker's side conditions.
 * @param {boolean} [options.field.attackerSide.isSR=false] - Stealth Rock on attacker's side.
 * @param {number} [options.field.attackerSide.spikes=0] - Spikes layers on attacker's side.
 * @param {boolean} [options.field.attackerSide.isReflect=false] - Reflect on attacker's side.
 * @param {boolean} [options.field.attackerSide.isLightScreen=false] - Light Screen on attacker's side.
 * @param {object} [options.field.defenderSide={}] - Defender's side conditions.
 * @param {boolean} [options.field.defenderSide.isSR=false] - Stealth Rock on defender's side.
 * @param {number} [options.field.defenderSide.spikes=0] - Spikes layers on defender's side.
 * @param {boolean} [options.field.defenderSide.isReflect=false] - Reflect on defender's side.
 * @param {boolean} [options.field.defenderSide.isLightScreen=false] - Light Screen on defender's side.
 */
function calculateDamageCLI(options) {
	const gen = Generations.get(options.generation || 9); // Default to Gen 9

	// Ensure IVs and EVs are properly defaulted for all 6 stats if not provided
	const defaultIVs = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
	const defaultEVs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

	const attackerOptions = {
		level: options.attacker.level || 100,
		ability: options.attacker.ability,
		item: options.attacker.item,
		nature: options.attacker.nature || "Serious",
		ivs: { ...defaultIVs, ...options.attacker.ivs },
		evs: { ...defaultEVs, ...options.attacker.evs },
		boosts: options.attacker.boosts || {},
		curHP: options.attacker.curHP,
		status: options.attacker.status || "",
		isDynamaxed: options.attacker.isDynamaxed || false,
		// Add other Pokemon options as needed based on shared_controls.js
	};

	const defenderOptions = {
		level: options.defender.level || 100,
		ability: options.defender.ability,
		item: options.defender.item,
		nature: options.defender.nature || "Serious",
		ivs: { ...defaultIVs, ...options.defender.ivs },
		evs: { ...defaultEVs, ...options.defender.evs },
		boosts: options.defender.boosts || {},
		curHP: options.defender.curHP,
		status: options.defender.status || "",
		isDynamaxed: options.defender.isDynamaxed || false,
		// Add other Pokemon options as needed
	};

	const fieldOptions = {
		weather: options.field.weather,
		terrain: options.field.terrain,
		isGravity: options.field.isGravity || false,
		isMagicRoom: options.field.isMagicRoom || false,
		isWonderRoom: options.field.isWonderRoom || false,
		isBeadsOfRuin: options.field.isBeadsOfRuin || false,
		isTabletsOfRuin: options.field.isTabletsOfRuin || false,
		isSwordOfRuin: options.field.isSwordOfRuin || false,
		isVesselOfRuin: options.field.isVesselOfRuin || false,
		attackerSide: {
			isSR: options.field.attackerSide.isSR || false,
			spikes: options.field.attackerSide.spikes || 0,
			isReflect: options.field.attackerSide.isReflect || false,
			isLightScreen: options.field.attackerSide.isLightScreen || false,
			// Add other Side options as needed
		},
		defenderSide: {
			isSR: options.field.defenderSide.isSR || false,
			spikes: options.field.defenderSide.spikes || 0,
			isReflect: options.field.defenderSide.isReflect || false,
			isLightScreen: options.field.defenderSide.isLightScreen || false,
			// Add other Side options as needed
		},
	};

	try {
		const attacker = new Pokemon(gen, options.attacker.name, attackerOptions);
		const defender = new Pokemon(gen, options.defender.name, defenderOptions);
		const field = new Field(fieldOptions);

		const allMoveResults = [];

		// Helper function to calculate and format results for a given critical hit status
		const getFormattedResult = (moveName, isCrit) => {
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

		for (const moveName of options.moves) {
			const moveResults = {
				moveName: moveName,
				normalHit: getFormattedResult(moveName, false),
				criticalHit: getFormattedResult(moveName, true),
			};
			allMoveResults.push(moveResults);
		}

		const output = {
			generation: gen.num,
			attacker: {
				name: attacker.name,
				level: attacker.level,
				ability: attacker.ability || "No Ability",
				item: attacker.item || "No Item",
				// Add more attacker details if needed
			},
			defender: {
				name: defender.name,
				level: defender.level,
				ability: defender.ability || "No Ability",
				item: defender.item || "No Item",
				// Add more defender details if needed
			},
			moves: allMoveResults,
		};

		console.log(JSON.stringify(output, null, 2));
	} catch (error) {
		console.error("Error during calculation:", error.message);
		console.error(
			"Please ensure Pokémon names, move names, and other parameters are correct for the specified generation.",
		);
	}
}

// Example usage (uncomment to test):
/*
calculateDamageCLI({
    generation: 9, // Scarlet/Violet
    attacker: {
        name: 'Garchomp',
        level: 100,
        ability: 'Rough Skin',
        item: 'Choice Band',
        nature: 'Jolly',
        evs: { atk: 252, spe: 252 },
        ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }
    },
    moves: ["Dragon Claw", "Earthquake", "Stone Edge", "Swords Dance"], // Added Swords Dance (status move)
    defender: {
        name: 'Corviknight',
        level: 100,
        ability: 'Pressure',
        item: 'Leftovers',
        nature: 'Impish',
        evs: { hp: 252, def: 252 },
        ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }
    },
    field: {
        weather: null,
        terrain: null,
        attackerSide: {
            isSR: false,
            spikes: 0,
            isReflect: false,
            isLightScreen: false
        },
        defenderSide: {
            isSR: true, // Example: Stealth Rock on defender's side
            spikes: 0,
            isReflect: false,
            isLightScreen: false
        }
    }
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
