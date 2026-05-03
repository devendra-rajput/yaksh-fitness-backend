/**
 * Weekly Plan AI Model
 * 9-stage pipeline — see /WEEKLY_PLAN_ALGORITHM.md for full documentation
 */

const { Exercise } = require('../exercises/exercise.schema');

/* ─── Constants ──────────────────────────────────────────────────────────── */

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const EXERCISE_COUNT = { 30: 4, 45: 6, 60: 8 };

// Stage 2 — split structures per days_per_week + difficulty
const WEEKLY_SPLITS = {
  3: {
    beginner: ['Full Body', 'Rest', 'Full Body', 'Rest', 'Full Body', 'Rest', 'Rest'],
    intermediate: ['Full Body', 'Rest', 'Full Body', 'Rest', 'Full Body', 'Rest', 'Rest'],
    advanced: ['Full Body A', 'Rest', 'Full Body B', 'Rest', 'Full Body C', 'Rest', 'Rest'],
  },
  4: {
    beginner: ['Upper', 'Lower', 'Rest', 'Upper', 'Lower', 'Rest', 'Rest'],
    intermediate: ['Upper', 'Lower', 'Rest', 'Upper', 'Lower', 'Rest', 'Rest'],
    advanced: ['Push', 'Pull', 'Rest', 'Legs', 'Push', 'Pull', 'Rest'],
  },
  5: {
    beginner: ['Full Body', 'Full Body', 'Rest', 'Full Body', 'Full Body', 'Active Recovery', 'Rest'],
    intermediate: ['Push', 'Pull', 'Legs', 'Rest', 'Upper', 'Core+Cardio', 'Rest'],
    advanced: ['Chest+Tri', 'Back+Bi', 'Legs', 'Shoulders', 'Arms+Core', 'Rest', 'Rest'],
  },
  6: {
    beginner: ['Full Body', 'Full Body', 'Full Body', 'Rest', 'Full Body', 'Full Body', 'Rest'],
    intermediate: ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Core+Cardio', 'Rest'],
    advanced: ['Chest+Tri', 'Back+Bi', 'Legs', 'Shoulders+Core', 'Arms', 'Full Body', 'Rest'],
  },
};

const SPLIT_MUSCLES = {
  'Full Body': ['chest', 'back', 'quadriceps', 'hamstrings', 'shoulders', 'core'],
  'Full Body A': ['chest', 'back', 'quadriceps', 'core'],
  'Full Body B': ['hamstrings', 'glutes', 'shoulders', 'biceps', 'triceps'],
  'Full Body C': ['back', 'chest', 'calves', 'core', 'forearms'],
  Push: ['chest', 'shoulders', 'triceps'],
  Pull: ['back', 'biceps', 'trapezius'],
  Legs: ['quadriceps', 'hamstrings', 'glutes', 'calves'],
  Upper: ['chest', 'back', 'shoulders', 'biceps', 'triceps'],
  Lower: ['quadriceps', 'hamstrings', 'glutes', 'calves'],
  'Chest+Tri': ['chest', 'triceps'],
  'Back+Bi': ['back', 'biceps'],
  Shoulders: ['shoulders', 'trapezius'],
  'Shoulders+Core': ['shoulders', 'trapezius', 'core'],
  Arms: ['biceps', 'triceps', 'forearms'],
  'Arms+Core': ['biceps', 'triceps', 'forearms', 'core'],
  'Core+Cardio': ['core'],
  'Active Recovery': [],
  Rest: [],
};

const SESSION_TYPE_MAP = {
  'Full Body': 'strength',
  'Full Body A': 'strength',
  'Full Body B': 'strength',
  'Full Body C': 'strength',
  Push: 'strength',
  Pull: 'strength',
  Legs: 'strength',
  Upper: 'strength',
  Lower: 'strength',
  'Chest+Tri': 'strength',
  'Back+Bi': 'strength',
  Shoulders: 'strength',
  'Shoulders+Core': 'strength',
  Arms: 'strength',
  'Arms+Core': 'strength',
  'Core+Cardio': 'cardio',
  'Active Recovery': 'active_recovery',
  Rest: 'rest',
};

