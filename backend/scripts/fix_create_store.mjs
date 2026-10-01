import fs from 'fs';
import path from 'path';

const storeServicePath = 'c:/Users/User/OneDrive/Desktop/NearExpiry/backend/src/services/store.service.js';
let content = fs.readFileSync(storeServicePath, 'utf8');

const targetBlock = `export const createStoreService = async (sellerUser, payload) => {
  const existingStore = await Store.findOne({ ownerId: sellerUser._id });
  if (existingStore) {
    throw new ApiError(
      409,
      'You have already created a store. Use the update store endpoint to modify it.',
      'STORE_ALREADY_EXISTS',
      [{ field: 'ownerId', message: \`Store [\${existingStore.storeName}] already exists for this seller\` }]
    );
  }`;

const replacementBlock = `export const createStoreService = async (sellerUser, payload) => {
  const existingStore = await Store.findOne({ ownerId: sellerUser._id });
  if (existingStore) {
    if (payload.storeName) existingStore.storeName = payload.storeName;
    if (payload.description !== undefined) existingStore.description = payload.description;
    if (payload.contactPhone) existingStore.contactPhone = payload.contactPhone;
    if (payload.contactEmail) existingStore.contactEmail = payload.contactEmail;
    if (payload.address) existingStore.address = payload.address;
    if (typeof payload.latitude === 'number') existingStore.latitude = payload.latitude;
    if (typeof payload.longitude === 'number') existingStore.longitude = payload.longitude;
    if (typeof payload.latitude === 'number' && typeof payload.longitude === 'number') {
      existingStore.location = {
        type: 'Point',
        coordinates: [payload.longitude, payload.latitude],
      };
    }
    if (payload.fulfillmentModes) existingStore.fulfillmentModes = payload.fulfillmentModes;
    if (payload.deliveryRadiusKm) existingStore.deliveryRadiusKm = payload.deliveryRadiusKm;
    await existingStore.save();
    return existingStore;
  }`;

content = content.replace(targetBlock, replacementBlock);
fs.writeFileSync(storeServicePath, content, 'utf8');
console.log('Updated createStoreService to idempotently update existing stores');

