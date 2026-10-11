import mongoose from 'mongoose';

const adminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    passwordHash: { type: String, required: true, select: false },
    tokenVersion: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger },
    role: { type: String, enum: ['admin', 'superadmin'], default: 'admin', required: true },
    isActive: { type: Boolean, default: true, required: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_document, result) {
        delete result.passwordHash;
        delete result.__v;
        return result;
      },
    },
  },
);

adminSchema.index({ email: 1 }, { unique: true, name: 'uniq_admin_email' });

export default mongoose.model('Admin', adminSchema);