const LOCATION_FILTER = {
  no_equipment: ['no_equipment'],
  home_gym: ['no_equipment', 'home_gym'],
  small_gym: ['no_equipment', 'home_gym', 'small_gym'],
  large_gym: ['no_equipment', 'home_gym', 'small_gym', 'large_gym'],
};

const PROFILE_LOCATION_MAP = {
  Gym: 'large_gym', Home: 'home_gym', Outdoor: 'no_equipment', Both: 'large_gym',
};

const DIFFICULTY_ORDER = { beginner: 1, intermediate: 2, advanced: 3 };

const BASE_PRESCRIPTION = {
  beginner: { sets: 3, reps: '12-15', rest_seconds: 90 },
  intermediate: { sets: 4, reps: '8-12', rest_seconds: 60 },
  advanced: { sets: 5, reps: '6-10', rest_seconds: 45 },
};

const GOAL_ADJUSTMENTS = {
  'Lose Weight': { reps_add: 3, rest_add: -20 },
  'Build Muscle': { reps_add: 0, rest_add: 0 },
  Endurance: { reps_add: 5, rest_add: -30 },
  Strength: { reps_add: -4, rest_add: 60 },
  'Stay Active': { reps_add: 0, rest_add: 15 },
  Flexibility: { reps_add: 0, rest_add: 0 },
  'Sport Performance': { reps_add: 0, rest_add: -15 },
};

const ACTIVITY_SET_BONUS = {
  Sedentary: -1, 'Lightly Active': 0, 'Moderately Active': 0, 'Very Active': 1, 'Extremely Active': 1,
};

const INJURY_KEYWORDS = {
  knee: ['lunge', 'squat', 'leg press', 'jump', 'pistol', 'step-up', 'box jump', 'split squat'],
  lower_back: ['deadlift', 'good morning', 'hyperextension', 'bent-over row', 'jefferson'],
  shoulder: ['overhead press', 'military press', 'upright row', 'behind-neck', 'snatch'],
  wrist: ['push-up', 'plank', 'wrist curl', 'handstand'],
  pregnancy: ['jump', 'sprint', 'crunch', 'sit-up', 'deadlift'],
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }

function calcAge(dob) {
  if (!dob) return 30;
  const d = new Date(dob);
  if (isNaN(d)) return 30;
  return Math.floor((Date.now() - d.getTime()) / 31557600000);
}

function parseRepsUpper(repsStr) {
  const parts = String(repsStr).replace('s', '').split('-');
  return parseInt(parts[parts.length - 1], 10) || 10;
}

function applyGoalAdjustments(baseReps, baseRest, goal, difficulty) {
  const adj = GOAL_ADJUSTMENTS[goal] || { reps_add: 0, rest_add: 0 };
  const upper = parseRepsUpper(baseReps) + adj.reps_add;
  const lower = Math.max(1, upper - 4);
  const reps = difficulty === 'beginner' ? String(Math.max(8, upper)) : `${Math.max(1, lower)}-${Math.max(1, upper)}`;
  const rest = Math.max(0, baseRest + adj.rest_add);
  return { reps, rest_seconds: rest };
}

function estimateDuration(exercises) {
  let total = 5 * 60 + 5 * 60; // warmup + cooldown fixed
  for (const ex of exercises) {
    if (ex.role === 'main') {
      const repsUpper = parseRepsUpper(ex.reps);
      const timePerSet = ex.is_time_based ? repsUpper : repsUpper * 3;
      const restTime = (ex.sets - 1) * ex.rest_seconds;
      total += ex.sets * timePerSet + restTime + 10;
    }
  }
  return Math.ceil(total / 60 / 5) * 5;
}

