import mongoose from 'mongoose';
import Category from '../models/Category.js';

const maximumTransactionAttempts = 3;
const maximumCommitAttempts = 3;

function hasErrorLabel(error, label) {
  return typeof error?.hasErrorLabel === 'function' && error.hasErrorLabel(label);
}

async function commitTransaction(session) {
  for (let attempt = 1; ; attempt++) {
    try {
      await session.commitTransaction();
      return;
    } catch (error) {
      if (hasErrorLabel(error, 'UnknownTransactionCommitResult') && attempt < maximumCommitAttempts) {
        continue;
      }
      throw error;
    }
  }
}

export async function withCategoryReferenceTransaction(operation) {
  const session = await mongoose.startSession();
  try {
    for (let attempt = 1; ; attempt++) {
      session.startTransaction({
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
      });

      try {
        const result = await operation(session);
        await commitTransaction(session);
        return result;
      } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        if (hasErrorLabel(error, 'TransientTransactionError') && attempt < maximumTransactionAttempts) {
          continue;
        }
        throw error;
      }
    }
  } finally {
    await session.endSession();
  }
}

export async function acquireCategoryReferenceWrite(categoryId, session) {
  const result = await Category.updateOne(
    { _id: categoryId },
    { $inc: { referenceVersion: 1 } },
    { session, timestamps: false },
  );
  return result.matchedCount === 1;
}
