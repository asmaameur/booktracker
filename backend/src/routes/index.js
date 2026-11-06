const { Router } = require('express');
const { query } = require('../config/db');

const router = Router();

router.get('/health', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', database: 'unreachable' });
  }
});

router.use('/auth', require('./authRoutes'));
router.use('/profile', require('./profileRoutes'));
router.use('/books', require('./bookRoutes'));
router.use('/library', require('./libraryRoutes'));
router.use('/admin', require('./adminRoutes'));

module.exports = router;
