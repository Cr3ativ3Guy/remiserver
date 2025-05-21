const express = require('express');
const router = express.Router();
const { Session } = require('../models/Session');
const crypto = require('crypto');

// Obține detaliile unei sesiuni
router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    console.log(`Cerere pentru sesiunea ${sessionId}`);
    
    const session = await Session.findOne({ sessionId });
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Sesiune negăsită'
      });
    }
    
    res.status(200).json({
      success: true,
      session,
      message: 'Sesiune obținută cu succes'
    });
  } catch (error) {
    console.error('Eroare la obținerea sesiunii:', error);
    res.status(500).json({
      success: false,
      message: 'Eroare la obținerea sesiunii',
      error: error.message
    });
  }
});

// Adaugă un scor nou la o sesiune
router.post('/:sessionId/scores', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { scores } = req.body;
    const deviceId = req.headers['x-device-id'] || req.body.deviceId || 'unknown';
    
    console.log(`Adăugare scor nou la sesiunea ${sessionId}`);
    console.log('Scoruri:', scores);
    
    if (!scores) {
      return res.status(400).json({
        success: false,
        message: 'Lipsesc scorurile'
      });
    }
    
    // Obține sesiunea
    const session = await Session.findOne({ sessionId });
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Sesiune negăsită'
      });
    }
    
    // Verifică dacă sesiunea este activă
    if (session.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Sesiunea este încheiată, nu se mai pot adăuga scoruri'
      });
    }
    
    // Verifică permisiunile
    if (session.creatorId !== deviceId && session.creatorId !== 'unknown') {
      return res.status(403).json({
        success: false,
        message: 'Nu ai permisiunea de a adăuga scoruri la această sesiune'
      });
    }
    
    // Calculează numărul rundei
    const round = session.gameScores.length + 1;
    
    // Adaugă noul scor
    const newGameScore = {
      round,
      scores,
      timestamp: new Date()
    };
    
    // Actualizează scorurile finale
    session.finalScores.player1 += scores.player1;
    session.finalScores.player2 += scores.player2;
    session.finalScores.player3 += scores.player3;
    session.finalScores.player4 += scores.player4;
    
    // Adaugă scorul la sesiune
    session.gameScores.push(newGameScore);
    session.lastUpdated = new Date();
    
    await session.save();
    console.log(`Scor adăugat cu succes la runda ${round}`);
    
    res.status(200).json({
      success: true,
      currentRound: round,
      finalScores: session.finalScores,
      message: 'Scor adăugat cu succes'
    });
  } catch (error) {
    console.error('Eroare la adăugarea scorului:', error);
    res.status(500).json({
      success: false,
      message: 'Eroare la adăugarea scorului',
      error: error.message
    });
  }
});

// Editează ultimul scor dintr-o sesiune
router.put('/:sessionId/scores/last', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { scores } = req.body;
    const deviceId = req.headers['x-device-id'] || req.body.deviceId || 'unknown';
    
    console.log(`Editare ultimul scor la sesiunea ${sessionId}`);
    console.log('Scoruri noi:', scores);
    
    if (!scores) {
      return res.status(400).json({
        success: false,
        message: 'Lipsesc scorurile'
      });
    }
    
    // Obține sesiunea
    const session = await Session.findOne({ sessionId });
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Sesiune negăsită'
      });
    }
    
    // Verifică dacă sesiunea este activă
    if (session.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Sesiunea este încheiată, nu se mai pot edita scoruri'
      });
    }
    
    // Verifică permisiunile
    if (session.creatorId !== deviceId && session.creatorId !== 'unknown') {
      return res.status(403).json({
        success: false,
        message: 'Nu ai permisiunea de a edita scoruri la această sesiune'
      });
    }
    
    // Verifică dacă există scoruri
    if (session.gameScores.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nu există scoruri de editat'
      });
    }
    
    // Obține ultimul scor
    const lastScore = session.gameScores[session.gameScores.length - 1];
    
    // Calculează diferența pentru a actualiza scorurile finale
    const diff = {
      player1: scores.player1 - lastScore.scores.player1,
      player2: scores.player2 - lastScore.scores.player2,
      player3: scores.player3 - lastScore.scores.player3,
      player4: scores.player4 - lastScore.scores.player4
    };
    
    // Actualizează ultimul scor
    lastScore.scores = scores;
    lastScore.timestamp = new Date();
    
    // Actualizează scorurile finale
    session.finalScores.player1 += diff.player1;
    session.finalScores.player2 += diff.player2;
    session.finalScores.player3 += diff.player3;
    session.finalScores.player4 += diff.player4;
    
    session.lastUpdated = new Date();
    
    await session.save();
    console.log('Ultimul scor editat cu succes');
    
    res.status(200).json({
      success: true,
      finalScores: session.finalScores,
      message: 'Scor editat cu succes'
    });
  } catch (error) {
    console.error('Eroare la editarea scorului:', error);
    res.status(500).json({
      success: false,
      message: 'Eroare la editarea scorului',
      error: error.message
    });
  }
});

// Încheie o sesiune
router.post('/:sessionId/end', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const deviceId = req.headers['x-device-id'] || req.body.deviceId || 'unknown';
    
    console.log(`Încheiere sesiune ${sessionId}`);
    
    // Obține sesiunea
    const session = await Session.findOne({ sessionId });
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Sesiune negăsită'
      });
    }
    
    // Verifică dacă sesiunea este activă
    if (session.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Sesiunea este deja încheiată'
      });
    }
    
    // Verifică permisiunile
    if (session.creatorId !== deviceId && session.creatorId !== 'unknown') {
      return res.status(403).json({
        success: false,
        message: 'Nu ai permisiunea de a încheia această sesiune'
      });
    }
    
    // Încheie sesiunea
    session.status = 'ended';
    session.lastUpdated = new Date();
    
    await session.save();
    console.log('Sesiune încheiată cu succes');
    
    res.status(200).json({
      success: true,
      message: 'Sesiune încheiată cu succes'
    });
  } catch (error) {
    console.error('Eroare la încheierea sesiunii:', error);
    res.status(500).json({
      success: false,
      message: 'Eroare la încheierea sesiunii',
      error: error.message
    });
  }
});

// Obține toate sesiunile (pentru admin)
router.get('/', async (req, res) => {
  try {
    const sessions = await Session.find().sort({ createdAt: -1 });
    
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

module.exports = router;