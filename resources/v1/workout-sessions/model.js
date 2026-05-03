const { WorkoutSession } = require('./schema');
const { WorkoutHistory } = require('../workout-history/schema');
const { logger } = require('../../../utils/logger');

const createSession = async (userId, data) => {
  try {
    // Reuse existing active session instead of creating a new document each time
    const existing = await WorkoutSession.findOneAndUpdate(
      { user_id: userId, status: 'active' },
      {
        ...data, started_at: new Date(), current_exercise_index: 0, completed_at: null,
      },
      { new: true },
    ).lean();
    if (existing) return existing;

    const session = await WorkoutSession.create({ user_id: userId, ...data });
    return session;
  } catch (error) {
    logger.error('WorkoutSessionModel@createSession Error', { error: error.message });
    return false;
  }
};

const getActive = async (userId) => {
  try {
    const session = await WorkoutSession.findOne({ user_id: userId, status: 'active' })
      .sort({ created_at: -1 })
      .lean();
    return session || null;
  } catch (error) {
    logger.error('WorkoutSessionModel@getActive Error', { error: error.message });
    return null;
  }
};

const updateSession = async (userId, sessionId, updates) => {
  try {
    const session = await WorkoutSession.findOneAndUpdate(
      { _id: sessionId, user_id: userId },
      updates,
      { new: true },
    ).lean();
    return session || false;
  } catch (error) {
    logger.error('WorkoutSessionModel@updateSession Error', { error: error.message });
    return false;
  }
};

/* MET values per session type (metabolic equivalent of task).
 * Formula: calories = MET × 70 kg (std weight) × duration_hours
 * Stored per-session so streak logic can query calories_burned later. */
const MET_BY_TYPE = {
  strength: 5.0,
  hiit: 9.0,
  cardio: 7.5,
  flexibility: 2.5,
  sports: 6.5,
};
const STANDARD_WEIGHT_KG = 70;

const estimateCalories = (sessionType, startedAt, completedAt) => {
  const durationHours = (new Date(completedAt) - new Date(startedAt)) / 3600000;
  const met = MET_BY_TYPE[sessionType] || 5.0;
  return Math.max(1, Math.round(met * STANDARD_WEIGHT_KG * durationHours));
};

const completeSession = async (userId, sessionId) => {
  try {
    const completedAt = new Date();
    const raw = await WorkoutSession.findOne({ _id: sessionId, user_id: userId, status: 'active' }).lean();
    if (!raw) return false;

    const calories = estimateCalories(raw.session_type, raw.started_at, completedAt);

    const session = await WorkoutSession.findOneAndUpdate(
      { _id: sessionId, user_id: userId, status: 'active' },
      { status: 'completed', completed_at: completedAt, calories_burned: calories },
      { new: true },
    ).lean();
    if (!session) return false;

    const completedExercises = session.exercises.filter(
      (e) => !e.is_skipped && e.sets.some((s) => s.completed),
    );
    if (completedExercises.length > 0) {
      await WorkoutHistory.create({
        user_id: userId,
        session_type: session.session_type,
        muscle_groups: session.muscles,
        is_deload: false,
        calories_burned: calories,
        exercises: completedExercises.map((e) => ({
          exercise_id: e.exercise_id,
          slug: e.slug,
          sets_completed: e.sets.filter((s) => s.completed).length,
          reps_per_set: e.sets.filter((s) => s.completed).map((s) => s.reps || 0),
          load_kg_per_set: e.sets.filter((s) => s.completed).map((s) => s.load_kg || 0),
          last_set_rir: null,
        })),
      });
    }

    return session;
  } catch (error) {
    logger.error('WorkoutSessionModel@completeSession Error', { error: error.message });
    return false;
  }
};

const getHistory = async (userId, page = 1, limit = 20) => {
  try {
    const filter = { user_id: userId, status: 'completed' };
    const projection = {
      workout_name: 1,
      session_type: 1,
      difficulty: 1,
      muscles: 1,
      started_at: 1,
      completed_at: 1,
      calories_burned: 1,
      exercises: 1,
    };
    const [sessions, total] = await Promise.all([
      WorkoutSession.find(filter, projection)
        .sort({ completed_at: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      WorkoutSession.countDocuments(filter),
    ]);
    return {
      sessions,
      total,
      page,
      limit,
    };
  } catch (error) {
    logger.error('WorkoutSessionModel@getHistory Error', { error: error.message });
    return null;
  }
};

module.exports = {
  createSession,
  getActive,
  updateSession,
  completeSession,
  getHistory,
};
