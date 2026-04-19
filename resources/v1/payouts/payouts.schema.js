const mongoose = require('mongoose');

const PayoutSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'users', },
    referral_track_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'referral_track' }],
    amount: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'paid'], default: 'pending' },
    processed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
    processed_at: { type: Date },
    transaction_reference: { type: String, default: '' },
    deleted_at: { type: String, default: '' }

}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
});


const Payout = mongoose.model('payout', PayoutSchema, 'payouts');

module.exports = Payout;
