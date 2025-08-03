# GraphQL API Documentation

This document describes the GraphQL API for the damage calculator and Pokémon set retrieval server.

## Endpoints

The GraphQL server is exposed via a single endpoint where all queries are sent.

## Schema

The API provides two main query capabilities: calculating damage between two Pokémon and retrieving predefined Pokémon sets for trainers.

### Types

#### Input Types

*   **`StatsInput`**
    Used to define a Pokémon's Individual Values (IVs), Effort Values (EVs), or stat boosts.
    *   `hp`: `Int` (Hit Points)
    *   `atk`: `Int` (Attack)
    *   `def`: `Int` (Defense)
    *   `spa`: `Int` (Special Attack)
    *   `spd`: `Int` (Special Defense)
    *   `spe`: `Int` (Speed)

*   **`TrainerPokemonInput`**
    Used to specify a Pokémon by its species name and trainer name when loading pre-defined sets.
    *   `speciesName`: `String!` (e.g., "Pikachu")
    *   `trainerName`: `String!` (e.g., "Red" or "Fisherman Elliot")

*   **`PokemonConfigInput`**
    Configures a single Pokémon for damage calculations.
    *   `name`: `String` (e.g., "Pikachu"). Required if `trainerPokemon` is not used.
    *   `level`: `Int` (e.g., 50, default is likely 100 if not specified)
    *   `ability`: `String` (e.g., "Static")
    *   `item`: `String` (e.g., "Light Ball")
    *   `nature`: `String` (e.g., "Timid")
    *   `ivs`: `StatsInput` (Individual Values)
    *   `evs`: `StatsInput` (Effort Values)
    *   `boosts`: `StatsInput` (In-battle stat stage changes)
    *   `curHP`: `Int` (Current HP of the Pokémon)
    *   `status`: `String` (e.g., "Poison", "Burn", "Paralysis", "Sleep", "Freeze")
    *   `isDynamaxed`: `Boolean` (Indicates if the Pokémon is Dynamaxed/Gigantamaxed)
    *   `moves`: `[String!]` (Array of move names, e.g., `["Thunderbolt", "Surf"]`)
    *   `trainerPokemon`: `TrainerPokemonInput` (Use this to load a predefined set for a trainer. If used, other fields like `name`, `level`, `ivs`, `evs`, `moves`, etc. may be overridden by the set data.)

*   **`SideInput`**
    Defines side-specific battlefield conditions that affect a single side (attacker or defender).
    *   `isSR`: `Boolean` (Stealth Rock is active)
    *   `spikes`: `Int` (Number of Spikes layers, 0-3)
    *   `isReflect`: `Boolean` (Reflect is active on this side)
    *   `isLightScreen`: `Boolean` (Light Screen is active on this side)

