/**
 * Workout Model v4.0
 * 7-stage pipeline following WORKOUT_BUILDER_RULES_v4.docx.
 * Each stage is a named function; generateWorkout() is the public orchestrator.
 *
 * Stage 1 — Hard Filters      (build candidate pool from DB + in-memory exclusions)
 * Stage 2 — Soft Filters      (score candidates: muscle match, gender, duplicates)
 * Stage 3 — Selection         (pick slots: count, compound/iso ratio, full-body patterns)
 * Stage 4 — Session Validation (safety checks: spinal, OHP, CNS, failure cap)
 * Stage 5 — Prescription      (sets, reps, rest, tempo, RIR, load, deload override)
 * Stage 6 — Sequencing        (order, supersets/circuit, prepend warm-up + ramp, append cool-down)
 * Stage 7 — Metadata          (calories, confidence, workout name, warnings)
 */

const {
  Exercise,
  EXERCISE_MECHANIC,
  EXERCISE_DIFFICULTY,
} = require('../exercises/exercise.schema');
const { MuscleGroup } = require('../exercises/muscle_group.schema');
const { WorkoutHistory } = require('./workout_history.schema');
// Register Equipment model so Mongoose populate() works
require('../exercises/equipment.schema');

/* ════════════════════════════════════════════════════════════════════════════
   RULE TABLES
   ════════════════════════════════════════════════════════════════════════════ */

// Rule 1 — session minutes → main exercise count
const TIME_TO_COUNT = {
  15: 3, 30: 4, 45: 6, 60: 8,
};

// Rule 3 — base prescription per difficulty
const SET_REP_CONFIG = {
  [EXERCISE_DIFFICULTY.BEGINNER]: {
    sets: '3', reps: '10-12', rest_seconds: 90, rir_target: 3,
  },
  [EXERCISE_DIFFICULTY.INTERMEDIATE]: {
    sets: '4', reps: '8-12', rest_seconds: 60, rir_target: 2,
  },
  [EXERCISE_DIFFICULTY.ADVANCED]: {
    sets: '4-5', reps: '6-10', rest_seconds: 45, rir_target: 1,
  },
};

// Rules 9, 10, 11 — session-type overrides
const YOGA_SET_REP = {
  sets: '1', reps: '30-60s hold', rest_seconds: 15, rir_target: null,
};
const STRETCH_SET_REP = {
  sets: '2', reps: '30-60s hold', rest_seconds: 10, rir_target: null,
};
const CARDIO_SET_REP = {
  [EXERCISE_DIFFICULTY.BEGINNER]: {
    sets: '3', reps: '45s work / 30s rest', rest_seconds: 60, rir_target: null,
  },
  [EXERCISE_DIFFICULTY.INTERMEDIATE]: {
    sets: '4', reps: '40s work / 20s rest', rest_seconds: 45, rir_target: null,
  },
  [EXERCISE_DIFFICULTY.ADVANCED]: {
    sets: '5', reps: '50s work / 10s rest', rest_seconds: 30, rir_target: null,
  },
};

// Rule 20 — goal → rep/rest patch
const GOAL_ADJUSTMENTS = {
  'Lose Weight': { reps: '12-15', rest_delta: -15 },
  'Build Muscle': { sets_extra: 1, rest_delta: 0 },
  'Get Stronger': { reps: '3-6', rest_delta: +30, sets: '5' },
  Endurance: { reps: '15-20', rest_delta: -20 },
  'Stay Active': {},
  Flexibility: { reps: '10-15', rest_delta: 0 },
  'Sport Performance': { reps: '5-8', rest_delta: +15 },
};

// Rule 21 — activity level → volume delta and rest delta
const ACTIVITY_VOLUME_DELTA = {
  Sedentary: -1, 'Lightly Active': 0, 'Moderately Active': 0, 'Very Active': 1, 'Extremely Active': 2,
};
const ACTIVITY_REST_DELTA = {
  Sedentary: 15, 'Lightly Active': 0, 'Moderately Active': 0, 'Very Active': -5, 'Extremely Active': -10,
};

// Rule 14/22 — corrected MET formula: kcal = MET × weight_kg × hours × activityMult
const MET_RANGE = {
  strength: [4.5, 6.0], cardio: [7.0, 10.0], yoga: [2.5, 4.0], stretching: [2.0, 3.0],
};
const ACTIVITY_MET_MULTIPLIER = {
  Sedentary: 1.0, 'Lightly Active': 1.05, 'Moderately Active': 1.1, 'Very Active': 1.15, 'Extremely Active': 1.2,
};

// Rule 25 — tempo by difficulty
const TEMPO_BY_LEVEL = {
  [EXERCISE_DIFFICULTY.BEGINNER]: '2-0-2-0',
  [EXERCISE_DIFFICULTY.INTERMEDIATE]: '3-1-1-0',
  [EXERCISE_DIFFICULTY.ADVANCED]: '4-1-1-0',
};

// Rule 27 — safety caps
const CNS_CAP = { [EXERCISE_DIFFICULTY.BEGINNER]: 12, [EXERCISE_DIFFICULTY.INTERMEDIATE]: 18, [EXERCISE_DIFFICULTY.ADVANCED]: 25 };
const SPINAL_CAP = { [EXERCISE_DIFFICULTY.BEGINNER]: 1, [EXERCISE_DIFFICULTY.INTERMEDIATE]: 2, [EXERCISE_DIFFICULTY.ADVANCED]: 99 };
const OHP_CAP = 2;

// Rule 3.2 — starting load as % of body weight by level and compound/iso type
const LOAD_BW_PCT = {
  [EXERCISE_DIFFICULTY.BEGINNER]: { compound: 0.40, isolation: 0.20 },
  [EXERCISE_DIFFICULTY.INTERMEDIATE]: { compound: 0.65, isolation: 0.35 },
  [EXERCISE_DIFFICULTY.ADVANCED]: { compound: 0.90, isolation: 0.50 },
};

// Muscle UI ID → anatomical name strings stored in exercise.primary_muscles
const MUSCLE_UI_TO_ANATOMICAL = {
  abs: ['Abs', 'Rectus Abdominis'],
  back: ['Back', 'Lats', 'Latissimus Dorsi', 'Rhomboids', 'Mid Back'],
  chest: ['Chest', 'Pectorals', 'Pecs'],
  glutes: ['Glutes', 'Gluteus Maximus'],
  hamstrings: ['Hamstrings'],
  quadriceps: ['Quadriceps', 'Quads'],
  shoulders: ['Shoulders', 'Deltoids', 'Front Delt', 'Lateral Delt'],
  triceps: ['Triceps'],
  'lower-back': ['Lower Back', 'Erector Spinae'],
  biceps: ['Biceps'],
  obliques: ['Obliques'],
  adductors: ['Adductors', 'Inner Thigh'],
  abductors: ['Abductors', 'Hip Abductors', 'Outer Hip'],
  forearms: ['Forearms'],
  calves: ['Calves', 'Gastrocnemius'],
  trapezius: ['Trapezius', 'Traps'],
};

