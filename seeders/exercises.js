/**
 * Exercise Seeder
 *
 * Seeds three collections in order:
 *   1. muscle_groups  — 12 groups derived from the video folder structure
 *   2. equipments     — all unique equipment items from the Excel
 *   3. exercises      — 1,400 curated exercises with ObjectId refs + R2 paths
 *
 * Source file: exercises_cleaned_1400.xlsx
 *   • Thumbnail URL / Video URL columns contain paths only  (e.g. /videos/legs/foo.mp4)
 *   • BASE_URL from R2_PUBLIC_URL .env variable is prepended at seed time
 *
 * Usage:
 *   node seeders/exercises.js --env development
 *   node seeders/exercises.js --env development --clean   ← drops collections first
 */

const path = require('path');
const fs = require('fs');
const minimist = require('minimist');
const mongoose = require('mongoose');
const xlsx = require('xlsx');

const { MuscleGroup } = require('../resources/v1/exercises/muscle_group.schema');
const { Equipment, EQUIPMENT_CATEGORY } = require('../resources/v1/exercises/equipment.schema');
const {
  Exercise,
  EXERCISE_DIFFICULTY,
  EXERCISE_MECHANIC,
  EXERCISE_STATUS,
  WORKOUT_SPLIT_CATEGORY,
} = require('../resources/v1/exercises/exercise.schema');

/* ─── CLI args ───────────────────────────────────────────────────────────── */

const { env: environment, clean: CLEAN } = minimist(process.argv.slice(2), {
  string: ['env'],
  boolean: ['clean'],
  default: { env: 'development', clean: false },
});

require('dotenv').config({ path: path.join(__dirname, '..', `.env.${environment}`) });

// R2 public base URL — prepended to the path-only URLs stored in the Excel
const BASE_URL = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

/* ─── Paths ──────────────────────────────────────────────────────────────── */

const EXCEL_PATH = path.join(__dirname, '..', '..', 'exercises_cleaned_1400.xlsx');

/* ─── Muscle Group master data ───────────────────────────────────────────── */

const MUSCLE_GROUPS = [
  {
    title: 'Abdominals', slug: 'abdominals', sort_order: 1, color: '#f97316',
  },
  {
    title: 'Back', slug: 'back', sort_order: 2, color: '#3b82f6',
  },
  {
    title: 'Biceps', slug: 'biceps', sort_order: 3, color: '#8b5cf6',
  },
  {
    title: 'Calisthenics, Cardio & Plyometrics', slug: 'calisthenics-cardio-plyo-functional', sort_order: 4, color: '#ec4899',
  },
  {
    title: 'Chest', slug: 'chest', sort_order: 5, color: '#ef4444',
  },
  {
    title: 'Forearms', slug: 'forearms', sort_order: 6, color: '#f59e0b',
  },
  {
    title: 'Legs', slug: 'legs', sort_order: 7, color: '#10b981',
  },
  {
    title: 'Powerlifting', slug: 'powerlifting', sort_order: 8, color: '#6366f1',
  },
  {
    title: 'Shoulders', slug: 'shoulders', sort_order: 9, color: '#06b6d4',
  },
  {
    title: 'Stretching & Mobility', slug: 'stretching-mobility', sort_order: 10, color: '#84cc16',
  },
  {
    title: 'Triceps', slug: 'triceps', sort_order: 11, color: '#f97316',
  },
  {
    title: 'Yoga', slug: 'yoga', sort_order: 12, color: '#a78bfa',
  },
];

// Excel "Muscle Group" value → slug
const EXCEL_MG_TO_SLUG = {
  Abdominals: 'abdominals',
  Back: 'back',
  Biceps: 'biceps',
  'Calisthenics-Cardio-Plyo-Functional': 'calisthenics-cardio-plyo-functional',
  Chest: 'chest',
  Forearms: 'forearms',
  Legs: 'legs',
  Powerlifting: 'powerlifting',
  Shoulders: 'shoulders',
  'Stretching - Mobility': 'stretching-mobility',
  Triceps: 'triceps',
  Yoga: 'yoga',
};

