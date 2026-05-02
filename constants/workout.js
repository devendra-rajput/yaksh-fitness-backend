/**
 * Shared workout constants used by validation, model, and controller.
 * Import these instead of hardcoding string literals across files.
 */

const WORKOUT_DIFFICULTY = Object.freeze({
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
});

const WORKOUT_LOCATION = Object.freeze({
  NO_EQUIPMENT: 'no_equipment',
  HOME_GYM: 'home_gym',
  SMALL_GYM: 'small_gym',
  LARGE_GYM: 'large_gym',
  CUSTOM: 'custom',
});

// Fixed time values accepted by the API (minutes).
// Use 'custom' + custom_time for any other duration.
const WORKOUT_TIME = Object.freeze({
  T15: 15,
  T30: 30,
  T45: 45,
  T60: 60,
  CUSTOM: 'custom',
});

module.exports = { WORKOUT_DIFFICULTY, WORKOUT_LOCATION, WORKOUT_TIME };