// Rule 24 — injury type → title keywords to exclude
const INJURY_EXCLUDE_KEYWORDS = {
  knee: ['jump', 'lunge', 'squat', 'leg press', 'step up', 'box', 'burpee', 'sprint', 'pistol', 'skater'],
  lower_back: ['deadlift', 'good morning', 'rdl', 'romanian', 'bent over row', 't-bar row', 'hyperextension'],
  shoulder: ['overhead press', 'military press', 'upright row', 'behind neck', 'push press', 'arnold press'],
  wrist: ['clean', 'snatch', 'front squat', 'wrist curl'],
};
const PREGNANCY_T1_KEYWORDS = ['jump', 'box jump', 'plyo', 'sprint', 'burpee', 'contact sport', 'heavy barbell squat', 'heavy deadlift'];
const PREGNANCY_T2_KEYWORDS = [...PREGNANCY_T1_KEYWORDS, 'flat bench', 'lying', 'prone', 'supine', 'crunch', 'sit-up', 'sit up', 'leg raise', 'hanging'];
const PREGNANCY_T3_KEYWORDS = [...PREGNANCY_T2_KEYWORDS, 'squat', 'deadlift', 'clean', 'snatch', 'lunge'];

// Keyword derivation helpers (used when schema boolean fields are not yet seeded)
const STAPLE_COMPOUND_KEYWORDS = ['squat', 'deadlift', 'bench press', 'overhead press', 'barbell row', 'pull-up', 'pull up', 'chin-up', 'chin up'];
const SPINAL_LOADED_KEYWORDS = ['squat', 'deadlift', 'good morning', 'rdl', 'romanian', 'bent over row', 'barbell row'];
const OHP_KEYWORD_LIST = ['overhead press', 'military press', 'push press', 'arnold press', 'shoulder press'];
const RAMP_TRIGGER_KEYWORDS = ['barbell squat', 'back squat', 'deadlift', 'bench press', 'overhead press', 'barbell row'];

const COMMON_QUERY = Object.freeze({
  published: { status: 'published', deleted_at: { $in: [null, '', ' '] } },
});

// Maps frontend equipment picker IDs → actual equipment slugs used on exercises in DB
const EQUIPMENT_FRONTEND_TO_DB = {
  'dumbbells':              ['dumbbells', 'dumbbell'],
  'barbell':                ['barbell', 'box-barbell'],
  'cable-machine':          ['cable-crossover-machine', 'dual-cable-pulley-machine', 'cable-pulley-machine', 'cable-row-machine'],
  'bench':                  [],
  'kettlebell':             ['kettlebells'],
  'ab-wheel':               ['ab-roller'],
  'ez-bar':                 ['ez-bar'],
  'v-bar':                  [],
  'trap-bar':               ['trap-bar'],
  'weight-plates':          ['weight-plate'],
  'hyper-extension-bench':  ['hyperextension-bench'],
  'lat-pulldown':           ['lat-pull-down-machine-cable'],
  'cable':                  ['cable-crossover-machine', 'dual-cable-pulley-machine', 'cable-pulley-machine', 'cable-row-machine', 'cable-pulley-machine-rope-attachment', 'lat-pull-down-machine-cable'],
  'pec-deck-fly':           ['dual-pec-deck-machine', 'pec-fly-rear-delt-machine', 'dual-pec-fly-machine'],
  'rope-attachment':        ['cable-pulley-machine-rope-attachment'],
  // machine entries already present in workouts page that map directly
  'smith-machine':          ['smith-machine'],
  'leg-press':              ['leg-press-machine'],
  'hack-squat':             ['hack-squat-machine'],
  'leg-extension':          ['leg-extension-machine'],
  'leg-curl':               ['seated-leg-curl-machine', 'hammer-strength-iso-lateral-leg-curl-machine'],
  'chest-press':            ['chest-press-machine'],
  'iso-lateral-shoulder-press': ['iso-lateral-shoulder-press-machine'],
  'all-hammer-strength':    [
    'hammer-strength-mts-iso-lateral-biceps-curl-machine',
    'hammer-strength-mts-iso-lateral-decline-press-machine',
    'hammer-strength-plate-loaded-high-row-machine',
    'hammer-strength-plate-loaded-iso-lateral-chest-press-machine',
    'hammer-strength-iso-lateral-leg-curl-machine',
  ],
};

const FULL_BODY_PATTERNS = ['squat', 'hinge', 'horizontal_push', 'horizontal_pull', 'vertical_push', 'core'];

/* ════════════════════════════════════════════════════════════════════════════
   UTILITY HELPERS
   ════════════════════════════════════════════════════════════════════════════ */

function normalizeGender(gender) {
  if (gender === 'Male') return 'male';
  if (gender === 'Female') return 'female';
  return null;
}

function calculateAge(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
}

function toWeightKg(weight, unit) {
  if (!weight || weight <= 0) return 70;
  return unit === 'lbs' ? Math.round(weight * 0.453592) : weight;
}

function capDifficultyForAge(difficultyKey, age) {
  if (age === null) return difficultyKey;
  if (age < 16 || age > 60) return EXERCISE_DIFFICULTY.BEGINNER;
  if (age > 50 && difficultyKey === EXERCISE_DIFFICULTY.ADVANCED) return EXERCISE_DIFFICULTY.INTERMEDIATE;
  return difficultyKey;
}

function resolveExerciseCount(time, customTime) {
  if (time !== 'custom') return TIME_TO_COUNT[time] || 4;
  if (!customTime || customTime <= 15) return 3;
  if (customTime <= 30) return 4;
  if (customTime <= 45) return 6;
  if (customTime <= 60) return 8;
  return 10;
}

function showTempo(tempoDisplay, difficultyKey) {
  if (tempoDisplay !== null && tempoDisplay !== undefined) return tempoDisplay;
  return difficultyKey !== EXERCISE_DIFFICULTY.BEGINNER;
}

function titleIncludes(ex, keywords) {
  const t = (ex.title || '').toLowerCase();
  return keywords.some((k) => t.includes(k));
}

