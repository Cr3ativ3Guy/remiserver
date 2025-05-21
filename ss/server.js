const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan'); // Adaugă dependența morgan pentru logging
require('dotenv').config();

// Inițializarea aplicației Express
const app = express();

// Middleware pentru logging
app.use(morgan('dev')); // Adaugă morgan pentru a loga cererile HTTP

// Middleware pentru CORS și procesarea body-ului
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware pentru a loga toate cererile
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  if (req.method === 'POST' || req.method === 'PUT') {
    console.log('Conținut cerere:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// Conectare la MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Conectat la MongoDB'))
  .catch(err => console.error('Eroare la conectarea la MongoDB:', err));

// Rută de test
app.get('/', (req, res) => {
  res.json({ message: 'API Remi funcționează!' });
});

// Importare și utilizare rute
const sessionRoutes = require('./routes/sessions');
const seriesRoutes = require('./routes/series');

app.use('/api/sessions', sessionRoutes);
app.use('/api/series', seriesRoutes);

// Middleware pentru tratarea erorilor
app.use((err, req, res, next) => {
  console.error('Eroare server:', err);
  res.status(500).json({
    success: false,
    message: 'Eroare internă de server',
    error: err.message
  });
});

// Pornire server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serverul rulează pe portul ${PORT}`);
  console.log(`Accesează API-ul la http://localhost:${PORT}`);
});

// Adaugă handler pentru închidere grațioasă
process.on('SIGINT', async () => {
  console.log('Închidere server...');
  await mongoose.connection.close();
  console.log('Conexiune MongoDB închisă.');
  process.exit(0);
});