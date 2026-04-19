/**
 * Exercise Schema
 *
 * Design decisions vs backend-old:
 *
 * 1. NORMALIZATION
 *    - muscle_groups and equipments are stored as ObjectId refs to their own
 *      collections (MuscleGroup, Equipment) rather than embedded {id, title}
 *      objects. This prevents data duplication and drift; a muscle group rename
 *      only happens in one place.
 *    - `exercise_category` and `workout_split_category` are validated against
 *      enums instead of free-form strings.
 *
 * 2. INDEXING STRATEGY (see below schema for detailed rationale)
 *    - Primary reads are: filter by muscle group, difficulty, equipment,
 *      category, and search by title. All hot paths are covered.
 *
 * 3. SCALABILITY
 *    - `thumbnail_url` and `video_url` point to CDN/S3 – not stored locally.
 *    - Soft-delete via `deleted_at` avoids cascading hard deletes.
 *    - Compound indexes chosen over single-field where queries combine fields.
 *
 * 4. ADDED FIELDS vs legacy
 *    - `difficulty`     – enables beginner/intermediate/advanced filtering
 *    - `is_unilateral`  – flag for unilateral exercises (affects set/rep advice)
 *    - `is_bodyweight`  – quick filter without joining equipment
 *    - `met_value`      – metabolic equivalent (used for calorie-burn estimates)
 *    - `force_type`     – Push/Pull/Hold/Static (useful for workout builder)
 *    - `mechanic`       – Compound / Isolation (replaces exercise_category)
 *    - `status`         – draft / published / archived (content moderation)
 */

const mongoose = require('mongoose');
const leanVirtuals = require('mongoose-lean-virtuals');

/* ─── Enums ──────────────────────────────────────────────────────────────── */

const EXERCISE_DIFFICULTY = Object.freeze({
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
});

const EXERCISE_MECHANIC = Object.freeze({
  COMPOUND: 'compound',
  ISOLATION: 'isolation',
  CARDIO: 'cardio',
  CORE: 'core',
  BODYWEIGHT: 'bodyweight',
  STRETCHING: 'stretching',
});

const WORKOUT_SPLIT_CATEGORY = Object.freeze({
  PUSH: 'push',
  PULL: 'pull',
  LEGS: 'legs',
  UPPER: 'upper',
  LOWER: 'lower',
  FULL_BODY: 'full_body',
  CARDIO: 'cardio',
  CORE: 'core',
  OTHER: 'other',
});

const FORCE_TYPE = Object.freeze({
  PUSH: 'push',
  PULL: 'pull',
  STATIC: 'static',
  HOLD: 'hold',
});

const EXERCISE_STATUS = Object.freeze({
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
});

/* ─── Sub-schemas ────────────────────────────────────────────────────────── */

/**
 * Default set/rep recommendations per difficulty level.
 * Stored inline (not in a separate collection) because they are
 * exercise-specific and rarely queried independently.
 */
const SetRepRecommendationSchema = new mongoose.Schema(
  {
    difficulty: {
      type: String,
      enum: Object.values(EXERCISE_DIFFICULTY),
      required: true,
    },
    sets: { type: String, default: '3' },           // e.g. "3-4"
    reps: { type: String, default: '8-12' },        // e.g. "8-12" or "30s"
    rest_seconds: { type: Number, default: 60 },
    weight_unit: {
      type: String,
      enum: ['lbs', 'kg', 'bodyweight', 'none'],
      default: 'lbs',
    },
    weight_range: { type: String, default: '' },    // e.g. "30-50"
    tempo: { type: String, default: '' },           // e.g. "2-0-2-0"
  },
  { _id: false },
);

/* ─── Main Exercise Schema ───────────────────────────────────────────────── */