function deriveIsStaple(ex) { return ex.is_staple_compound || titleIncludes(ex, STAPLE_COMPOUND_KEYWORDS); }
function deriveIsSpinal(ex) { return ex.is_spinal_loaded || titleIncludes(ex, SPINAL_LOADED_KEYWORDS); }
function deriveIsOhp(ex) { return ex.is_overhead_press || titleIncludes(ex, OHP_KEYWORD_LIST); }
function deriveCnsLoad(ex) {
  if (ex.cns_load) return ex.cns_load;
  if (ex.mechanic === EXERCISE_MECHANIC.COMPOUND) return 4;
  if (ex.mechanic === EXERCISE_MECHANIC.ISOLATION) return 2;
  if (ex.mechanic === EXERCISE_MECHANIC.CARDIO) return 3;
  return 2;
}

function inferMovementPattern(ex) {
  if (ex.movement_pattern) return ex.movement_pattern;
  const t = (ex.title || '').toLowerCase();
  if (/squat|lunge|leg press|goblet|hack squat/.test(t)) return 'squat';
  if (/deadlift|rdl|romanian|hip thrust|glute bridge|hinge/.test(t)) return 'hinge';
  if (/bench press|push.?up|chest press|fly|dip/.test(t)) return 'horizontal_push';
  if (/row|face pull|rear delt/.test(t)) return 'horizontal_pull';
  if (/overhead press|shoulder press|military|lateral raise/.test(t)) return 'vertical_push';
  if (/pull.?up|lat pulldown|chin.?up/.test(t)) return 'vertical_pull';
  if (/crunch|plank|ab |core|oblique|leg raise/.test(t)) return 'core';
  return null;
}

function isCompoundLike(ex) {
  return [EXERCISE_MECHANIC.COMPOUND, EXERCISE_MECHANIC.BODYWEIGHT].includes(ex.mechanic);
}

function isIsolationLike(ex) {
  return [EXERCISE_MECHANIC.ISOLATION, EXERCISE_MECHANIC.CORE].includes(ex.mechanic);
}

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);
function roundToPlate(kg) { return Math.round(kg / 2.5) * 2.5; }

function clean(ex) {
  const out = { ...ex };
  delete out._score;
  return out;
}

async function getRecentSlugs(userId) {
  if (!userId) return { last24h: new Set(), last48h: new Set() };
  try {
    const now = Date.now();
    const [h24, h48] = await Promise.all([
      WorkoutHistory.find({ user_id: userId, workout_date: { $gte: new Date(now - 864e5) } }).lean(),
      WorkoutHistory.find({ user_id: userId, workout_date: { $gte: new Date(now - 1728e5) } }).lean(),
    ]);
    return {
      last24h: new Set(h24.flatMap((h) => h.exercises.map((e) => e.slug))),
      last48h: new Set(h48.flatMap((h) => h.exercises.map((e) => e.slug))),
    };
  } catch {
    return { last24h: new Set(), last48h: new Set() };
  }
}

function applyGoalAdjust(config, goal) {
  const patch = GOAL_ADJUSTMENTS[goal] || {};
  const out = { ...config };
  if (patch.reps) out.reps = patch.reps;
  if (patch.sets) out.sets = patch.sets;
  if (patch.sets_extra) out.sets = String((parseInt(out.sets, 10) || 3) + patch.sets_extra);
  if (patch.rest_delta) out.rest_seconds = Math.max(20, out.rest_seconds + patch.rest_delta);
  return out;
}

async function checkDeload(userId, muscleIds, sessionType) {
  if (!userId || !muscleIds.length || sessionType !== 'strength') return false;
  try {
    const fourWeeksAgo = new Date(Date.now() - 28 * 864e5);
    const history = await WorkoutHistory.find({
      user_id: userId,
      muscle_groups: { $in: muscleIds },
      workout_date: { $gte: fourWeeksAgo },
      is_deload: false,
    }).lean();
    const weeks = new Set(history.map((h) => {
      const d = new Date(h.workout_date);
      const startOfYear = new Date(d.getFullYear(), 0, 1);
      return `${d.getFullYear()}-${Math.ceil(((d - startOfYear) / 864e5 + 1) / 7)}`;
    }));
    return weeks.size >= 4;
  } catch {
    return false;
  }
}

async function getPreviousLoads(userId) {
  if (!userId) return {};
  try {
    const lastSession = await WorkoutHistory.findOne({ user_id: userId })
      .sort({ workout_date: -1 }).lean();
    if (!lastSession) return {};
    const loads = {};
    (lastSession.exercises || []).forEach((ex) => {
      if (ex.slug) {
        const loadArr = ex.load_kg_per_set || [];
        const lastLoad = loadArr.length ? loadArr[loadArr.length - 1] : 0;
        const repsArr = ex.reps_per_set || [];
        const allRepsHit = repsArr.length > 0 && repsArr.every((r) => r > 0);
        const lastRir = ex.last_set_rir !== null && ex.last_set_rir !== undefined ? ex.last_set_rir : 99;
        // Suggest progression: if all reps hit and sufficient RIR, add weight
        if (allRepsHit && lastRir >= 1 && lastLoad > 0) {
          const isCompound = STAPLE_COMPOUND_KEYWORDS.some((k) => ex.slug.includes(k.replace(/\s+/g, '-')));
          loads[ex.slug] = { suggested_next: roundToPlate(lastLoad + (isCompound ? 2.5 : 1)) };
        } else if (lastLoad > 0) {
          loads[ex.slug] = { suggested_next: lastLoad };
        }
      }
    });
    return loads;
  } catch {
    return {};
  }
}

function pairSuperset(exercises) {
  const compounds = exercises.filter((e) => isCompoundLike(e));
  const isolations = exercises.filter((e) => !isCompoundLike(e));
  const paired = [];
  for (let i = 0; i < isolations.length; i += 2) {
    const a = isolations[i];
    const b = isolations[i + 1];
    paired.push({ ...a, format: 'superset', pair_with: (b && b._id) ? b._id.toString() : null });
    if (b) paired.push({ ...b, format: 'superset', pair_with: a._id ? a._id.toString() : null });
  }
  return [...compounds, ...paired];
}