/* ─── Inference helpers ──────────────────────────────────────────────────── */

const toEquipmentCategory = (cat) => ({
  Bodyweight: 'bodyweight',
  'Free Weights': 'free_weights',
  Resistance: 'resistance',
}[cat] || 'bodyweight');

const FREE_WEIGHT_TITLES = new Set(['Dumbbells', 'Barbell', 'EZ Bar', 'Kettlebells', 'Weight Plate', 'Trap Bar', 'Dumbbell']);
const RESISTANCE_TITLES = /resistance band|cable|suspension|loop resistance/i;
const CARDIO_TITLES = /treadmill|bike|rowing|airbike|elliptical|ski ergometer/i;
const MACHINE_TITLES = /machine|press|pull.?down|hack squat|dip station|dip pull/i;

const classifyEquipment = (title) => {
  if (!title || title === 'None') return EQUIPMENT_CATEGORY.BODYWEIGHT;
  if (FREE_WEIGHT_TITLES.has(title)) return EQUIPMENT_CATEGORY.FREE_WEIGHTS;
  if (RESISTANCE_TITLES.test(title)) return EQUIPMENT_CATEGORY.RESISTANCE;
  if (CARDIO_TITLES.test(title)) return EQUIPMENT_CATEGORY.CARDIO;
  if (MACHINE_TITLES.test(title)) return EQUIPMENT_CATEGORY.MACHINE;
  return EQUIPMENT_CATEGORY.OTHER;
};

const MECHANIC_BY_SLUG = {
  abdominals: EXERCISE_MECHANIC.CORE,
  'stretching-mobility': EXERCISE_MECHANIC.STRETCHING,
  yoga: EXERCISE_MECHANIC.STRETCHING,
  'calisthenics-cardio-plyo-functional': EXERCISE_MECHANIC.CARDIO,
};
const ISOLATION_KEYWORDS = /\bcurl\b|kickback|fly|raise|extension|shrug|crunch/i;
const COMPOUND_KEYWORDS = /squat|deadlift|press|row|pull.?up|chin.?up|dip|lunge|thrust|clean|jerk|snatch/i;

const inferMechanic = (mgSlug, title) => {
  if (MECHANIC_BY_SLUG[mgSlug]) return MECHANIC_BY_SLUG[mgSlug];
  if (ISOLATION_KEYWORDS.test(title)) return EXERCISE_MECHANIC.ISOLATION;
  if (COMPOUND_KEYWORDS.test(title)) return EXERCISE_MECHANIC.COMPOUND;
  return EXERCISE_MECHANIC.COMPOUND;
};

const SPLIT_BY_SLUG = {
  chest: WORKOUT_SPLIT_CATEGORY.PUSH,
  shoulders: WORKOUT_SPLIT_CATEGORY.PUSH,
  triceps: WORKOUT_SPLIT_CATEGORY.PUSH,
  back: WORKOUT_SPLIT_CATEGORY.PULL,
  biceps: WORKOUT_SPLIT_CATEGORY.PULL,
  forearms: WORKOUT_SPLIT_CATEGORY.PULL,
  legs: WORKOUT_SPLIT_CATEGORY.LEGS,
  powerlifting: WORKOUT_SPLIT_CATEGORY.FULL_BODY,
  abdominals: WORKOUT_SPLIT_CATEGORY.CORE,
  'calisthenics-cardio-plyo-functional': WORKOUT_SPLIT_CATEGORY.CARDIO,
  'stretching-mobility': WORKOUT_SPLIT_CATEGORY.OTHER,
  yoga: WORKOUT_SPLIT_CATEGORY.OTHER,
};

const parseSteps = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/\n+/).map((s) => s.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
};

// Split on commas that are NOT inside parentheses.
// e.g. "Glutes (gluteus maximus, gluteus medius), Quads" → 2 items, not 3.
const parseMuscles = (text) => {
  if (!text || typeof text !== 'string') return [];
  const results = [];
  let current = '';
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '(') { depth += 1; current += ch; } else if (ch === ')') { depth -= 1; current += ch; } else if (ch === ',' && depth === 0) {
      const trimmed = current.trim();
      if (trimmed) results.push(trimmed);
      current = '';
    } else { current += ch; }
  }
  const last = current.trim();
  if (last) results.push(last);
  return results;
};

