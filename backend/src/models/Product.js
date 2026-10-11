import mongoose from 'mongoose';

const normalizeTag = (value) => typeof value === 'string'
  ? value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ')
  : value;

const normalizeTags = (values) => Array.isArray(values)
  ? [...new Set(values.map(normalizeTag).filter((value) => value !== ''))]
  : values;

const measurement = () => ({
  type: Number,
  min: 0,
  validate: { validator: (value) => value == null || Number.isFinite(value), message: 'Use a finite measurement.' },
});

const dimensionsSchema = new mongoose.Schema(
  { length: measurement(), width: measurement(), height: measurement() },
  { _id: false },
);

const imageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator(value) {
          // Keep existing local catalog images valid alongside future hosted images.
          if (/^\/(?!\/)[^\s\\]+$/.test(value)) return true;
          try {
            const url = new URL(value);
            return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
          } catch {
            return false;
          }
        },
        message: 'Use an HTTP(S) URL or a local image path.',
      },
    },
    // Local images have no upload provider ID yet.
    publicId: { type: String, trim: true, default: '' },
  },
  { _id: false },
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    price: {
      type: Number,
      required: true,
      min: 0,
      validate: { validator: Number.isFinite, message: 'Use a finite price.' },
    },
    description: { type: String, required: true, trim: true, maxlength: 4000 },
    material: { type: String, trim: true },
    color: { type: String, trim: true },
    dimensions: dimensionsSchema,
    // Array order preserves the main image in the first position.
    images: { type: [imageSchema], default: [] },
    tags: {
      type: [{ type: String, trim: true, set: normalizeTag, required: true, maxlength: 40 }],
      default: [],
      set: normalizeTags,
      validate: {
        validator: (values) => values != null && values.length <= 12 && new Set(values).size === values.length,
        message: 'Use up to 12 unique tags.',
      },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Also normalize after document-array edits such as tags.push(). Future update
// APIs should replace the normalized array and enable runValidators.
productSchema.pre('validate', function () {
  this.tags = normalizeTags(this.tags);
});

productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ name: 'text', tags: 'text' });

export default mongoose.model('Product', productSchema);