async function getWarmupExercises(total, muscleIds, genderFilter, excludeIds = []) {
  const filter = {
    ...COMMON_QUERY.published,
    mechanic: EXERCISE_MECHANIC.STRETCHING,
    _id: { $nin: excludeIds },
  };
  if (genderFilter) filter.gender = { $in: [genderFilter, 'both'] };
  if (muscleIds.length > 0) {
    const names = muscleIds.flatMap((id) => MUSCLE_UI_TO_ANATOMICAL[id] || []);
    if (names.length) {
      // eslint-disable-next-line security/detect-non-literal-regexp
      filter.primary_muscles = { $in: names.map((n) => new RegExp(n, 'i')) };
    }
  }
  const all = await Exercise.find(filter)
    .populate([
      { path: 'primary_muscle_groups', select: 'title slug' },
      { path: 'secondary_muscle_groups', select: 'title slug' },
      { path: 'equipments', select: 'title slug' },
    ])
    .limit(20)
    .lean({ virtuals: true });
  return shuffle(all).slice(0, total).map((ex) => ({
    ...ex,
    role: 'warmup',
    format: 'straight',
    suggested: { sets: '1', reps: '10-15 reps', rest_seconds: 0 },
  }));
}

async function getCooldownExercises(total, muscleIds, genderFilter, excludeIds = []) {
  const filter = {
    ...COMMON_QUERY.published,
    mechanic: EXERCISE_MECHANIC.STRETCHING,
    _id: { $nin: excludeIds },
  };
  if (genderFilter) filter.gender = { $in: [genderFilter, 'both'] };
  if (muscleIds.length > 0) {
    const names = muscleIds.flatMap((id) => MUSCLE_UI_TO_ANATOMICAL[id] || []);
    if (names.length) {
      // eslint-disable-next-line security/detect-non-literal-regexp
      filter.primary_muscles = { $in: names.map((n) => new RegExp(n, 'i')) };
    }
  }
  const all = await Exercise.find(filter)
    .populate([
      { path: 'primary_muscle_groups', select: 'title slug' },
      { path: 'secondary_muscle_groups', select: 'title slug' },
      { path: 'equipments', select: 'title slug' },
    ])
    .lean({ virtuals: true });
  return shuffle(all).slice(0, total).map((ex) => ({
    ...ex,
    role: 'cooldown',
    format: 'straight',
    suggested: { sets: '1', reps: '30-60s hold', rest_seconds: 0 },
  }));
}

function computeConfidence({
  sessionType, location, fullBody, muscles, userProfile, exerciseCount,
}) {
  if (sessionType === 'yoga' || sessionType === 'stretching') return 98;
  if (sessionType === 'cardio') return location === 'custom' ? 91 : 95;
  let score = 97;
  if (!fullBody && muscles.length === 0) score -= 8;
  if (muscles.length > 3) score -= 2;
  if (location === 'no_equipment') score -= 2;
  if (location === 'custom') score -= 4;
  if (exerciseCount < 3) score -= 10;
  const {
    gender, weight, height, goal,
  } = userProfile || {};
  if (gender && gender !== 'Prefer not to say') score += 1;
  if (weight) score += 1;
  if (height) score += 1;
  if (goal && goal !== 'Stay Active') score += 1;
  return Math.min(99, Math.max(60, score));
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1).replace(/-/g, ' ') : str;
}

function buildWorkoutName(sessionType, muscles, fullBody, difficultyKey, isDeload, durationMins) {
  const lvl = difficultyKey.charAt(0).toUpperCase() + difficultyKey.slice(1);
  let name;
  if (sessionType === 'yoga') name = `Yoga Flow — ${lvl}`;
  else if (sessionType === 'stretching') name = `Stretching & Mobility — ${lvl}`;
  else if (sessionType === 'cardio') name = `HIIT Circuit — ${durationMins} min`;
  else if (fullBody) name = `Full Body — ${lvl}`;
  else if (muscles.length === 1) name = `${capitalize(muscles[0])} Focus — ${lvl}`;
  else if (muscles.length === 2) name = `${capitalize(muscles[0])} & ${capitalize(muscles[1])} — ${lvl}`;
  else name = `Strength — ${lvl}`;
  return isDeload ? `Deload — ${name}` : name;
}

/* ════════════════════════════════════════════════════════════════════════════
   STAGE 1 — HARD FILTERS
   ════════════════════════════════════════════════════════════════════════════ */

/**
 * Fetch the base candidate pool from DB (location + mechanic + status),
 * then apply in-memory exclusions: injuries (Rule 24), age caps (Rule 23),
 * and pregnancy trimester (Rule 24.3).
 *
 * @returns {object[]} lean exercise docs (populated)
 */