const deriveWorkoutLocations = (equipmentCategory) => {
  const locations = ['large_gym'];
  switch (equipmentCategory) {
    case 'bodyweight': locations.push('no_equipment', 'home_gym', 'small_gym'); break;
    case 'resistance':
    case 'free_weights': locations.push('home_gym', 'small_gym'); break;
    case 'machine': locations.push('small_gym'); break;
    default: break;
  }
  return locations;
};

const slugify = (str) => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/* ─── DB connection ──────────────────────────────────────────────────────── */

const connect = async () => { await mongoose.connect(process.env.DATABASE_URL); console.log('✅ MongoDB connected'); };
const disconnect = async () => { await mongoose.connection.close(); console.log('✅ MongoDB disconnected'); };

/* ─── Clean collections ──────────────────────────────────────────────────── */

const cleanCollections = async () => {
  console.log('\n🗑️  Dropping existing data…');
  const [ex, eq, mg] = await Promise.all([
    Exercise.deleteMany({}),
    Equipment.deleteMany({}),
    MuscleGroup.deleteMany({}),
  ]);
  console.log(`   exercises    deleted: ${ex.deletedCount}`);
  console.log(`   equipments   deleted: ${eq.deletedCount}`);
  console.log(`   muscle_groups deleted: ${mg.deletedCount}`);
};

/* ─── Seed muscle_groups ─────────────────────────────────────────────────── */

const seedMuscleGroups = async () => {
  console.log('\n🦵 Seeding muscle_groups…');
  const ops = MUSCLE_GROUPS.map((mg) => ({
    updateOne: { filter: { slug: mg.slug }, update: { $setOnInsert: mg }, upsert: true },
  }));
  const result = await MuscleGroup.bulkWrite(ops, { ordered: false });
  console.log(`   ↳ upserted: ${result.upsertedCount}  matched: ${result.matchedCount}`);
  const docs = await MuscleGroup.find({}, '_id slug').lean();
  const map = {};
  docs.forEach((d) => { map[d.slug] = d._id; });
  return map;
};

/* ─── Seed equipments ────────────────────────────────────────────────────── */

const seedEquipment = async (equipmentTitles) => {
  console.log('\n🏋️  Seeding equipments…');
  const docs = equipmentTitles.map((title) => ({
    title,
    slug: slugify(title),
    category: classifyEquipment(title),
    is_bodyweight: title === 'None',
  }));
  const ops = docs.map((doc) => ({
    updateOne: { filter: { slug: doc.slug }, update: { $setOnInsert: doc }, upsert: true },
  }));
  const result = await Equipment.bulkWrite(ops, { ordered: false });
  console.log(`   ↳ upserted: ${result.upsertedCount}  matched: ${result.matchedCount}`);
  const all = await Equipment.find({}, '_id slug title').lean();
  const byTitle = {};
  const bySlug = {};
  all.forEach((d) => { byTitle[d.title] = d._id; bySlug[d.slug] = d._id; });
  return { byTitle, bySlug };
};

/* ─── Seed exercises ─────────────────────────────────────────────────────── */

