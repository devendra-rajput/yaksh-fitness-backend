const mongoose = require('mongoose');
Schema = mongoose.Schema

const EquipmentsSchema = new mongoose.Schema({
    title: { type: String, default: '' },
    in_full_gym: { type: Boolean, default: false },
    in_small_gym: { type: Boolean, default: false },
    in_home_gym: { type: Boolean, default: false },
    default_weight: { type: String, default: "" },
    deleted_at: { type: String, default: '' }
}, { 
    timestamps: { 
        createdAt: 'created_at', 
        updatedAt: 'updated_at'
    } 
})

const Equipments = mongoose.model("equipments", EquipmentsSchema, 'equipments');

module.exports = Equipments;