async function stage1_hardFilters({
  sessionType, locationSlug, muscleIds, fullBody,
  injuries, pregnancyTrimester, age, equipmentSelected = [],
}) {
  // Build DB query for indexed fields only
  const dbFilter = { ...COMMON_QUERY.published };

  // Rule 2 — equipment/location filter
  if (locationSlug) dbFilter.workout_location = locationSlug;

  // Mechanic filter by session type
  if (sessionType === 'yoga' || sessionType === 'stretching') {
    dbFilter.mechanic = EXERCISE_MECHANIC.STRETCHING;
  } else if (sessionType === 'cardio') {
    dbFilter.mechanic = EXERCISE_MECHANIC.CARDIO;
  } else {
    // strength: compound + isolation + core + bodyweight
    dbFilter.mechanic = {
      $in: [
        EXERCISE_MECHANIC.COMPOUND,
        EXERCISE_MECHANIC.ISOLATION,
        EXERCISE_MECHANIC.CORE,
        EXERCISE_MECHANIC.BODYWEIGHT,
      ],
    };
  }

  // Rule 23 — age-based: under 16 → bodyweight only (exclude barbell compounds)
  if (age !== null && age < 16) {
    dbFilter.is_bodyweight = true;
  }
  // Rule 23 — over 50 → prefer supported/machine; over 60 → also exclude plyometrics
  // (handled in-memory below via keyword filter)

  // Muscle filter for strength: pre-filter to relevant muscles in DB
  if (sessionType === 'strength' && !fullBody && muscleIds.length > 0) {
    const anatomicalNames = muscleIds.flatMap((id) => MUSCLE_UI_TO_ANATOMICAL[id] || []);
    if (anatomicalNames.length > 0) {
      const muscleGroups = await MuscleGroup.find({ slug: { $in: muscleIds } }).lean();
      const muscleGroupIds = muscleGroups.map((g) => g._id);
      dbFilter.$or = [
        // eslint-disable-next-line security/detect-non-literal-regexp
        { primary_muscles: { $in: anatomicalNames.map((n) => new RegExp(n, 'i')) } },
        ...(muscleGroupIds.length ? [{ primary_muscle_groups: { $in: muscleGroupIds } }] : []),
      ];
    }
  }

  let pool = await Exercise.find(dbFilter)
    .populate([
      { path: 'primary_muscle_groups', select: 'title slug' },
      { path: 'secondary_muscle_groups', select: 'title slug' },
      { path: 'equipments', select: 'title slug' },
    ])
    .lean({ virtuals: true });

  // Rule 2 (custom) — filter pool to exercises that use only the selected equipment
  if (!locationSlug && equipmentSelected.length > 0) {
    // Expand frontend picker IDs to actual DB equipment slugs
    const dbSlugs = new Set();
    equipmentSelected.forEach((id) => {
      const mapped = EQUIPMENT_FRONTEND_TO_DB[id];
      if (mapped) {
        mapped.forEach((s) => dbSlugs.add(s));
      } else {
        // unknown id: try direct match as fallback
        dbSlugs.add(id);
      }
    });

    pool = pool.filter((ex) => {
      if (ex.is_bodyweight) return true;
      if (!ex.equipments || ex.equipments.length === 0) return true;
      return ex.equipments.some((eq) => dbSlugs.has(eq.slug));
    });
  }

  // Rule 24 — in-memory injury exclusions (current injuries only)
  const currentInjuries = (injuries || []).filter((i) => i.status === 'current').map((i) => i.type);
  currentInjuries.forEach((injuryType) => {
    const keywords = INJURY_EXCLUDE_KEYWORDS[injuryType] || [];
    if (keywords.length) {
      pool = pool.filter((ex) => !titleIncludes(ex, keywords));
    }
  });

  // Rule 24.3 — pregnancy trimester exclusions (apply for any non-null trimester, default T1 if unset)
  if (pregnancyTrimester !== null) {
    if (pregnancyTrimester === 3) {
      pool = pool.filter((ex) => !titleIncludes(ex, PREGNANCY_T3_KEYWORDS));
    } else if (pregnancyTrimester === 2) {
      pool = pool.filter((ex) => !titleIncludes(ex, PREGNANCY_T2_KEYWORDS));
    } else {
      pool = pool.filter((ex) => !titleIncludes(ex, PREGNANCY_T1_KEYWORDS));
    }
  }

  // Rule 23 — age > 60: exclude plyometrics
  if (age !== null && age > 60) {
    pool = pool.filter((ex) => ex.mechanic !== EXERCISE_MECHANIC.CARDIO || !/jump|box|plyo|sprint|bound/.test((ex.title || '').toLowerCase()));
  }

  return pool;
}

/* ════════════════════════════════════════════════════════════════════════════
   STAGE 2 — SOFT FILTERS (scoring)
   ════════════════════════════════════════════════════════════════════════════ */

/**
 * Score each exercise in the pool.
 * Higher score = preferred. Gender retry on empty sub-pool (Rule 19).
 *
 * Scoring:
 *   +3  primary muscle match
 *   +1  secondary muscle match
 *   +2  gender variant match
 *   -3  trained within 24h (non-staple compound)
 *   -2  trained within 48h (isolation)
 *
 * @returns {object[]} exercises with a `_score` field, sorted descending
 */
async function stage2_softFilters(pool, {
  muscleIds, fullBody, genderFilter, userId,
}) {
  // Load recent history slugs for Rule 12
  const recentSlugs = await getRecentSlugs(userId);

  // Build muscle anatomical name set for matching
  const primaryNames = new Set(
    muscleIds.flatMap((id) => (MUSCLE_UI_TO_ANATOMICAL[id] || []).map((n) => n.toLowerCase())),
  );

  let scored = pool.map((ex) => {
    let score = 50; // base

    // Rule 4 — muscle preference scoring
    if (!fullBody && primaryNames.size > 0) {
      const exPrimary = (ex.primary_muscles || []).map((m) => m.toLowerCase());
      const exSecondary = (ex.secondary_muscles || []).map((m) => m.toLowerCase());
      const hasPrimary = exPrimary.some((m) => [...primaryNames].some((n) => m.includes(n) || n.includes(m)));
      const hasSecondary = exSecondary.some((m) => [...primaryNames].some((n) => m.includes(n) || n.includes(m)));
      if (hasPrimary) score += 3;
      if (hasSecondary) score += 1;
    }

    // Rule 19 — gender variant boost (preference, not exclusion)
    if (genderFilter && (ex.gender === genderFilter || ex.gender === 'both')) score += 2;

    // Rule 12 — duplicate avoidance penalty
    const slug = ex.slug || '';
    if (slug) {
      const isStaple = deriveIsStaple(ex);
      if (recentSlugs.last24h.has(slug) && !isStaple) score -= 3;
      else if (recentSlugs.last48h.has(slug) && isIsolationLike(ex)) score -= 2;
    }

    return { ...ex, _score: score };
  });

  // Rule 19 — if gender-filtered pool would be empty for strength, retry without
  if (genderFilter) {
    const genderMatched = scored.filter((ex) => ex.gender === genderFilter || ex.gender === 'both');
    if (genderMatched.length > 0) {
      scored = genderMatched;
    }
    // else: keep full pool (retry logged implicitly by not filtering)
  }

  return scored.sort((a, b) => b._score - a._score);
}

/* ════════════════════════════════════════════════════════════════════════════
   STAGE 3 — SELECTION
   ════════════════════════════════════════════════════════════════════════════ */

/**
 * Pick the final exercise slots from the scored pool.
 * Rules: 1, 4.3, 5.1, 21, 26, 28.
 *
 * @returns {object[]} selected exercises (without _score)
 */
