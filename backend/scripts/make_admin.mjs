import mongoose from 'mongoose';
import { User, USER_ROLES, VERIFICATION_STATUS } from '../src/models/user.model.js';
import { env } from '../src/config/env.js';

const emailArg = process.argv[2];
const passwordArg = process.argv[3] || 'Password123!';
const nameArg = process.argv[4] || 'Admin User';

if (!emailArg) {
  console.log('Usage: node backend/scripts/make_admin.mjs <email> [password] [name]');
  console.log('Example: node backend/scripts/make_admin.mjs myadmin@example.com Password123! "My Name"');
  process.exit(1);
}

const run = async () => {
  console.log(`[MakeAdmin] Connecting to MongoDB: ${env.MONGODB_URI}`);
  await mongoose.connect(env.MONGODB_URI);

  const cleanEmail = emailArg.toLowerCase().trim();
  let user = await User.findOne({ email: cleanEmail });

  if (user) {
    user.role = USER_ROLES.ADMIN;
    user.verificationStatus = VERIFICATION_STATUS.APPROVED;
    user.isActive = true;
    if (process.argv[3]) {
      user.password = passwordArg;
    }
    await user.save();
    console.log(`\n🎉 SUCCESS: Existing user [${cleanEmail}] was promoted to ADMIN!`);
    console.log(`Role: ${user.role} | Verification: ${user.verificationStatus}`);
  } else {
    user = await User.create({
      name: nameArg,
      email: cleanEmail,
      password: passwordArg,
      phone: '9876543210',
      role: USER_ROLES.ADMIN,
      verificationStatus: VERIFICATION_STATUS.APPROVED,
      isActive: true,
    });
    console.log(`\n🎉 SUCCESS: New ADMIN user created for [${cleanEmail}]!`);
    console.log(`Email   : ${cleanEmail}`);
    console.log(`Password: ${passwordArg}`);
    console.log(`Role    : ${user.role}`);
  }

  await mongoose.disconnect();
  console.log('[MakeAdmin] Done.');
};

run().catch((err) => {
  console.error('[MakeAdmin Error]', err);
  process.exit(1);
});

