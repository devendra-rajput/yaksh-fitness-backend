const mongoose = require('mongoose');
const leanVirtuals = require('mongoose-lean-virtuals');

/* ─── Enums ──────────────────────────────────────────────────────────────── */

const EQUIPMENT_CATEGORY = Object.freeze({
  FREE_WEIGHTS: 'free_weights', // dumbbells, barbells, kettlebells
  RESISTANCE: 'resistance', // bands, cables, suspension trainers
  MACHINE: 'machine', // leg press, cable pulley machines
  BODYWEIGHT: 'bodyweight', // no equipment
  CARDIO: 'cardio', // treadmill, bike, rower
  OTHER: 'other',
});

const EQUIPMENT_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
});

/* ─── Schema ─────────────────────────────────────────────────────────────── */

const EquipmentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Equipment title is required'],
      trim: true,
      unique: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    slug: {
      type: String,
      lowercase: true,
      trim: true,
      unique: true,
      required: true,
    },
    category: {
      type: String,
      enum: {
        values: Object.values(EQUIPMENT_CATEGORY),
        message: '{VALUE} is not a valid equipment category',
      },
      required: true,
      index: true,
    },
    description: { type: String, default: '' },
    icon_url: { type: String, default: '' },
    // True when no physical equipment is needed (bodyweight exercises only)
    is_bodyweight: { type: Boolean, default: false, index: true },
    status: {
      type: String,
      enum: Object.values(EQUIPMENT_STATUS),
      default: EQUIPMENT_STATUS.ACTIVE,
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

EquipmentSchema.index({ category: 1, status: 1, deleted_at: 1 });
EquipmentSchema.index({ title: 'text' }, { name: 'equipment_text_idx' });

EquipmentSchema.query.active = function queryActive() {
  return this.where({ status: EQUIPMENT_STATUS.ACTIVE, deleted_at: { $in: [null, '', ' '] } });
};

EquipmentSchema.plugin(leanVirtuals);

const Equipment = mongoose.model('equipments', EquipmentSchema, 'equipments');

module.exports = { Equipment, EQUIPMENT_CATEGORY, EQUIPMENT_STATUS };
