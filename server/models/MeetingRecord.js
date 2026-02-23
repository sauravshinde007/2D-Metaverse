import mongoose from 'mongoose';

const meetingRecordSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    roomName: { type: String, required: true },
    joinTime: { type: Date, default: Date.now },
    leaveTime: { type: Date },
    duration: { type: Number, default: 0 }, // in seconds
}, { timestamps: true });

export default mongoose.model('MeetingRecord', meetingRecordSchema);
