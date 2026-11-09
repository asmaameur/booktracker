const statsModel = require('../models/statsModel');

// Every handler uses req.user.id: readers only see their own statistics.

// GET /api/stats/reading?year=
async function getReadingStats(req, res) {
  res.json({ stats: await statsModel.readingStats(req.user.id, req.validated.year) });
}

// PUT /api/stats/goal { target, year? }
async function setGoal(req, res) {
  const { year, target } = req.validated;
  await statsModel.setGoal(req.user.id, year, target);
  res.json({
    stats: await statsModel.readingStats(req.user.id, year),
    message: `Your goal for ${year} is ${target} book${target === 1 ? '' : 's'}.`,
  });
}

// DELETE /api/stats/goal?year=
async function deleteGoal(req, res) {
  const { year } = req.validated;
  await statsModel.deleteGoal(req.user.id, year);
  res.json({ stats: await statsModel.readingStats(req.user.id, year), message: `Your goal for ${year} has been removed.` });
}

module.exports = { getReadingStats, setGoal, deleteGoal };
