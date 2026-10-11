import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      maxlength: 60,
      set: (value) => typeof value === 'string'
        ? value.normalize('NFKC').trim().replace(/\s+/g, ' ')
        : value,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    },
    description: { type: String, trim: true },
  },
  { timestamps: true },
);

// Uniqueness is enforced by MongoDB indexes, not document validation.
// Preserve display casing while treating names such as Sofas/SOFAS as equal.
categorySchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
categorySchema.index({ slug: 1 }, { unique: true });

export default mongoose.model('Category', categorySchema);
