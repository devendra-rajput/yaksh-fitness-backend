const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
    training_preferences : {
        type: [String],
        _id: false,   // <-- disables automatic _id
        default: [] 
    },
    diet_styles : {
        type: [String],
        _id: false,   // <-- disables automatic _id
        default: [] 
    },
    cuisines  : {
        type: [String],
        _id: false,   // <-- disables automatic _id
        default: [] 
    },
    equipments  : {
        type: [String],
        _id: false,   // <-- disables automatic _id
        default: [] 
    },
    meal_types  : {
        type: [String],
        _id: false,   // <-- disables automatic _id
        default: [] 
    },
    deleted_at: { type: String, default: '' },
}, { 
    timestamps: { 
        createdAt: 'created_at', 
        updatedAt: 'updated_at' 
    } 
})

const Settings = mongoose.model("settings", SettingsSchema, 'settings');

module.exports = Settings;