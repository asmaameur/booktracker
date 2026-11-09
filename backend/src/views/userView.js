// Full years between a 'YYYY-MM-DD' birth date and today.
function ageFrom(birthDate, today = new Date()) {
  if (!birthDate) return null;
  const [year, month, day] = birthDate.split('-').map(Number);
  let age = today.getFullYear() - year;
  const beforeBirthday = today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day);
  if (beforeBirthday) age -= 1;
  return age;
}

// What the API shows about an account. The password hash and the date of the
// last password change never leave the server.
function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isVerified: user.isVerified,
    birthDate: user.birthDate ?? null,
    age: ageFrom(user.birthDate),
    avatarUrl: user.avatarUrl ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

// What other people (admins) see about an account: no date of birth or age,
// which only the account owner sees.
function toAccountSummary(user) {
  const { birthDate, age, ...rest } = toPublicUser(user);
  return rest;
}

module.exports = { toPublicUser, toAccountSummary, ageFrom };