const ExerciseSchema = new mongoose.Schema(
  {
    // ── Identity & Content ───────────────────────────────────────────────────
    title: {
      type: String,
      required: [true, 'Exercise title is required'],
      trim: true,
      maxlength: [120, 'Title cannot exceed 120 characters'],
      index: true,          // text search via title prefix
    },
    slug: {
      type: String,
      lowercase: true,
      trim: true,
      unique: true,
      sparse: true,         // allows exercises without slugs during seeding
    },
    description: { type: String, default: '' },
    instructions: { type: [String], default: [] },
    tips: { type: [String], default: [] },
    common_mistakes: { type: [String], default: [] },

    // ── Categorisation ───────────────────────────────────────────────────────
    /**
     * Mechanic replaces the legacy `exercise_category` free-text field.
     * Indexed because workout builder queries filter heavily on this.
     */
    mechanic: {
      type: String,
      enum: {
        values: Object.values(EXERCISE_MECHANIC),
        message: '{VALUE} is not a valid mechanic',
      },
      required: [true, 'Mechanic is required'],
      index: true,
    },

    /**
     * Workout split (Push/Pull/Legs…).
     * Replaces legacy `workout_split_categrory` (sic).
     */
    workout_split_category: {
      type: String,
      enum: {
        values: Object.values(WORKOUT_SPLIT_CATEGORY),
        message: '{VALUE} is not a valid split category',
      },
      default: WORKOUT_SPLIT_CATEGORY.OTHER,
      index: true,
    },

    difficulty: {
      type: String,
      enum: {
        values: Object.values(EXERCISE_DIFFICULTY),
        message: '{VALUE} is not a valid difficulty',
      },
      required: [true, 'Difficulty is required'],
      index: true,
    },

    force_type: {
      type: String,
      enum: Object.values(FORCE_TYPE),
      default: null,
    },

    // ── Muscle Groups (normalized ObjectId refs) ─────────────────────────────
    /**
     * Referencing MuscleGroup documents instead of embedding {id, title}.
     * Rationale: a single rename propagates instantly; no denormalization drift.
     *
     * Index: these are the most common filter fields in the workout builder.
     */
    primary_muscle_groups: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'muscle_groups' }],
      default: [],
      index: true,
    },
    secondary_muscle_groups: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'muscle_groups' }],
      default: [],
    },

    // ── Equipment (normalized ObjectId refs) ─────────────────────────────────
    /**
     * Also referenced. The workout builder heavily filters by equipment.
     * Compound index `{equipment, deleted_at}` covers the primary query pattern.
     */
    equipments: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'equipments' }],
      default: [],
      index: true,
    },

    // ── Quick-filter Boolean Flags ────────────────────────────────────────────
    is_bodyweight: {
      type: Boolean,
      default: false,
      index: true,
    },
    is_unilateral: {
      type: Boolean,
      default: false,
    },

    // ── Media ─────────────────────────────────────────────────────────────────
    video_url: { type: String, default: '' },
    thumbnail_url: { type: String, default: '' },

    // ── Performance & Calorie Estimation ─────────────────────────────────────
    /**
     * MET (Metabolic Equivalent of Task) value.
     * Used with user body weight to estimate calorie burn:
     *   kcal/min = MET × weight_kg × 3.5 / 200
     */
    met_value: {
      type: Number,
      default: null,
      min: 0.5,
      max: 20,
    },

    // ── Set/Rep Recommendations ───────────────────────────────────────────────
    recommendations: {
      type: [SetRepRecommendationSchema],
      default: [],
    },

    // ── Moderation ────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: Object.values(EXERCISE_STATUS),
      default: EXERCISE_STATUS.PUBLISHED,
      index: true,
    },

    // ── Soft Delete ───────────────────────────────────────────────────────────
    deleted_at: {
      type: String,
      default: '',
      index: true,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        const out = { ...ret };
        delete out.__v;
        return out;
      },
    },
    toObject: { virtuals: true },
  },
);

/* ─── Compound Indexes ───────────────────────────────────────────────────────
 *
 * Chosen based on actual workout-builder query patterns from backend-old:
 *
 *  Query 1:  Filter by primary_muscle_groups + deleted_at
 *            → { primary_muscle_groups: 1, deleted_at: 1 }
 *
 *  Query 2:  Filter by equipments + deleted_at
 *            → { equipments: 1, deleted_at: 1 }
 *
 *  Query 3:  Filter by difficulty + mechanic + deleted_at
 *            (workout builder selects compound/isolation per difficulty level)
 *            → { difficulty: 1, mechanic: 1, deleted_at: 1 }
 *
 *  Query 4:  Filter by workout_split_category + status + deleted_at
 *            (admin content management + plan generation)
 *            → { workout_split_category: 1, status: 1, deleted_at: 1 }
 *
 *  Query 5:  Title text search (admin / exercise library)
 *            → Text index on `title` and `description`
 *
 * Note: Single-field indexes on primary_muscle_groups, equipments, difficulty,
 * mechanic, and status (declared above) are still useful for aggregation
 * pipelines that filter on only one field.
 * ────────────────────────────────────────────────────────────────────────── */

ExerciseSchema.index({ primary_muscle_groups: 1, deleted_at: 1 });
ExerciseSchema.index({ equipments: 1, deleted_at: 1 });
ExerciseSchema.index({ difficulty: 1, mechanic: 1, deleted_at: 1 });
ExerciseSchema.index({ workout_split_category: 1, status: 1, deleted_at: 1 });
ExerciseSchema.index({ is_bodyweight: 1, deleted_at: 1 });

// Full-text search index (for exercise library search bar)
ExerciseSchema.index({ title: 'text', description: 'text' }, {
  weights: { title: 10, description: 1 },
  name: 'exercise_text_idx',
});

/* ─── Virtuals ───────────────────────────────────────────────────────────── */

ExerciseSchema.virtual('is_published').get(function isPublished() {
  return this.status === EXERCISE_STATUS.PUBLISHED;
});

/* ─── Query Helpers ──────────────────────────────────────────────────────── */

ExerciseSchema.query.published = function queryPublished() {
  return this.where({ status: EXERCISE_STATUS.PUBLISHED, deleted_at: { $in: [null, '', ' '] } });
};

ExerciseSchema.query.notDeleted = function queryNotDeleted() {
  return this.where({ deleted_at: { $in: [null, '', ' '] } });
};

ExerciseSchema.plugin(leanVirtuals);

/* ─── Model ──────────────────────────────────────────────────────────────── */

const Exercise = mongoose.model('exercises', ExerciseSchema, 'exercises');

module.exports = {
  Exercise,
  EXERCISE_DIFFICULTY,
  EXERCISE_MECHANIC,
  WORKOUT_SPLIT_CATEGORY,
  FORCE_TYPE,
  EXERCISE_STATUS,
};
