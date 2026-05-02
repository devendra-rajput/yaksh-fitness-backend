const mongoose = require('mongoose');
const leanVirtuals = require('mongoose-lean-virtuals');

/* ─── Enums ──────────────────────────────────────────────────────────────── */

const MUSCLE_GROUP_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
});

/* ─── Schema ─────────────────────────────────────────────────────────────── */

const MuscleGroupSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Muscle group title is required'],
      trim: true,
      unique: true,
      maxlength: [80, 'Title cannot exceed 80 characters'],
    },
    slug: {
      type: String,
      lowercase: true,
      trim: true,
      unique: true,
      required: true,
    },
    description: { type: String, default: '' },
    icon_url: { type: String, default: '' },
    // Hex or Tailwind token used in UI cards
    color: { type: String, default: '' },
    sort_order: { type: Number, default: 0 },
    status: {
      type: String,
      enum: Object.values(MUSCLE_GROUP_STATUS),
      default: MUSCLE_GROUP_STATUS.ACTIVE,
      index: true,
    },
    deleted_at: { type: String, default: '' },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => { const o = { ...ret }; delete o.__v; return o; },
    },
    toObject: { virtuals: true },
  },
);

MuscleGroupSchema.index({ status: 1, deleted_at: 1 });
MuscleGroupSchema.index({ title: 'text' }, { name: 'muscle_group_text_idx' });

MuscleGroupSchema.query.active = function queryActive() {
  return this.where({ status: MUSCLE_GROUP_STATUS.ACTIVE, deleted_at: { $in: [null, '', ' '] } });
};

MuscleGroupSchema.plugin(leanVirtuals);

const MuscleGroup = mongoose.model('muscle_groups', MuscleGroupSchema, 'muscle_groups');

module.exports = { MuscleGroup, MUSCLE_GROUP_STATUS };