function isExcludedByInjury(exerciseTitle, injuries) {
  const lower = exerciseTitle.toLowerCase();
  for (const inj of injuries) {
    const keywords = INJURY_KEYWORDS[inj.type] || [];
    if (keywords.some((k) => lower.includes(k))) return true;
  }
  return false;
}

/* ─── Stage 4 — Exercise Query ───────────────────────────────────────────── */

async function queryExercises({
  muscles, location, difficulties, excludeIds, mechanic, subtype, limit,
}) {
  const locationArr = LOCATION_FILTER[location] || LOCATION_FILTER.large_gym;
  const baseQ = {
    status: 'published',
    deleted_at: { $in: [null, '', ' '] },
    workout_location: { $in: locationArr },
    difficulty: { $in: difficulties },
  };

  if (excludeIds && excludeIds.length) baseQ._id = { $nin: excludeIds };
  if (mechanic) baseQ.mechanic = mechanic;
  if (subtype) baseQ.subtype = subtype;
  if (mechanic === 'stretching') {
    delete baseQ.difficulty; // stretching exercises often don't have difficulty set
  }

  // Muscle matching: try targeted first, then relax if needed
  if (muscles && muscles.length) {
    const muscleRegex = new RegExp(muscles.join('|'), 'i');
    baseQ.primary_muscles = { $elemMatch: { $regex: muscleRegex } };
  }

  let results = await Exercise.find(baseQ)
    .select('_id title slug thumbnail_url video_url mechanic primary_muscles subtype is_time_based recommendations')
    .lean();

  // If insufficient, relax muscle filter
  if (results.length < Math.ceil(limit / 2) && muscles && muscles.length) {
    const relaxed = { ...baseQ };
    delete relaxed.primary_muscles;
    const extra = await Exercise.find(relaxed)
      .select('_id title slug thumbnail_url video_url mechanic primary_muscles subtype is_time_based recommendations')
      .lean();
    results = [...results, ...extra];
  }

  return results;
}

/* ─── Stage 5 — Selection ────────────────────────────────────────────────── */

function selectMainExercises(pool, count, difficulty, usedIds) {
  const available = pool.filter((e) => !usedIds.has(String(e._id)));
  const compounds = shuffle(available.filter((e) => e.mechanic === 'compound'));
  const isolations = shuffle(available.filter((e) => e.mechanic === 'isolation'));
  const others = shuffle(available.filter((e) => !['compound', 'isolation', 'stretching'].includes(e.mechanic)));

  const ratios = { beginner: [0.6, 0.4], intermediate: [0.5, 0.5], advanced: [0.4, 0.6] };
  const [cr] = ratios[difficulty] || ratios.intermediate;
  const compCount = Math.round(count * cr);
  const isoCount = count - compCount;

  const selected = [
    ...compounds.slice(0, compCount),
    ...isolations.slice(0, isoCount),
  ];

  // fill gaps
  if (selected.length < count) {
    const fillerPool = [...compounds.slice(compCount), ...isolations.slice(isoCount), ...others];
    const existing = new Set(selected.map((e) => String(e._id)));
    for (const ex of fillerPool) {
      if (selected.length >= count) break;
      if (!existing.has(String(ex._id))) { selected.push(ex); existing.add(String(ex._id)); }
    }
  }

  return selected;
}

/* ─── Stage 6 — Prescription ─────────────────────────────────────────────── */

function prescribe(exercise, difficulty, goal, activityLevel, pregnancyTrimester) {
  const base = BASE_PRESCRIPTION[difficulty] || BASE_PRESCRIPTION.intermediate;

  // Use exercise-specific recommendation if available
  const rec = (exercise.recommendations || []).find((r) => r.difficulty === difficulty);
  const baseSets = base.sets;
  const baseReps = rec ? rec.reps : base.reps;
  const baseRest = rec ? rec.rest_seconds : base.rest_seconds;
  const isTimeBased = exercise.is_time_based || String(baseReps).includes('s');

  const { reps, rest_seconds } = applyGoalAdjustments(baseReps, baseRest, goal, difficulty);
  const setBonus = ACTIVITY_SET_BONUS[activityLevel] || 0;
  let sets = Math.max(1, baseSets + setBonus);

  // Pregnancy caps
  if (pregnancyTrimester) sets = Math.max(1, Math.floor(sets * 0.7));

  return {
    sets, reps, rest_seconds, is_time_based: isTimeBased,
  };
}