const seedExercises = async (rows, mgMap, equipMap) => {
  console.log('\n💪 Seeding exercises…');

  const BATCH = 500;
  let inserted = 0;
  let skipped = 0;

  const batchPromises = [];
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);

    const ops = batch.map((row) => {
      const mgSlug = EXCEL_MG_TO_SLUG[row.muscle_group] || 'abdominals';
      const mgId = mgMap[mgSlug];
      const mechanic = inferMechanic(mgSlug, row.exercise_name);
      const splitCat = SPLIT_BY_SLUG[mgSlug] || WORKOUT_SPLIT_CATEGORY.OTHER;
      const isBodywt = row.equipment === 'None';
      const gender = (row.gender || 'Both').toLowerCase();
      const eqSlug = slugify(row.equipment || 'None');
      const eqId = equipMap.bySlug[eqSlug];
      const eqCategory = toEquipmentCategory(row.category);

      // URL paths from Excel (e.g. /videos/legs/foo.mp4) — prepend BASE_URL
      const video_url = row.video_url ? `${BASE_URL}${row.video_url}` : '';
      const thumbnail_url = row.thumbnail_url ? `${BASE_URL}${row.thumbnail_url}` : '';

      const doc = {
        title: row.exercise_name,
        slug: slugify(row.exercise_name + (gender !== 'both' ? `-${gender}` : '')),
        instructions: parseSteps(row.instructions),
        tips: parseSteps(row.tips),
        primary_muscle_groups: mgId ? [mgId] : [],
        secondary_muscle_groups: [],
        primary_muscles: parseMuscles(row.primary),
        secondary_muscles: parseMuscles(row.secondary),
        equipments: eqId ? [eqId] : [],
        mechanic,
        workout_split_category: splitCat,
        difficulty: EXERCISE_DIFFICULTY.INTERMEDIATE,
        gender,
        equipment_category: eqCategory,
        workout_location: deriveWorkoutLocations(eqCategory),
        is_bodyweight: isBodywt,
        video_url,
        thumbnail_url,
        status: EXERCISE_STATUS.PUBLISHED,
        deleted_at: '',
      };

      return {
        updateOne: {
          filter: { slug: doc.slug },
          update: { $setOnInsert: doc },
          upsert: true,
        },
      };
    });

    batchPromises.push(Exercise.bulkWrite(ops, { ordered: false }));
  }

  const results = await Promise.all(batchPromises);
  results.forEach((result) => {
    inserted += result.upsertedCount;
    skipped += result.matchedCount;
  });

  console.log(`\n   ↳ Completed processing ${rows.length} exercises.`);

  console.log(`\n   ↳ upserted: ${inserted}  already existed: ${skipped}`);
};

/* ─── Read Excel ─────────────────────────────────────────────────────────── */

const readExcel = () => {
  if (!fs.existsSync(EXCEL_PATH)) {
    throw new Error(`Excel not found: ${EXCEL_PATH}`);
  }

  console.log(`\n📊 Reading: ${EXCEL_PATH}`);
  const wb = xlsx.readFile(EXCEL_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(ws, { defval: '' });
  console.log(`   ↳ ${rows.length} rows`);

  const equipSet = new Set();
  rows.forEach((r) => { if (r.Equipment) equipSet.add(r.Equipment); });
  equipSet.add('None');

  return { rows, equipmentTitles: [...equipSet].sort() };
};

/* ─── Main ───────────────────────────────────────────────────────────────── */

const run = async () => {
  try {
    console.log(`\n🌱 Exercise Seeder — env: ${environment}${CLEAN ? ' [--clean]' : ''}`);

    if (!BASE_URL) {
      console.warn('⚠️  R2_PUBLIC_URL not set — video_url and thumbnail_url will be empty.');
    } else {
      console.log(`   R2 base URL: ${BASE_URL}`);
    }

    const { rows, equipmentTitles } = readExcel();

    await connect();

    if (CLEAN) await cleanCollections();

    const mgMap = await seedMuscleGroups();
    const equipMap = await seedEquipment(equipmentTitles);

    const normalised = rows.map((r) => ({
      muscle_group: r['Muscle Group'] || '',
      category: r.Category || '',
      exercise_name: r['Exercise Name'] || '',
      gender: r.Gender || 'Both',
      instructions: r.Instructions || '',
      tips: r.Tips || '',
      primary: r['Primary Muscles'] || '',
      secondary: r['Secondary Muscles'] || '',
      equipment: r.Equipment || 'None',
      video_url: r['Video URL'] || '',
      thumbnail_url: r['Thumbnail URL'] || '',
    }));

    await seedExercises(normalised, mgMap, equipMap);

    console.log('\n🎉 All done!\n');
    await disconnect();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Seeder failed:', err.message);
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  }
};

if (require.main === module) run();
module.exports = { run };
