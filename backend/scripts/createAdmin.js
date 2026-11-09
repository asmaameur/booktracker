// Creates an administrator account, or promotes an existing account to admin.
// Reads ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD from .env.
// Usage: npm run db:create-admin
const env = require('../src/config/env'); // loads .env
const { pool } = require('../src/config/db');
const userModel = require('../src/models/userModel');
const { hashPassword } = require('../src/utils/security');
const { normalizeEmail, isEmail, passwordProblem, text } = require('../src/middleware/validators/rules');
const describeDbError = require('../src/utils/describeDbError');

async function createAdmin() {
  const name = text(process.env.ADMIN_NAME) || 'Administrator';
  const email = normalizeEmail(process.env.ADMIN_EMAIL);
  const password = process.env.ADMIN_PASSWORD || '';

  if (!isEmail(email)) throw new Error('Set ADMIN_EMAIL in .env to a valid email address.');

  const existing = await userModel.findByEmail(email);
  if (existing) {
    await userModel.promoteToAdmin(existing.id);
    console.log(`${email} already had an account; it is now a verified admin (password unchanged).`);
    return;
  }

  const problem = passwordProblem(password);
  if (problem) throw new Error(`ADMIN_PASSWORD is not valid: ${problem}`);

  await userModel.create({
    name,
    email,
    passwordHash: await hashPassword(password),
    role: 'admin',
    isVerified: true,
  });
  console.log(`Admin account created for ${email} on database "${env.db.database}".`);
}

createAdmin()
  .catch((err) => {
    console.error(`Could not create the admin: ${describeDbError(err)}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
