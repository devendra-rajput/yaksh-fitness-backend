// models/subscription.js
const mongoose = require("mongoose");

const SubscriptionSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },

  // RevenueCat store values: "PLAY_STORE" | "APP_STORE"
  platform: { type: String, enum: ["PLAY_STORE", "APP_STORE"], required: true },

  // Apple
  original_transaction_id: { type: String, index: true },
  app_account_token: { type: String, required: false, default: '' },

  // Google
  purchase_token: { type: String, index: true },
  subscription_id: { type: String, required: false, default: '' },
  obfuscated_account_id: { type: String, required: false, default: '' },
  package_name: { type: String, required: false, default: '' },

  product_id: { type: String, required: true },
  product_identifier: { type: String, required: false, default: '' },
  level: { type: Number, required: false },

  status: {
    type: String,
    enum: ["active", "in_grace", "on_hold", "canceled", "expired", "refunded", "scheduled"],
    required: true,
    index: true
  },
  plan_type: {
    type: String,
    enum: ["YEARLY", "MONTHLY", "UNKNOWN"],
    required: false
  },

  is_trial_plan: { type: Boolean, default: false },
  trial_plan_offer_code: { type: String, default: '' },

  current_period_start: { type: String, required: true },
  current_period_end: { type: String, required: true, index: true },

  cancel_at_period_end: { type: Boolean, default: false },
  canceled_at: { type: String, default: '' },

  country_code: { type: String, default: '' },

  price: {
    amount: { type: String, default: '' },
    currency: { type: String, default: '' }
  },

  // RevenueCat event-level idempotency key (replaces in-memory Set)
  rc_event_id: { type: String, index: true, unique: true, sparse: true },

  // Raw RevenueCat event metadata
  metadata: { type: Object, default: null },

  // RevenueCat raw event payload (useful for debugging)
  latest_verification: { type: Object, default: null },

  // Soft-delete support (used in model queries)
  deleted_at: { type: String, default: null },

  // Timestamp of the last time this record was written from RC (webhook or sync API).
  // Used as a version guard: only overwrite if incoming data is newer.
  rc_synced_at: { type: Date, default: null },

}, {
  timestamps: {
    createdAt: "created_at",
    updatedAt: "updated_at"
  }
});

module.exports = mongoose.model("Subscription", SubscriptionSchema);