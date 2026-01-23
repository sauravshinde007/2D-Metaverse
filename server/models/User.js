// server/models/User.js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: false, unique: true, sparse: true }, // Added email
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['employee', 'admin', 'hr', 'ceo'],
    default: 'employee'
  },
  activeSocketId: { type: String, default: null },
  resetPasswordToken: { type: String, default: null },
  resetPasswordExpires: { type: Date, default: null }
});

const User = mongoose.model('User', userSchema);
export default User;