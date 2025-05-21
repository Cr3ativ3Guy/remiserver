const express = require('express');
const router = express.Router();
const { Session, Series } = require('../models/Session');
const crypto = require('crypto');

// Generare ID unic de 10 cifre pentru serie
function generateSeriesId() {
  // Generează un număr aleatoriu între 1000000000 și 9999999999 (10 cifre)
  const min = 1000000000;
  const max = 9999999999;
  const randomNum = Math.floor(Math.random() * (max - min + 1)) + min;
  return randomNum.toString();
}

// Verifică dacă ID-ul de serie există deja și generează unul nou dacă e cazul
async function getUniqueSeriesId() {
  let seriesId = generateSeriesId();
  let exists = true;
  
  // Verifică dacă ID-ul există deja în baza de date
  while (exists) {
    const series = await Series.findOne({ seriesId });
    if (!series) {
      exists = false;
    } else {
      seriesId = generateSeriesId();
    }
  }
  
  return seriesId;
}

// Verifică dacă o serie există
router.get('/:seriesId/exists', async (req, res) => {
  try {
    const { seriesId } = req.params;
    
    const series = await Series.findOne({ seriesId });
    
    res.status(200).json({
      success: true,
      exists: !!series,
      message: series ? 'Seria există' : 'Seria nu există'
    });
  } catch (error) {
    console.error('Eroare la verificarea existenței seriei:', error);
    res.status(500).json({
      success: false,
      message: 'Eroare la verificarea existenței seriei',
      error: error.message
    });
  }
});

// Crează o serie nouă (și implicit o primă sesiune)
router.post('/create', async (req, res) => {
  try {
    console.log('Request body:', req.body);
    
    const { password, players } = req.body;
    
    if (!password || !players) {
      console.error('Date lipsă:', { password: !!password, players: !!players });
      return res.status(400).json({
        success: false,
        message: 'Lipsesc date obligatorii (password, players)'
      });
    }
    
    if (!players.player1 || !players.player2 || !players.player3 || !players.player4) {
      console.error('Jucători lipsă:', players);
      return res.status(400).json({
        success: false,
        message: 'Lipsesc unul sau mai mulți jucători'
      });
    }
    
    const creatorId = req.headers['x-device-id'] || req.body.deviceId || 'unknown';
    console.log('Creator ID:', creatorId);
    
    // Generează un ID unic pentru serie
    const seriesId = await getUniqueSeriesId();
    console.log('Serie ID generată:', seriesId);
    
    // Crează seria nouă
    const newSeries = new Series({
      seriesId,
      password,
      creatorId,
      players,
      sessionCount: 0,
      createdAt: new Date(),
      lastUpdated: new Date()
    });
    
    await newSeries.save();
    console.log('Serie salvată cu succes');
    
    res.status(201).json({
      success: true,
      sessionId: seriesId, // Folosim același ID pentru compatibilitate cu clientul
      message: 'Serie creată cu succes'
    });
  } catch (error) {
    console.error('Eroare la crearea seriei:', error);
    res.status(500).json({
      success: false,
      message: 'Eroare la crearea seriei',
      error: error.message
    });
  }
});

// Autentificare într-o serie cu rol
router.post('/login-with-role', async (req, res) => {
  try {
    console.log('Request body login:', req.body);
    
    const { sessionId, password } = req.body;
    const deviceId = req.headers['x-device-id'] || req.body.deviceId || 'unknown';
    
    // Caută seria după ID
    const series = await Series.findOne({ seriesId: sessionId });
    
    if (!series) {
      return res.status(404).json({
        success: false,
        message: 'Serie negăsită'
      });
    }
    
    if (series.password !== password) {
      return res.status(401).json({
        success: false,
        message: 'Parolă incorectă'
      });
    }
    
    // Determină rolul utilizatorului
    const role = series.creatorId === deviceId ? 'admin' : 'viewer';
    
    res.status(200).json({
      success: true,
      session: {
        sessionId: series.seriesId,
        players: series.players,
        createdAt: series.createdAt
      },
      role: role
    });
  } catch (error) {
    console.error('Eroare la autentificare:', error);
    res.status(500).json({
      success: false,
      message: 'Eroare la autentificare',
      error: error.message
    });
  }
});

