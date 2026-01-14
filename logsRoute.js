const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Endpoint: /logs/raw?date=YYYY-MM-DD
router.get('/logs/raw', (req, res) => {
  const date = req.query.date;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).send('Błędny format daty');
  }
  const logPath = path.join(__dirname, 'logs', `${date}.log`);
  if (!fs.existsSync(logPath)) {
    return res.status(404).send('Brak logów na wskazany dzień');
  }
  res.set('Content-Type', 'text/plain; charset=utf-8');
  fs.createReadStream(logPath).pipe(res);
});

module.exports = router;