/* ─── Main Generate Function ─────────────────────────────────────────────── */

const generate = async (user, preferences) => {
  // Stage 1 — Profile analysis
  const age = calcAge(user.dob);
  let difficulty = (preferences.difficulty || user.fitness_level || 'Intermediate').toLowerCase();
  if (age < 16) difficulty = 'beginner';
  if (age > 65) difficulty = 'beginner';

  const location = preferences.location
    || PROFILE_LOCATION_MAP[user.training_location]
    || 'large_gym';

  const daysPerWeek = Math.min(6, Math.max(3, parseInt(preferences.days_per_week, 10) || 6));
  const durationMin = [30, 45, 60].includes(preferences.duration_min) ? preferences.duration_min : 45;
  const goal = user.goal || 'Stay Active';
  const activityLevel = user.activity_level || 'Moderately Active';
  const injuries = user.injuries || [];
  const pregnancyTrimester = user.pregnancy_trimester || null;

  const allowedDifficulties = Object.entries(DIFFICULTY_ORDER)
    .filter(([, v]) => v <= DIFFICULTY_ORDER[difficulty])
    .map(([k]) => k);

  // Stage 2 — Weekly structure
  const splitKey = String(daysPerWeek);
  const splitTemplate = (WEEKLY_SPLITS[splitKey] || WEEKLY_SPLITS['6'])[difficulty] || WEEKLY_SPLITS['6'].intermediate;

  // Stage 3 handled inside queryExercises

  const usedIds = new Set();
  const mainCount = EXERCISE_COUNT[durationMin] || 6;
  const days = [];

  // Stage 4, 5, 6 — Per day
  for (let i = 0; i < 7; i++) {
    const label = splitTemplate[i];
    const isRest = label === 'Rest' || label === 'Active Recovery';
    const targetMuscles = SPLIT_MUSCLES[label] || [];

    if (isRest) {
      days.push({
        day_index: i,
        day_name: DAY_NAMES[i],
        is_rest: true,
        session_type: label === 'Active Recovery' ? 'active_recovery' : 'rest',
        split_label: label,
        target_muscles: [],
        estimated_duration: 0,
        exercises: [],
      });
      continue;
    }

    // Query warmup pool
    const warmupPool = await queryExercises({
      muscles: targetMuscles,
      location,
      difficulties: allowedDifficulties,
      excludeIds: [],
      mechanic: 'stretching',
      subtype: 'dynamic',
      limit: 2,
    });

    // Query cooldown pool
    const cooldownPool = await queryExercises({
      muscles: targetMuscles,
      location,
      difficulties: allowedDifficulties,
      excludeIds: [],
      mechanic: 'stretching',
      subtype: 'static',
      limit: 2,
    });

    // Query main exercise pool
    const mainPool = await queryExercises({
      muscles: targetMuscles,
      location,
      difficulties: allowedDifficulties,
      excludeIds: [...usedIds],
      limit: mainCount * 3,
    });

    // Filter injuries
    const filteredMain = mainPool.filter((e) => !isExcludedByInjury(e.title, injuries));

    // Select main exercises
    const selectedMain = selectMainExercises(filteredMain, mainCount, difficulty, usedIds);

    // Mark used
    selectedMain.forEach((e) => usedIds.add(String(e._id)));

    // Pick warmup/cooldown
    const warmups = shuffle(warmupPool).slice(0, 2);
    const cooldowns = shuffle(cooldownPool).slice(0, 2);

    // Assemble exercises with prescription
    let order = 0;
    const buildEx = (ex, role) => {
      const rx = role === 'main'
        ? prescribe(ex, difficulty, goal, activityLevel, pregnancyTrimester)
        : {
          sets: 1, reps: '30s', rest_seconds: 0, is_time_based: true,
        };
      return {
        exercise_id: ex._id,
        title: ex.title,
        slug: ex.slug || '',
        thumbnail_url: ex.thumbnail_url || '',
        video_url: ex.video_url || '',
        mechanic: ex.mechanic || '',
        primary_muscles: ex.primary_muscles || [],
        role,
        order: order++,
        ...rx,
        notes: '',
      };
    };

    const exercises = [
      ...warmups.map((e) => buildEx(e, 'warmup')),
      ...selectedMain.map((e) => buildEx(e, 'main')),
      ...cooldowns.map((e) => buildEx(e, 'cooldown')),
    ];

    const estimated_duration = estimateDuration(exercises);

    days.push({
      day_index: i,
      day_name: DAY_NAMES[i],
      is_rest: false,
      session_type: SESSION_TYPE_MAP[label] || 'strength',
      split_label: label,
      target_muscles: targetMuscles,
      estimated_duration,
      exercises,
    });
  }

  // Stage 7 — Consecutive day safety (warn only, swap if possible)
  for (let i = 0; i < 6; i++) {
    const a = days[i];
    const b = days[i + 1];
    if (a.is_rest || b.is_rest) continue;
    const overlap = a.target_muscles.filter((m) => b.target_muscles.includes(m));
    if (overlap.length > 0 && overlap.length / a.target_muscles.length > 0.5) {
      // Try to find a swap candidate further ahead
      for (let j = i + 2; j < 7; j++) {
        const c = days[j];
        if (c.is_rest) continue;
        const overlapC = a.target_muscles.filter((m) => c.target_muscles.includes(m));
        if (overlapC.length / a.target_muscles.length <= 0.5) {
          // Swap b and c
          [days[i + 1], days[j]] = [days[j], days[i + 1]];
          days[i + 1].day_index = i + 1;
          days[i + 1].day_name = DAY_NAMES[i + 1];
          days[j].day_index = j;
          days[j].day_name = DAY_NAMES[j];
          break;
        }
      }
    }
  }

  return {
    type: 'ai',
    status: 'active',
    generated_at: new Date(),
    preferences: {
      difficulty, duration_min: durationMin, location, days_per_week: daysPerWeek, muscles: preferences.muscles || [],
    },
    days,
  };
};