// Obține toate sesiunile dintr-o serie
router.get('/:seriesId/sessions', async (req, res) => {
  try {
    const { seriesId } = req.params;
    console.log('Cerere pentru sesiuni din seria:', seriesId);
    
    // Verifică dacă seria există
    const series = await Series.findOne({ seriesId });
    
    if (!series) {
      return res.status(404).json({
        success: false,
        message: 'Serie negăsită'
      });
    }
    
    // Obține toate sesiunile din serie
    const sessions = await Session.find({ seriesId })
      .sort({ createdAt: -1 }); // Sortăm după data creării, cele mai noi primele
    
    console.log(`Găsite ${sessions.length} sesiuni pentru seria ${seriesId}`);
    
    res.status(200).json({
      success: true,
      sessions,
      message: 'Sesiuni obținute cu succes'
    });
  } catch (error) {
    console.error('Eroare la obținerea sesiunilor:', error);
    res.status(500).json({
      success: false,
      message: 'Eroare la obținerea sesiunilor',
      error: error.message
    });
  }
});

// Crează o nouă sesiune în cadrul unei serii
router.post('/:seriesId/sessions', async (req, res) => {
  try {
    const { seriesId } = req.params;
    console.log('Creare sesiune nouă în seria:', seriesId);
    
    const creatorId = req.headers['x-device-id'] || req.body.deviceId || 'unknown';
    
    // Verifică dacă seria există
    const series = await Series.findOne({ seriesId });
    
    if (!series) {
      return res.status(404).json({
        success: false,
        message: 'Serie negăsită'
      });
    }
    
    // Verifică dacă utilizatorul este admin
    if (series.creatorId !== creatorId && series.creatorId !== 'unknown') {
      console.log(`Încercare neautorizată. Creator: ${series.creatorId}, Solicitant: ${creatorId}`);
      return res.status(403).json({
        success: false,
        message: 'Nu ai permisiunea de a crea sesiuni în această serie'
      });
    }
    
    // Verifică dacă există deja o sesiune activă
    const activeSession = await Session.findOne({ seriesId, status: 'active' });
    
    if (activeSession) {
      return res.status(400).json({
        success: false,
        message: 'Există deja o sesiune activă în această serie'
      });
    }
    
    // Obține numărul secvențial pentru noua sesiune
    const sessionNumber = await Session.countDocuments({ seriesId }) + 1;
    
    // Generează un ID unic pentru sesiune
    const sessionId = await getUniqueSeriesId();
    
    // Crează sesiunea nouă
    const newSession = new Session({
      sessionId,
      password: series.password,
      creatorId,
      players: req.body.players || series.players, // Permite override pentru jucători
      seriesId,
      sequenceNumber: sessionNumber,
      status: 'active',
      gameScores: [],
      finalScores: {
        player1: 0,
        player2: 0,
        player3: 0,
        player4: 0
      },
      createdAt: new Date(),
      lastUpdated: new Date()
    });
    
    await newSession.save();
    console.log('Sesiune nouă creată cu ID:', sessionId);
    
    // Actualizează contorul de sesiuni din serie
    await Series.findOneAndUpdate(
      { seriesId },
      { 
        $inc: { sessionCount: 1 },
        lastUpdated: new Date()
      }
    );
    
    res.status(201).json({
      success: true,
      session: newSession,
      message: 'Sesiune creată cu succes'
    });
  } catch (error) {
    console.error('Eroare la crearea sesiunii:', error);
    res.status(500).json({
      success: false,
      message: 'Eroare la crearea sesiunii',
      error: error.message
    });
  }
});

// Obține toate seriile
router.get('/', async (req, res) => {
  try {
    const series = await Series.find();
    
    res.status(200).json({
      success: true,
      series,
      message: 'Serii obținute cu succes'
    });
  } catch (error) {
    console.error('Eroare la obținerea seriilor:', error);
    res.status(500).json({
      success: false,
      message: 'Eroare la obținerea seriilor',
      error: error.message
    });
  }
});

// Obține detaliile unei serii
router.get('/:seriesId', async (req, res) => {
  try {
    const { seriesId } = req.params;
    
    const series = await Series.findOne({ seriesId });
    
    if (!series) {
      return res.status(404).json({
        success: false,
        message: 'Serie negăsită'
      });
    }
    
    res.status(200).json({
      success: true,
      series,
      message: 'Serie obținută cu succes'
    });
  } catch (error) {
    console.error('Eroare la obținerea seriei:', error);
    res.status(500).json({
      success: false,
      message: 'Eroare la obținerea seriei',
      error: error.message
    });
  }
});

module.exports = router;