function stage3_selectExercises(scored, {
  sessionType, fullBody, total,
}) {
  const used = new Set();

  function pick(candidates, count) {
    const result = candidates.filter((ex) => !used.has(ex._id.toString())).slice(0, count);
    result.forEach((ex) => used.add(ex._id.toString()));
    return result;
  }

  // Non-strength sessions: simple top-N pick
  if (sessionType !== 'strength') {
    return pick(scored, total).map(clean);
  }

  // Strength: enforce compound → isolation ratio (Rule 5.1)
  const compounds = scored.filter((e) => isCompoundLike(e));
  const isolations = scored.filter((e) => isIsolationLike(e));
  const others = scored.filter((e) => !isCompoundLike(e) && !isIsolationLike(e));

  let compoundSlots;
  if (total <= 3) compoundSlots = 2;
  else if (total <= 5) compoundSlots = Math.ceil(total * 0.5);
  else compoundSlots = Math.ceil(total * 0.4);

  const isoSlots = total - compoundSlots;

  let selected = [];

  // Rule 4.3 — Full Body: enforce 6-movement-pattern coverage first
  if (fullBody) {
    const patternMap = {};
    scored.forEach((ex) => {
      const pat = inferMovementPattern(ex);
      if (pat && !patternMap[pat] && !used.has(ex._id.toString())) {
        patternMap[pat] = ex;
        used.add(ex._id.toString());
      }
    });
    // Add in canonical order
    FULL_BODY_PATTERNS.forEach((pat) => {
      if (patternMap[pat]) selected.push(patternMap[pat]);
    });
    // Fill remaining slots from scored pool (compound-first)
    const remaining = total - selected.length;
    if (remaining > 0) {
      const poolForRemaining = [...compounds, ...isolations, ...others];
      selected = [...selected, ...pick(poolForRemaining, remaining)];
    }
    selected = selected.slice(0, total);
  } else {
    const p1 = pick(compounds, compoundSlots);
    const p2 = pick(isolations, isoSlots);
    const p3 = pick(others, Math.max(0, total - (p1.length + p2.length)));
    selected = [...p1, ...p2, ...p3];
    // Fill any unfilled slots via Rule 26 cascade (fall through to next-best scored)
    if (selected.length < total) {
      selected = [...selected, ...pick(scored, total - selected.length)];
    }
  }

  // Rule 28 — Unilateral balance for sessions >= 45 min (total >= 6 exercises)
  if (total >= 6) {
    const hasUnilateral = selected.some((e) => e.is_unilateral);
    if (!hasUnilateral) {
      const unilateralCandidate = scored.find(
        (e) => e.is_unilateral && !used.has(e._id.toString()),
      );
      if (unilateralCandidate) {
        // Swap the last isolation slot
        const lastIsoIdx = [...selected].reverse().findIndex((e) => isIsolationLike(e));
        if (lastIsoIdx !== -1) {
          const actualIdx = selected.length - 1 - lastIsoIdx;
          selected[actualIdx] = unilateralCandidate;
        }
      }
    }
  }

  return selected.map(clean);
}

/* ════════════════════════════════════════════════════════════════════════════
   STAGE 4 — SESSION-LEVEL VALIDATION (Rule 27)
   ════════════════════════════════════════════════════════════════════════════ */

/**
 * Apply safety checks and swap offending exercises if needed.
 * Returns { exercises, warnings }.
 */
function stage4_validateSession(exercises, { difficultyKey, injuries }) {
  const warnings = [];
  let exs = [...exercises];

  const hasShoulderInjury = (injuries || []).some(
    (i) => i.type === 'shoulder' && i.status === 'current',
  );

  // Rule 27.1 — Spinal loading cap
  const spinalCap = SPINAL_CAP[difficultyKey] || 99;
  let spinalCount = 0;
  const spinalRemoved = [];
  exs = exs.filter((ex) => {
    if (deriveIsSpinal(ex)) {
      spinalCount += 1;
      if (spinalCount > spinalCap) {
        spinalRemoved.push(ex.title);
        return false;
      }
    }
    return true;
  });
  if (spinalRemoved.length === 1) {
    warnings.push(`Removed '${spinalRemoved[0]}' — spinal-loading cap reached for ${difficultyKey} level.`);
  } else if (spinalRemoved.length > 1) {
    warnings.push(`Spinal-loading cap reached — removed ${spinalRemoved.length} exercises: ${spinalRemoved.join(', ')}.`);
  }

  // Rule 27.2 — OHP cap
  const ohpCap = hasShoulderInjury ? 1 : OHP_CAP;
  let ohpCount = 0;
  const ohpRemoved = [];
  exs = exs.filter((ex) => {
    if (deriveIsOhp(ex)) {
      ohpCount += 1;
      if (ohpCount > ohpCap) {
        ohpRemoved.push(ex.title);
        return false;
      }
    }
    return true;
  });
  if (ohpRemoved.length === 1) {
    warnings.push(`Removed '${ohpRemoved[0]}' — overhead pressing volume cap reached.`);
  } else if (ohpRemoved.length > 1) {
    warnings.push(`Overhead pressing cap reached — removed ${ohpRemoved.length} exercises: ${ohpRemoved.join(', ')}.`);
  }

  // Rule 27.3 — CNS load cap
  const cnsCap = CNS_CAP[difficultyKey] || 25;
  let totalCns = exs.reduce((sum, ex) => sum + deriveCnsLoad(ex), 0);
  const cnsRemoved = [];
  while (totalCns > cnsCap && exs.length > 2) {
    const highIdx = exs.reduce((maxI, ex, i, arr) => (
      deriveCnsLoad(ex) > deriveCnsLoad(arr[maxI]) && isIsolationLike(ex) ? i : maxI
    ), 0);
    const removed = exs.splice(highIdx, 1)[0];
    totalCns -= deriveCnsLoad(removed);
    cnsRemoved.push(removed.title);
  }
  if (cnsRemoved.length === 1) {
    warnings.push(`CNS load optimised — swapped out '${cnsRemoved[0]}' for a lighter alternative.`);
  } else if (cnsRemoved.length > 1) {
    warnings.push(`CNS load optimised — ${cnsRemoved.length} high-intensity exercises replaced: ${cnsRemoved.join(', ')}.`);
  }

  // Rule 27.4 — Failure set cap: note in prescription (handled in Stage 5)

  return { exercises: exs, warnings };
}

/* ════════════════════════════════════════════════════════════════════════════
   STAGE 5 — PRESCRIPTION
   ════════════════════════════════════════════════════════════════════════════ */

/**
 * Attach sets/reps/rest/tempo/RIR/load to each exercise.
 * Rules: 3, 20, 21, 25, 3.2, 3.3, 29.
 *
 * @returns {{ exercises, isDeload }}
 */
