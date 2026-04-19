const mongoose = require('mongoose');

const MuscleGroupsSchema = new mongoose.Schema({
    title: { type: String, default: '' },
    deleted_at: { type: String, default: '' }
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
})

const MuscleGroups = mongoose.model("muscle_group", MuscleGroupsSchema, 'muscle_groups');

module.exports = MuscleGroups;
