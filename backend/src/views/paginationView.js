// The `pagination` block of paged lists (the catalogue, the admin's accounts list).
function toPagination({ page, limit }, total) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

module.exports = { toPagination };
