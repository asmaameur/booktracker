const { text, toInteger, isBlank } = require('./rules');

const ROLES = ['user', 'admin'];

function usersQuery(query) {
  const errors = {};
  const value = {
    search: text(query.search).slice(0, 100),
    role: text(query.role),
    page: 1,
    limit: 20,
  };

  if (value.role && !ROLES.includes(value.role)) errors.role = `Role must be one of: ${ROLES.join(', ')}.`;

  if (!isBlank(query.page)) {
    const page = toInteger(query.page);
    if (Number.isNaN(page) || page < 1) errors.page = 'Page must be a positive whole number.';
    else value.page = page;
  }
  if (!isBlank(query.limit)) {
    const limit = toInteger(query.limit);
    if (Number.isNaN(limit) || limit < 1 || limit > 50) errors.limit = 'Limit must be between 1 and 50.';
    else value.limit = limit;
  }

  return { errors, value };
}

module.exports = { usersQuery };
