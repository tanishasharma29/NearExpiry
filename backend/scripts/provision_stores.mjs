import mongoose from 'mongoose';

async function main() {
  await mongoose.connect('mongodb://127.0.0.1:27017/nearexpiry');
  const users = await mongoose.connection.collection('users').find({ role: 'SELLER' }).toArray();
  for (const user of users) {
    const existing = await mongoose.connection.collection('stores').findOne({ ownerId: user._id });
    if (!existing) {
      console.log('Creating missing store for seller:', user.email);
      const storeName = user.sellerProfile?.storeName || `${user.name} Store`;
      const slug = storeName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.floor(Math.random() * 10000);
      await mongoose.connection.collection('stores').insertOne({
        ownerId: user._id,
        storeName: storeName,
        slug: slug,
        description: 'Neighborhood Supermarket Partner',
        contactPhone: user.phone || '9999999999',
        contactEmail: user.email,
        businessDetails: {
          businessLicenseNumber: user.sellerProfile?.businessLicenseNumber || null,
          gstNumber: user.sellerProfile?.gstNumber || null,
          fssaiLicenseNumber: user.sellerProfile?.fssaiLicenseNumber || null,
          cosmeticLicenseNumber: user.sellerProfile?.cosmeticLicenseNumber || null,
        },
        address: {
          street: user.sellerProfile?.address?.street || 'Retail Market Road',
          city: user.sellerProfile?.address?.city || 'Bangalore',
          state: user.sellerProfile?.address?.state || 'Karnataka',
          pincode: user.sellerProfile?.address?.pincode || '560001',
        },
        latitude: 12.9716,
        longitude: 77.5946,
        location: {
          type: 'Point',
          coordinates: [77.5946, 12.9716],
        },
        status: 'OPEN',
        verificationStatus: 'APPROVED',
        isActive: true,
        fulfillmentModes: ['PICKUP', 'LOCAL_DELIVERY'],
        deliveryRadiusKm: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await mongoose.connection.collection('users').updateOne(
        { _id: user._id },
        { $set: { verificationStatus: 'APPROVED', 'sellerProfile.reviewedAt': new Date() } }
      );
      console.log('Created store & approved seller:', user.email);
    } else {
      if (user.email === 'sharmatanisha94724@gmail.com') {
        await mongoose.connection.collection('stores').updateOne(
          { ownerId: user._id },
          { $set: { verificationStatus: 'APPROVED', isActive: true } }
        );
        await mongoose.connection.collection('users').updateOne(
          { _id: user._id },
          { $set: { verificationStatus: 'APPROVED' } }
        );
        console.log('Ensured Tanisha Sharma is APPROVED');
      }
    }
  }
  console.log('Provisioning check complete!');
  await mongoose.disconnect();
}

main().catch(console.error);

