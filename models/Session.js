const mongoose = require('mongoose');

// Schema pentru sesiune
const SessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  players: {
    player1: String,
    player2: String,
    player3: String,
    player4: String
  },
  gameScores: [{
    round: Number,
    scores: {
      player1: Number,
      player2: Number,
      player3: Number,
      player4: Number
    },
	atuPlayerIndex: Number,
    timestamp: Date
  }],
  finalScores: {
    player1: { type: Number, default: 0 },
    player2: { type: Number, default: 0 },
    player3: { type: Number, default: 0 },
    player4: { type: Number, default: 0 }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  password: String,
  creatorId: {
    type: String,
    default: 'unknown'
  },
  seriesId: String,
  sequenceNumber: Number,
  status: {
    type: String,
    enum: ['active', 'ended'],
    default: 'active'
  }
});

// Schema pentru serie
const SeriesSchema = new mongoose.Schema({
  seriesId: {
    type: String,
    required: true,
    unique: true
  },
   password: {  // Adaugă această linie
    type: String,
    required: true
  },
  players: {
    player1: String,
    player2: String,
    player3: String,
    player4: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  sessionCount: {
    type: Number,
    default: 0
  },
  creatorId: {
    type: String,
    default: 'unknown'
  },
  viewerDevices: [{
    type: String
  }],
});

// Schema pentru seriile recente
const recentSeriesSchema = new mongoose.Schema({
  seriesId: {
    type: String,
    required: true
  },
  deviceId: {
    type: String,
    required: true
  },
  lastAccessedDate: {
    type: Date,
    default: Date.now
  },
  players: {
    player1: String,
    player2: String,
    player3: String,
    player4: String
  }
});

// Metodă pentru a adăuga sau actualiza o serie recentă
// În models/Session.js
recentSeriesSchema.statics.addOrUpdateRecentSeries = async function(seriesData) {
  try {
    // Încearcă să găsească o serie recentă existentă
    let recentSeries = await this.findOne({ 
      seriesId: seriesData.seriesId, 
      deviceId: seriesData.deviceId 
    });

    if (recentSeries) {
      // Actualizează data ultimei accesări
      recentSeries.lastAccessedDate = new Date();
      await recentSeries.save();
    } else {
      // Creează o serie recentă nouă
      recentSeries = new this(seriesData);
      await recentSeries.save();
    }

    // Curăță seriile vechi pentru dispozitivul curent (păstrează ultimele 5)
    const oldSeries = await this.find({ deviceId: seriesData.deviceId })
      .sort({ lastAccessedDate: -1 })
      .skip(5);
    
    // Șterge seriile vechi
    await this.deleteMany({ 
      _id: { $in: oldSeries.map(series => series._id) } 
    });

    return recentSeries;
  } catch (error) {
    console.error('Eroare la adăugarea seriei recente:', error);
    throw error;
  }
};

// Modelele Mongoose
const Session = mongoose.model('Session', SessionSchema);
const Series = mongoose.model('Series', SeriesSchema);
const RecentSeries = mongoose.model('RecentSeries', recentSeriesSchema);

module.exports = {
  Session,
  Series,
  RecentSeries
};