const mongoose = require('mongoose');

const ReferralTrackSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "users" }, // This is the id of that user who used the referrer_code while creating the account
    referrer_id: { type: mongoose.Schema.Types.ObjectId, ref: "users" }, // This is the ID of that user who referred the current user (user_id)
    referrer_code: { type: String, required: true },
    reward_amount: { type: Number, required: true, default: 0 },
    reward_status: { type: String, enum: ['pending', 'eligible', 'paid', 'cancelled'], default: 'pending' },
    /**
     * Reward staus pending is the default status
     * Reward staus eligible will be mark as eligible to payout after 30 days of use the referral code
     * Reward staus paid will be mark as paid after the payout completed to referrer account
     * Reward staus cancelled will be mark as cancelled if user don't buy yearly plan within 30 days of user signup
     */
    reward_type: { type: String, enum: ['referral', 'referrer'], default: 'referrer' },
    /**
     * Referrer (Sender): In case of referrer reward_type the payment will be goes to referrer (referrer_id)
     * referral (Receiver): In case of referral reward_type the payment will be goes to referral (user_id)
     */
    eligible_to_payout_at: { type: Date, default: null },
    payout_email_sent_at: { type: Date, default: null },
    payout_status: { type: String, enum: ['pending', 'failed', 'stripe_error', 'paid'], default: 'pending' }, // Check this key for all error status of stripe
    payout_status_description: { type: String, required: false },
    deleted_at: { type: String, default: '' }
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
})

const ReferralTrack = mongoose.model("referral_track", ReferralTrackSchema, 'referral_tracks');

module.exports = ReferralTrack;