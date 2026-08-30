const express = require('express');
const mongoose = require('mongoose');
const app = express();

app.use(express.json());

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/test');

app.get('/', (req, res) => {
  res.send('<h1>✓ Server works!</h1>');
});

app.get('/api/test', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(8080, () => {
  console.log('Server running on 8080');
});
