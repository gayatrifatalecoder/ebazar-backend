const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  level: { type: Number, required: true, default: 1 },         // 1 = Category, 2 = Subcategory
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  path: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
  isLeaf: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  displayOrder: { type: Number, default: 0 },
  icon: { type: String } // Optional icon URL for frontend
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for high-performance Adjacency List querying
CategorySchema.index({ parentId: 1 });
CategorySchema.index({ level: 1 });
CategorySchema.index({ path: 1 });
CategorySchema.index({ isActive: 1 });

module.exports = mongoose.model('Category', CategorySchema);
