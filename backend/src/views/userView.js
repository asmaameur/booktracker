// What the API shows about an account. The password hash and the date of the
// last password change never leave the server.
function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

module.exports = { toPublicUser };