async function stage5_prescribe(exercises, {
  sessionType, difficultyKey, goal, activityLevel,
  weightKg, userId, muscleIds, tempoDisplay,
  pregnancyTrimester,
}) {
  // Rule 29 — check if deload is needed
  const isDeload = await checkDeload(userId, muscleIds, sessionType);

  // Resolve previous load history for Rule 3.3 progression
  const previousLoads = await getPreviousLoads(userId);

  // Build base config
  let baseConfig;
  if (sessionType === 'yoga') baseConfig = YOGA_SET_REP;
  else if (sessionType === 'stretching') baseConfig = STRETCH_SET_REP;
  else if (sessionType === 'cardio') {
    baseConfig = { ...(CARDIO_SET_REP[difficultyKey] || CARDIO_SET_REP[EXERCISE_DIFFICULTY.INTERMEDIATE]) };
  } else {
    baseConfig = { ...(SET_REP_CONFIG[difficultyKey] || SET_REP_CONFIG[EXERCISE_DIFFICULTY.INTERMEDIATE]) };
    // Rule 20 — goal adjustment
    baseConfig = applyGoalAdjust(baseConfig, goal);
  }

  // Rule 21 — activity rest delta
  const restDelta = ACTIVITY_REST_DELTA[activityLevel] || 0;
  if (restDelta !== 0) {
    baseConfig = { ...baseConfig, rest_seconds: Math.max(20, (baseConfig.rest_seconds || 60) + restDelta) };
  }

  // Rule 29 — deload overrides
  if (isDeload) {
    const baseSets = parseInt(baseConfig.sets, 10) || 3;
    baseConfig = {
      ...baseConfig,
      sets: String(Math.max(1, Math.round(baseSets * 0.6))), // −40% volume
    };
  }

  const showTempoFlag = showTempo(tempoDisplay, difficultyKey);

  const prescribed = exercises.map((ex) => {
    const isCompound = isCompoundLike(ex);
    const mechType = isCompound ? 'compound' : 'isolation';

    // Rule 3.2 — starting load
    const pct = (LOAD_BW_PCT[difficultyKey] || LOAD_BW_PCT[EXERCISE_DIFFICULTY.INTERMEDIATE])[mechType];
    let loadKg = roundToPlate(weightKg * pct);

    // Rule 24.3 — pregnancy load caps: T3→60%, T2→70%, T1→80%
    if (pregnancyTrimester !== null && isCompound) {
      const PREGNANCY_LOAD_CAP = { 1: 0.8, 2: 0.7, 3: 0.6 };
      const cap = PREGNANCY_LOAD_CAP[pregnancyTrimester] || 0.8;
      loadKg = roundToPlate(loadKg * cap);
    }

    // Rule 3.3 — progressive load from history
    const histLoad = previousLoads[ex.slug || ''];
    if (histLoad && histLoad.suggested_next > 0) {
      loadKg = histLoad.suggested_next;
    }

    // Rule 25 — tempo
    const tempo = (sessionType === 'strength' || sessionType === 'cardio')
      ? TEMPO_BY_LEVEL[difficultyKey] || '2-0-2-0'
      : null;

    // RIR display text (Rule 25.3)
    const rir = baseConfig.rir_target;
    let rirDisplay = null;
    if (rir !== null && rir !== undefined) {
      rirDisplay = difficultyKey === EXERCISE_DIFFICULTY.BEGINNER
        ? `Stop with ${rir} reps left`
        : `${rir} RIR`;
    }

    const suggested = {
      ...baseConfig,
      ...(ex.is_bodyweight || sessionType === 'yoga' || sessionType === 'stretching'
        ? {}
        : { load_kg: loadKg }),
      ...(showTempoFlag && tempo ? { tempo } : {}),
      ...(rirDisplay ? { rir_display: rirDisplay } : {}),
    };

    return { ...ex, suggested };
  });

  return { exercises: prescribed, isDeload };
}

/* ════════════════════════════════════════════════════════════════════════════
   STAGE 6 — SEQUENCING
   ════════════════════════════════════════════════════════════════════════════ */

/**
 * Order exercises, apply superset/circuit format (Rule 30), prepend
 * warm-up + ramp sets (Rules 7, 31), append cool-down (Rule 8).
 *
 * @returns {{ warmup, main, cooldown }}
 */
async function stage6_sequence(exercises, {
  sessionType, goal, muscleIds,
  genderFilter, circuitPreference, durationMins,
  excludeIds = [],
}) {
  // Yoga / stretching: no reordering, no separate warmup/cooldown (Rules 9, 10)
  if (sessionType === 'yoga' || sessionType === 'stretching') {
    return { warmup: [], main: exercises, cooldown: [] };
  }

  // Rule 5.1 — compound-first ordering
  const compounds = exercises.filter((e) => isCompoundLike(e));
  const isolations = exercises.filter((e) => !isCompoundLike(e));
  let ordered = [...compounds, ...isolations];

  // Rule 30 — superset / circuit format
  let format = 'straight';
  if (
    (goal === 'Lose Weight' || goal === 'Endurance')
    && sessionType === 'cardio'
  ) {
    format = 'circuit';
  } else if (
    goal === 'Lose Weight'
    && circuitPreference
    && durationMins >= 30
  ) {
    format = 'circuit';
  } else if (
    (goal === 'Lose Weight' || goal === 'Endurance')
    && isolations.length >= 2
  ) {
    format = 'superset';
    // Pair adjacent isolation exercises
    ordered = pairSuperset(ordered);
  }

  // Rule 30 — cardio is always circuit
  if (sessionType === 'cardio') format = 'circuit';

  // Annotate format on each exercise
  const main = ordered.map((ex) => ({ ...ex, format }));

  // Rule 7 — warm-up block
  const warmup = await getWarmupExercises(2, muscleIds, genderFilter, excludeIds);

  // Rule 31 — ramp sets for heavy compound lifts
  const mainWithRamp = main.map((ex) => {
    if (!isCompoundLike(ex) || ex.is_bodyweight) return ex;
    const needsRamp = RAMP_TRIGGER_KEYWORDS.some((k) => (ex.title || '').toLowerCase().includes(k));
    if (!needsRamp) return ex;
    const loadKg = (ex.suggested && ex.suggested.load_kg) || 60;
    return {
      ...ex,
      ramp_sets: [
        { load_kg: roundToPlate(loadKg * 0.4), reps: 5 },
        { load_kg: roundToPlate(loadKg * 0.6), reps: 3 },
        { load_kg: roundToPlate(loadKg * 0.8), reps: 1 },
      ],
    };
  });

  // Rule 8 — cool-down block
  const cooldown = await getCooldownExercises(2, muscleIds, genderFilter, excludeIds);

  return { warmup, main: mainWithRamp, cooldown };
}

/* ════════════════════════════════════════════════════════════════════════════
   STAGE 7 — METADATA
   ════════════════════════════════════════════════════════════════════════════ */

/**
 * Rules: 14, 22 (calories), 15 (confidence), 17 (name), safety warnings.
 */
