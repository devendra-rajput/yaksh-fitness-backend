/**
 * Exercise Model
 * Data access layer for exercises.
 *
 * Supports:
 *  - CRUD with soft delete
 *  - Paginated listing with multi-field filters
 *  - Workout-builder query (generateExercises) — ported & improved from backend-old
 *  - Redis caching on list queries with granular invalidation
 */

const {
  Exercise,
  EXERCISE_DIFFICULTY,
  EXERCISE_MECHANIC,
  EXERCISE_STATUS,
  WORKOUT_SPLIT_CATEGORY,
} = require('./exercise.schema');

// eslint-disable-next-line global-require
const getRedis = () => require('../../../services/redis');
// eslint-disable-next-line global-require
const getDataHelper = () => require('../../../helpers/v1/data.helpers');

/* ─── Constants ──────────────────────────────────────────────────────────── */

const COMMON_QUERY = Object.freeze({
  notDeleted: { deleted_at: { $in: [null, '', ' '] } },
  published: { status: EXERCISE_STATUS.PUBLISHED, deleted_at: { $in: [null, '', ' '] } },
  collation: { locale: 'en', strength: 2 },
});

const CACHE_KEYS = Object.freeze({
  list: 'exercises:list:',
});

const POPULATE_FIELDS = [
  { path: 'primary_muscle_groups', select: 'title slug' },
  { path: 'secondary_muscle_groups', select: 'title slug' },
  { path: 'equipments', select: 'title slug' },
];

/* ─── Cache helpers ──────────────────────────────────────────────────────── */

const buildListCacheKey = (page, limit, filters) => {
  const filterStr = JSON.stringify(filters || {});
  return `${CACHE_KEYS.list}${page}:${limit}:${Buffer.from(filterStr).toString('base64')}`;
};

const invalidateListCache = async () => {
  const redis = getRedis();
  const keys = await redis.getAllSpecificKeys(CACHE_KEYS.list);
  if (keys && keys.length) await Promise.all(keys.map((k) => redis.clearKey(k)));
};

/* ─── Query Builder ──────────────────────────────────────────────────────── */

/**
 * Build a MongoDB filter object from a filterObj map.
 * Handles: title search, muscle group ids, equipment ids, difficulty, mechanic,
 *          workout_split_category, is_bodyweight.
 *
 * @param {object} filterObj
 * @returns {object} MongoDB filter
 */
const buildFilter = (filterObj = {}) => {
  const query = { ...COMMON_QUERY.notDeleted, status: EXERCISE_STATUS.PUBLISHED };

  if (filterObj.title) {
    query.$text = { $search: filterObj.title };
  }

  if (filterObj.muscle_group_ids?.length) {
    query.primary_muscle_groups = { $in: filterObj.muscle_group_ids };
  }

  if (filterObj.equipment_ids?.length) {
    query.equipments = { $in: filterObj.equipment_ids };
  }

  if (filterObj.difficulty) {
    query.difficulty = filterObj.difficulty;
  }

  if (filterObj.mechanic) {
    query.mechanic = filterObj.mechanic;
  }

  if (filterObj.workout_split_category) {
    query.workout_split_category = filterObj.workout_split_category;
  }

  if (filterObj.is_bodyweight === true || filterObj.is_bodyweight === false) {
    query.is_bodyweight = filterObj.is_bodyweight;
  }

  return query;
};

/* ─── CRUD ───────────────────────────────────────────────────────────────── */

const createOne = async (data) => {
  try {
    if (!data) throw new Error('Data is required');
    const exercise = await Exercise.create(data);
    invalidateListCache().catch(() => {});
    return exercise;
  } catch (error) {
    console.error('ExerciseModel@createOne Error:', error.message);
    return false;
  }
};

const getOneById = async (id, populate = true) => {
  try {
    let qb = Exercise.findOne({ _id: id, ...COMMON_QUERY.notDeleted });
    if (populate) qb = qb.populate(POPULATE_FIELDS);
    const result = await qb.lean({ virtuals: true });
    return result || false;
  } catch (error) {
    console.error('ExerciseModel@getOneById Error:', error.message);
    return false;
  }
};

const updateOne = async (id, data) => {
  try {
    if (!id || !data) throw new Error('ID and data are required');
    const exercise = await Exercise.findByIdAndUpdate(id, data, { new: true, lean: true });
    if (!exercise) return false;
    invalidateListCache().catch(() => {});
    return exercise;
  } catch (error) {
    console.error('ExerciseModel@updateOne Error:', error.message);
    return false;
  }
};

const softDeleteOne = async (id) => {
  try {
    return updateOne(id, { deleted_at: new Date().toISOString().replace('Z', '+00:00') });
  } catch (error) {
    console.error('ExerciseModel@softDeleteOne Error:', error.message);
    return false;
  }
};

/* ─── Paginated List ─────────────────────────────────────────────────────── */

/**
 * Fetch exercises with pagination and optional filters.
 * Results are cached in Redis for 1 hour.
 *
 * @param {number} page
 * @param {number} limit
 * @param {object} filterObj - { title, muscle_group_ids, equipment_ids, difficulty, mechanic, ... }
 */
