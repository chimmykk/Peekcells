import mongoose from 'mongoose';

const BurnRecordSchema = new mongoose.Schema({
  walletAddress: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  burnCount: {
    type: Number,
    required: true,
    default: 0,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Middleware to update `updatedAt` on each modification
BurnRecordSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.models.BurnRecord || mongoose.model('BurnRecord', BurnRecordSchema);