function stage7_metadata(session, {
  sessionType, time, customTime, difficultyKey, muscles,
  fullBody, location, weightKg, activityLevel, userProfile,
  isDeload, validationWarnings,
}) {
  // Rule 14/22 — corrected MET formula
  const mins = time === 'custom' ? (customTime || 30) : (time || 30);
  const hours = mins / 60;
  const [lo, hi] = MET_RANGE[sessionType] || [4.5, 6.0];
  const mult = ACTIVITY_MET_MULTIPLIER[activityLevel] || 1.1;
  const low = Math.round(lo * weightKg * hours * mult);
  const high = Math.round(hi * weightKg * hours * mult);
  const estimatedCalories = `${low}–${high}`;

  // Rule 15 — AI confidence
  const confidence = computeConfidence({
    sessionType,
    location,
    fullBody,
    muscles,
    userProfile,
    exerciseCount: session.main.length,
  });

  // Rule 17 — workout name
  const workoutName = buildWorkoutName(sessionType, muscles, fullBody, difficultyKey, isDeload, mins);

  // Merge warnings
  const warnings = [...validationWarnings];
  if (isDeload) {
    warnings.push('You\'ve trained these muscles hard for 4 weeks. This is a planned recovery session to maximize next month\'s gains.');
  }
  if (confidence < 70) {
    warnings.push('Limited match — consider expanding equipment or adjusting duration.');
  }

  return {
    workoutName, estimatedCalories, confidence, warnings, isDeload,
  };
}

/* ════════════════════════════════════════════════════════════════════════════
   PUBLIC ORCHESTRATOR
   ════════════════════════════════════════════════════════════════════════════ */

/**
 * Generate a complete AI workout plan following WORKOUT_BUILDER_RULES_v4.docx.
 *
 * @param {object} params
 * @param {string}        params.session_type   - strength | yoga | stretching | cardio
 * @param {number|string} params.time           - 15 | 30 | 45 | 60 | 'custom'
 * @param {number}        params.custom_time    - required when time === 'custom'
 * @param {string}        params.difficulty     - beginner | intermediate | advanced
 * @param {string}        params.location       - no_equipment | home_gym | small_gym | large_gym | custom
 * @param {string[]}      params.muscles        - muscle UI IDs e.g. ['chest', 'back']
 * @param {boolean}       params.full_body
 * @param {object}        params.user_profile   - from req.user (gender, dob, weight, goal, …)
 * @returns {object} workout plan
 */
const generateWorkout = async ({
  session_type = 'strength',
  time = 30,
  custom_time = null,
  difficulty = 'intermediate',
  location = 'small_gym',
  muscles = [],
  full_body = false,
  equipment_selected = [],
  user_profile = {},
}) => {
  try {
    // ── Derive profile values ─────────────────────────────────────────────────
    const genderFilter = normalizeGender(user_profile.gender);
    const age = calculateAge(user_profile.dob);
    const weightKg = toWeightKg(user_profile.weight, user_profile.weight_unit);
    const goal = user_profile.goal || 'Stay Active';
    const activityLevel = user_profile.activity_level || 'Moderately Active';
    const injuries = user_profile.injuries || [];
    const pregnancyTrimester = user_profile.pregnancy_trimester !== undefined ? user_profile.pregnancy_trimester : null;
    const userId = user_profile.user_id || null;
    const circuitPreference = user_profile.circuit_preference || false;
    const tempoDisplay = user_profile.tempo_display !== undefined ? user_profile.tempo_display : null;

    // Rule 23 — cap difficulty for age
    let difficultyKey = (difficulty || 'intermediate').toLowerCase();
    difficultyKey = capDifficultyForAge(difficultyKey, age);

    // Rule 2 — 'custom' location means no DB location filter
    const locationSlug = location === 'custom' ? null : location;

    // Rules 1 + 21 — exercise count
    const baseTotal = resolveExerciseCount(time, custom_time);
    const total = Math.max(2, baseTotal + (ACTIVITY_VOLUME_DELTA[activityLevel] || 0));

    const durationMins = time === 'custom' ? (custom_time || 30) : time;

    // ── Pipeline ──────────────────────────────────────────────────────────────

    // Stage 1 — Hard filters (DB + in-memory exclusions)
    const pool = await stage1_hardFilters({
      sessionType: session_type,
      locationSlug,
      muscleIds: muscles,
      fullBody: full_body,
      injuries,
      pregnancyTrimester,
      age,
      equipmentSelected: equipment_selected,
    });

    if (pool.length === 0) {
      return false;
    }

    // Stage 2 — Soft filters (scoring)
    const scored = await stage2_softFilters(pool, {
      muscleIds: muscles,
      fullBody: full_body,
      genderFilter,
      userId,
    });

    // Stage 3 — Selection
    const selected = stage3_selectExercises(scored, {
      sessionType: session_type,
      fullBody: full_body,
      total,
    });

    // Stage 4 — Session validation (safety checks)
    const { exercises: validated, warnings: validationWarnings } = stage4_validateSession(selected, {
      difficultyKey,
      injuries,
    });

    // Stage 5 — Prescription
    const { exercises: prescribed, isDeload } = await stage5_prescribe(validated, {
      sessionType: session_type,
      difficultyKey,
      goal,
      activityLevel,
      weightKg,
      userId,
      muscleIds: muscles,
      tempoDisplay,
      pregnancyTrimester,
    });

    // Stage 6 — Sequencing (order, supersets, warmup, ramp sets, cooldown)
    const mainIds = prescribed.map((ex) => ex._id.toString());
    const { warmup, main, cooldown } = await stage6_sequence(prescribed, {
      sessionType: session_type,
      goal,
      muscleIds: muscles,
      genderFilter,
      circuitPreference,
      durationMins,
      excludeIds: mainIds,
    });

    // Stage 7 — Metadata
    const {
      workoutName, estimatedCalories, confidence, warnings,
    } = stage7_metadata(
      { warmup, main, cooldown },
      {
        sessionType: session_type,
        time,
        customTime: custom_time,
        difficultyKey,
        muscles,
        fullBody: full_body,
        location,
        weightKg,
        activityLevel,
        userProfile: user_profile,
        isDeload,
        validationWarnings,
      },
    );

    const allExercises = [...warmup, ...main, ...cooldown];

    return {
      workout_name: workoutName,
      session_type,
      time: time === 'custom' ? custom_time : time,
      difficulty,
      location,
      muscles,
      full_body,
      is_deload: isDeload,
      warnings,
      user_profile: {
        gender: user_profile.gender,
        age,
        weight_kg: weightKg,
        goal,
        activity_level: activityLevel,
      },
      estimated_calories: estimatedCalories,
      ai_confidence: confidence,
      exercise_count: main.length,
      total_count: allExercises.length,
      exercises: allExercises,
    };
  } catch (error) {
    console.error('WorkoutModel@generateWorkout Error:', error.message, error.stack);
    return false;
  }
};

module.exports = { generateWorkout };
