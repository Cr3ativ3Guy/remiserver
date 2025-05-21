const mongoose = require('mongoose');

// Schema pentru scorurile individuale ale unui joc
const gameScoreSchema = new mongoose.Schema({
  round: Number,
  scores: {
    player1: Number,
    player2: Number,
    player3: Number,
    player4: Number
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Schema pentru sesiuni
const sessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  creatorId: {
    type: String,
    required: true,
    default: 'unknown'
  },
  players: {
    player1: String,
    player2: String,
    player3: String,
    player4: String
  },
  gameScores: [gameScoreSchema],
  finalScores: {
    player1: { type: Number, default: 0 },
    player2: { type: Number, default: 0 },
    player3: { type: Number, default: 0 },
    player4: { type: Number, default: 0 }
  },
  // Câmp adăugat pentru a lega sesiunea de o serie
  seriesId: {
    type: String,
    ref: 'Series'
  },
  // Numărul secvențial al sesiunii în cadrul seriei
  sequenceNumber: {
    type: Number,
    default: 1
  },
  // Status-ul sesiunii (activă sau încheiată)
  status: {
    type: String,
    enum: ['active', 'ended'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

// Schema pentru serii de sesiuni
const seriesSchema = new mongoose.Schema({
  seriesId: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  creatorId: {
    type: String,
    required: true,
    default: 'unknown'
  },
  players: {
    player1: String,
    player2: String,
    player3: String,
    player4: String
  },
  sessionCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

const Session = mongoose.model('Session', sessionSchema);
const Series = mongoose.model('Series', seriesSchema);

module.exports = {
  Session,
  Series
};