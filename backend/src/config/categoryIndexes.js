import Category from '../models/Category.js';

export async function verifyCategoryUniqueIndexes() {
  let indexes;
  try {
    indexes = await Category.collection.indexes();
  } catch (error) {
    if (error?.code === 26 || error?.codeName === 'NamespaceNotFound') return false;
    throw error;
  }
  const nameIndex = indexes.find((index) => index.key?.name === 1);
  const slugIndex = indexes.find((index) => index.key?.slug === 1);

  return Boolean(
    nameIndex
      && Object.keys(nameIndex.key).length === 1
      && nameIndex.unique
      && !nameIndex.partialFilterExpression
      && nameIndex.collation?.locale === 'en'
      && nameIndex.collation?.strength === 2
      && nameIndex.collation?.caseLevel !== true
      && slugIndex
      && Object.keys(slugIndex.key).length === 1
      && slugIndex.unique
      && !slugIndex.partialFilterExpression,
  );
}