/* ─── Single Day Regenerate ──────────────────────────────────────────────── */

const regenerateDay = async (user, plan, dayIndex) => {
  const preferences = plan.preferences || {};
  const fullPlan = await generate(user, preferences);
  return fullPlan.days[dayIndex] || null;
};

/* ─── Build manual skeleton ──────────────────────────────────────────────── */

const buildManualSkeleton = (preferences) => {
  const daysPerWeek = Math.min(6, Math.max(3, parseInt(preferences.days_per_week, 10) || 6));
  const difficulty = (preferences.difficulty || 'intermediate').toLowerCase();
  const splitKey = String(daysPerWeek);
  const splitTemplate = (WEEKLY_SPLITS[splitKey] || WEEKLY_SPLITS['6'])[difficulty] || WEEKLY_SPLITS['6'].intermediate;

  return splitTemplate.map((label, i) => ({
    day_index: i,
    day_name: DAY_NAMES[i],
    is_rest: label === 'Rest' || label === 'Active Recovery',
    session_type: SESSION_TYPE_MAP[label] || 'strength',
    split_label: label,
    target_muscles: SPLIT_MUSCLES[label] || [],
    estimated_duration: 0,
    exercises: [],
  }));
};

module.exports = { generate, regenerateDay, buildManualSkeleton };
