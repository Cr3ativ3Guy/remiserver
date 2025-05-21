const express = require('express');
const router = express.Router();
const { Session, Series, RecentSeries } = require('../models/Session');
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
    console.log('Request body COMPLET:', JSON.stringify(req.body, null, 2));
    console.log('Request headers:', JSON.stringify(req.headers, null, 2));
    
    const { password, players } = req.body;
    
    console.log('Password primit:', password);
    console.log('Players primiți:', JSON.stringify(players, null, 2));
    
    if (!password || !players) {
      console.error('Date lipsă:', { 
        password: !!password, 
        players: !!players,
        passwordType: typeof password,
        playersType: typeof players
      });
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
    
    // Crează seria nouă (doar o dată)
    const newSeries = new Series({
      seriesId,
      password, // Păstrează parola exact cum e introdusă
      creatorId,
      players,
      sessionCount: 0,
      createdAt: new Date(),
      lastUpdated: new Date()
    });
    
    const recentSeriesData = {
      seriesId: seriesId,
      deviceId: creatorId,
      lastAccessedDate: new Date(),
      players: players
    };
    
    await RecentSeries.addOrUpdateRecentSeries(recentSeriesData);
    await newSeries.save();
    console.log('Serie salvată cu succes');

    // Socket.IO: Emit event pentru crearea unei noi serii
    const io = req.app.get('io');
    io.emit('series-created', {
      seriesId: seriesId,
      players: players
    });
    
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
// Înlocuiește blocul de autentificare cu următorul cod
router.post('/login-with-role', async (req, res) => {
  const { seriesId, password } = req.body;
  const deviceId = req.headers['x-device-id'] || req.body.deviceId || 'unknown';

  console.log('=== DETALII AUTENTIFICARE ===');
  console.log('Cerere de autentificare:', {
    seriesId,
    passwordProvided: password ? `Da (${password.length} caractere)` : 'Nu',
    deviceId
  });

  try {
    // Mai întâi verifică dacă seria există doar după ID
    const series = await Series.findOne({ seriesId: seriesId });
    
    if (!series) {
      console.log(`Serie cu ID ${seriesId} nu a fost găsită.`);
      return res.status(401).json({
        success: false,
        message: "ID serie sau parolă incorectă (seria nu există)"
      });
    }
    
    console.log('Serie găsită. Verificare parolă:');
    console.log('- Parolă în DB:', series.password);
    console.log('- Parolă primită:', password);
    console.log('- Potrivire:', series.password === password);
    
    // Verifică parola
    if (series.password !== password) {
      console.log('Parolă incorectă.');
      return res.status(401).json({
        success: false,
        message: "ID serie sau parolă incorectă (parola nu se potrivește)"
      });
    }
    
    console.log('Parolă corectă. Verificare rol:');
    console.log('- CreatorId din DB:', series.creatorId);
    console.log('- DeviceId client:', deviceId);
    
    // Temporar, pentru debugging, acordă rolul de admin oricui
    // const role = series.creatorId === deviceId ? 'admin' : 'viewer';
    const role = 'admin'; // DOAR PENTRU DEBUGGING
    console.log('⚠️ DEBUGGING: Rolul a fost forțat la "admin" pentru toți utilizatorii');

    // Restul codului ca înainte, adaugă la viewerDevices etc.
    if (role === 'viewer' && !series.viewerDevices.includes(deviceId)) {
      await Series.findOneAndUpdate(
        { seriesId },
        { $addToSet: { viewerDevices: deviceId } }
      );

      // Socket.IO: Notificare pentru un nou viewer conectat
      const io = req.app.get('io');
      if (io) {
        io.to(`series:${seriesId}`).emit('viewer-joined', {
          seriesId: seriesId,
          viewerCount: (series.viewerDevices || []).length + 1
        });
      }
    }

    // Adaugă la seriile recente
    const recentSeriesData = {
      seriesId: seriesId,
      deviceId: deviceId,
      lastAccessedDate: new Date(),
      players: series.players
    };
    
    await RecentSeries.addOrUpdateRecentSeries(recentSeriesData);

    console.log('=== AUTENTIFICARE REUȘITĂ ===');
    
    res.json({
      success: true,
      session: {
        sessionId: series.seriesId,
        players: series.players,
        createdAt: series.createdAt
      },
      role: role,
      token: null
    });

  } catch (error) {
    console.error('Eroare de autentificare:', error);
    res.status(500).json({
      success: false, 
      message: "Eroare internă de server",
      errorDetails: error.message
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

router.post('/:seriesId/sessions', async (req, res) => {
  try {
    const { seriesId } = req.params;
    console.log('Creare sesiune nouă în seria:', seriesId);
    
    const creatorId = req.headers['x-device-id'] || req.body.deviceId || 'unknown';
    console.log('Creator ID:', creatorId);
    
    // Verifică dacă seria există
    const series = await Series.findOne({ seriesId });
    
    if (!series) {
      return res.status(404).json({
        success: false,
        message: 'Serie negăsită'
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
    
    // Verifică permisiunile de creare sesiune
    if (series.creatorId !== creatorId) {
      return res.status(403).json({
        success: false,
        message: 'Nu ai permisiunea de a crea sesiuni în această serie'
      });
    }
    
    // Obține numărul secvențial pentru noua sesiune
    const sessionNumber = await Session.countDocuments({ seriesId }) + 1;
    
    // Generează un ID unic pentru sesiune
    const sessionId = await getUniqueSeriesId();
    
    // Folosește jucătorii din cerere sau pe cei din serie
    const players = req.body.players || series.players;
    
    // Crează sesiunea nouă
    const newSession = new Session({
      sessionId,
      password: series.password,
      creatorId,
      players,
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

    // Socket.IO: Emit event pentru crearea unei noi sesiuni
    // Folosește emitToSeries dacă este disponibil, altfel emit direct
    const io = req.app.get('io');
    const emitToSeries = req.app.get('emitToSeries');
    
    if (io) {
      if (emitToSeries) {
        emitToSeries(io, seriesId, 'session-created', {
          seriesId: seriesId,
          sessionId: sessionId,
          sequenceNumber: sessionNumber,
          players: players
        });
      } else {
        io.to(`series:${seriesId}`).emit('session-created', {
          seriesId: seriesId,
          sessionId: sessionId,
          sequenceNumber: sessionNumber,
          players: players
        });
      }
      console.log(`Socket.IO: Eveniment session-created emis pentru seria ${seriesId}`);
    }
    
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

router.get('/recent-series', async (req, res) => {
  try {
    const deviceId = req.headers['x-device-id'] || req.query.deviceId;
    
    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'ID-ul dispozitivului este obligatoriu'
      });
    }
    
    // Restul codului rămâne la fel
    const recentSeries = await RecentSeries.find({ deviceId })
      .sort({ lastAccessedDate: -1 })
      .limit(5);
    
    const enrichedRecentSeries = await Promise.all(recentSeries.map(async (recent) => {
      const series = await Series.findOne({ seriesId: recent.seriesId });
      return {
        seriesId: recent.seriesId,
        lastAccessedDate: recent.lastAccessedDate,
        players: recent.players,
        sessionCount: series ? series.sessionCount : 0
      };
    }));
    
    res.status(200).json({
      success: true,
      recentSeries: enrichedRecentSeries,
      message: 'Serii recente obținute cu succes'
    });
  } catch (error) {
    console.error('Eroare la preluarea seriilor recente:', error);
    res.status(500).json({
      success: false,
      message: 'Eroare la preluarea seriilor recente',
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

// Actualizarea unei sesiuni existente
router.put('/:seriesId/sessions/:sessionId', async (req, res) => {
  try {
    const { seriesId, sessionId } = req.params;
    const updates = req.body;
    const deviceId = req.headers['x-device-id'] || req.body.deviceId || 'unknown';
    
    // Verifică dacă seria și sesiunea există
    const series = await Series.findOne({ seriesId });
    const session = await Session.findOne({ sessionId, seriesId });
    
    if (!series || !session) {
      return res.status(404).json({
        success: false,
        message: 'Serie sau sesiune negăsită'
      });
    }
    
    // Verifică permisiunile de editare
    if (series.creatorId !== deviceId) {
      return res.status(403).json({
        success: false,
        message: 'Nu ai permisiunea de a edita această sesiune'
      });
    }
    
    // Actualizează sesiunea
    const updatedSession = await Session.findOneAndUpdate(
      { sessionId, seriesId },
      { 
        ...updates,
        lastUpdated: new Date() 
      },
      { new: true }
    );
    
    // Socket.IO: Emit event pentru actualizarea sesiunii
    const io = req.app.get('io');
    io.to(`series:${seriesId}`).emit('session-updated', {
      seriesId: seriesId,
      sessionId: sessionId,
      session: updatedSession
    });
    
    res.status(200).json({
      success: true,
      session: updatedSession,
      message: 'Sesiune actualizată cu succes'
    });
  } catch (error) {
    console.error('Eroare la actualizarea sesiunii:', error);
    res.status(500).json({
      success: false,
      message: 'Eroare la actualizarea sesiunii',
      error: error.message
    });
  }
});

module.exports = router;