const getAllWithPagination = async (page, limit, filterObj = {}) => {
  try {
    const redis = getRedis();
    const dataHelper = getDataHelper();

    const cacheKey = buildListCacheKey(page, limit, filterObj);
    const cached = await redis.getKey(cacheKey);
    if (cached) return cached;

    const filter = buildFilter(filterObj);
    const totalRecords = await Exercise.countDocuments(filter);
    const pagination = dataHelper.calculatePagination(totalRecords, page, limit);

    const exercises = await Exercise.find(filter)
      .populate(POPULATE_FIELDS)
      .sort({ created_at: -1 })
      .skip(pagination.offset)
      .limit(pagination.limit)
      .lean({ virtuals: true });

    const result = {
      data: exercises || [],
      pagination: {
        total: totalRecords,
        current_page: pagination.currentPage,
        total_pages: pagination.totalPages,
        per_page: pagination.limit,
      },
    };

    redis.setKey(cacheKey, result, 3600).catch(() => {}); // 1-hour TTL
    return result;
  } catch (error) {
    console.error('ExerciseModel@getAllWithPagination Error:', error.message);
    return false;
  }
};

/* ─── Workout Generator ──────────────────────────────────────────────────── */

/**
 * Set/rep config by difficulty (ported from backend-old, now authoritative).
 */
const SET_REP_CONFIG = Object.freeze({
  [EXERCISE_DIFFICULTY.BEGINNER]: { sets: '3', reps: '10-12', rest_seconds: 90 },
  [EXERCISE_DIFFICULTY.INTERMEDIATE]: { sets: '4', reps: '8-12', rest_seconds: 60 },
  [EXERCISE_DIFFICULTY.ADVANCED]: { sets: '4-5', reps: '6-10', rest_seconds: 45 },
});

/**
 * Generate an ordered exercise list for a workout plan.
 *
 * Improvements over backend-old:
 *  - Uses ObjectId refs → no in-memory string matching hacks
 *  - Deduplication via Set (same as legacy but cleaner)
 *  - Respects `mechanic` field instead of free-text exercise_category
 *  - Returns set/rep recommendations attached to each exercise
 *
 * @param {object} options
 * @param {string[]} options.muscle_group_ids  - Array of MuscleGroup ObjectId strings
 * @param {string[]} options.equipment_ids     - Array of Equipment ObjectId strings
 * @param {string}   options.difficulty        - beginner | intermediate | advanced
 * @param {number}   options.total             - Total exercises to return
 * @param {string[]} options.excluded_ids      - Exercise IDs to exclude (already done today)
 * @returns {Array<object>}
 */
const generateExercises = async ({
  muscle_group_ids = [],
  equipment_ids = [],
  difficulty = EXERCISE_DIFFICULTY.INTERMEDIATE,
  total = 6,
  excluded_ids = [],
}) => {
  try {
    const filter = {
      ...COMMON_QUERY.published,
      ...(muscle_group_ids.length && { primary_muscle_groups: { $in: muscle_group_ids } }),
      ...(equipment_ids.length && { equipments: { $in: equipment_ids } }),
      ...(excluded_ids.length && { _id: { $nin: excluded_ids } }),
    };

    const exercises = await Exercise.find(filter)
      .populate(POPULATE_FIELDS)
      .lean({ virtuals: true });

    if (!exercises.length) return [];

    // Bucket by mechanic (compound first, then isolation/etc.)
    const compounds = exercises.filter((e) => e.mechanic === EXERCISE_MECHANIC.COMPOUND);
    const isolations = exercises.filter((e) => e.mechanic === EXERCISE_MECHANIC.ISOLATION);
    const others = exercises.filter((e) => ![EXERCISE_MECHANIC.COMPOUND, EXERCISE_MECHANIC.ISOLATION].includes(e.mechanic));

    // Shuffle each bucket
    const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);
    const pool = [...shuffle(compounds), ...shuffle(isolations), ...shuffle(others)];

    // Deduplicate by _id and take `total`
    const seen = new Set();
    const selected = [];
    for (const ex of pool) {
      if (selected.length >= total) break;
      const id = ex._id.toString();
      if (!seen.has(id)) {
        seen.add(id);
        selected.push({
          ...ex,
          suggested: SET_REP_CONFIG[difficulty] || SET_REP_CONFIG[EXERCISE_DIFFICULTY.INTERMEDIATE],
        });
      }
    }

    return selected;
  } catch (error) {
    console.error('ExerciseModel@generateExercises Error:', error.message);
    return false;
  }
};

/* ─── Exports ────────────────────────────────────────────────────────────── */

module.exports = {
  createOne,
  getOneById,
  updateOne,
  softDeleteOne,
  getAllWithPagination,
  generateExercises,
  buildFilter,

  difficulties: EXERCISE_DIFFICULTY,
  mechanics: EXERCISE_MECHANIC,
  statuses: EXERCISE_STATUS,
  splitCategories: WORKOUT_SPLIT_CATEGORY,
};