*   **`FieldInput`**
    Defines global battlefield conditions and side-specific conditions for both Pokémon.
    *   `weather`: `String` (e.g., "Rain", "Sun", "Sand", "Hail", "Snow", "Strong Winds", "Heavy Rain", "Intense Sun")
    *   `terrain`: `String` (e.g., "Electric", "Grassy", "Misty", "Psychic")
    *   `isGravity`: `Boolean` (Gravity is active)
    *   `isMagicRoom`: `Boolean` (Magic Room is active)
    *   `isWonderRoom`: `Boolean` (Wonder Room is active)
    *   `isBeadsOfRuin`: `Boolean` (Chien-Pao's Beads of Ruin ability is active)
    *   `isTabletsOfRuin`: `Boolean` (Wo-Chien's Tablets of Ruin ability is active)
    *   `isSwordOfRuin`: `Boolean` (Chi-Yu's Sword of Ruin ability is active)
    *   `isVesselOfRuin`: `Boolean` (Ting-Lu's Vessel of Ruin ability is active)
    *   `pokemon1Side`: `SideInput` (Conditions affecting Pokemon 1's side)
    *   `pokemon2Side`: `SideInput` (Conditions affecting Pokemon 2's side)

*   **`CalculateDamageInput`**
    The main input for the `calculateDamage` query.
    *   `generation`: `Int!` (The Pokémon game generation for the calculation, e.g., 9 for Scarlet/Violet)
    *   `pokemon1`: `PokemonConfigInput!` (Configuration for the first Pokémon)
    *   `pokemon2`: `PokemonConfigInput!` (Configuration for the second Pokémon)
    *   `field`: `FieldInput` (Optional battlefield conditions)

#### Output Types

*   **`StatsOutput`**
    Output type for Pokémon stats (IVs, EVs, Boosts). Same fields as `StatsInput`.

*   **`PokemonSummary`**
    A brief summary of a Pokémon involved in the calculation.
    *   `name`: `String!`
    *   `level`: `Int!`
    *   `ability`: `String!`
    *   `item`: `String!`

*   **`HitResult`**
    Detailed result for a single move's hit (normal or critical).
    *   `damageRange`: `[Int!]!` (Array of possible damage rolls)
    *   `percentageRange`: `[Float!]!` (Damage range expressed as percentage of target's max HP)
    *   `koChance`: `String!` (Description of KO chance, e.g., "Guaranteed KO", "XHKO (Y%-Z%)")
    *   `description`: `String!` (A human-readable description of the calculation)

*   **`MoveCalculationResult`**
    Contains the calculation results for a specific move, including both normal and critical hits.
    *   `moveName`: `String!`
    *   `normalHit`: `HitResult!` (Results for a non-critical hit)
    *   `criticalHit`: `HitResult!` (Results for a critical hit)

*   **`AttackDirectionResult`**
    Results for one Pokémon attacking another.
    *   `attacker`: `PokemonSummary!`
    *   `defender`: `PokemonSummary!`
    *   `moves`: `[MoveCalculationResult!]` (Array of results for each move. Empty if attacker has no moves.)
    *   `message`: `String` (Optional message, e.g., if the attacker has no moves.)

*   **`CalculationResult`**
    The comprehensive result of a damage calculation request.
    *   `generation`: `Int!`
    *   `pokemon1`: `PokemonSummary!`
    *   `pokemon2`: `PokemonSummary!`
    *   `pokemon1AttackingPokemon2`: `AttackDirectionResult!` (Calculations for Pokemon 1 attacking Pokemon 2)
    *   `pokemon2AttackingPokemon1`: `AttackDirectionResult!` (Calculations for Pokemon 2 attacking Pokemon 1)

*   **`TrainerPokemonSet`**
    Represents a single Pokémon set found for a specific trainer in a given generation.
    *   `speciesName`: `String!` (e.g., "Pikachu")
    *   `setName`: `String!` (e.g., "Red's Pikachu")
    *   `level`: `Int`
    *   `ability`: `String`
    *   `item`: `String`
    *   `nature`: `String`
    *   `ivs`: `StatsOutput`
    *   `evs`: `StatsOutput`
    *   `moves`: `[String!]!`

### Queries

#### `calculateDamage`

Calculates the damage output between two specified Pokémon under given battlefield conditions for both attack directions.

*   **Arguments**:
    *   `options`: `CalculateDamageInput!` - An object containing all necessary configurations for the calculation.

*   **Returns**: `CalculationResult!` - An object detailing the damage calculations.

*   **Example Usage**:

    ```graphql
    query CalculateDamageExample {
      calculateDamage(
        options: {
          generation: 9
          pokemon1: {
            name: "Latias"
            level: 50
            item: "Soul Dew"
            nature: "Timid"
            evs: { spa: 252, spe: 252, hp: 4 }
            moves: ["Draco Meteor"]
          }
          pokemon2: {
            name: "Volcarona"
            level: 50
            item: "Heavy-Duty Boots"
            nature: "Modest"
            evs: { spa: 252, spe: 252, hp: 4 }
            moves: ["Quiver Dance"]
          }
          field: {
            weather: "None"
            terrain: "None"
            pokemon1Side: {
              isSR: false
            }
            pokemon2Side: {
              isSR: true # Example: Volcarona switches into Stealth Rock
            }
          }
        }
      ) {
        generation
        pokemon1 {
          name
          level
          ability
          item
        }
        pokemon2 {
          name
          level
          ability
          item
        }
        pokemon1AttackingPokemon2 {
          attacker { name }
          defender { name }
          moves {
            moveName
            normalHit {
              damageRange
              percentageRange
              koChance
              description
            }
            criticalHit {
              damageRange
              percentageRange
              koChance
              description
            }
          }
        }
        pokemon2AttackingPokemon1 {
          attacker { name }
          defender { name }
          moves {
            moveName
            normalHit {
              damageRange
              percentageRange
              koChance
              description
            }
          }
          message # In case one Pokemon has no moves
        }
      }
    }
    ```

#### `getTrainerPokemonSets`

Retrieves a list of predefined Pokémon sets for a specific trainer within a given game generation. This is useful for populating Pokémon configurations based on known in-game trainers or competitive sets.

*   **Arguments**:
    *   `generation`: `Int!` - The Pokémon game generation (e.g., 8 for Sword/Shield, 9 for Scarlet/Violet).
    *   `trainerName`: `String!` - The name of the trainer to search for (e.g., "Red", "Lance", "Cynthia"). The search is case-insensitive and flexible, matching parts of names.

*   **Returns**: `[TrainerPokemonSet!]!` - An array of matching Pokémon sets. The array will be empty if no sets are found for the given trainer and generation.

*   **Example Usage**:

    ```graphql
    query GetTrainerSetsExample {
      getTrainerPokemonSets(generation: 1, trainerName: "Red") {
        speciesName
        setName
        level
        ability
        item
        nature
        ivs {
          hp
          atk
          def
          spa
          spd
          spe
        }
        evs {
          hp
          atk
          def
          spa
          spd
          spe
        }
        moves
      }
    }
    ```
