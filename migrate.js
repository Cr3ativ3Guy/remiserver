const mongoose = require('mongoose');
const { Series, Session, RecentSeries } = require('./models/Session'); // Ajustează calea

// Conectare la MongoDB local
async function migrateData() {
  // Conectare la MongoDB local
  const localConn = await mongoose.createConnection('mongodb://localhost:27017/remi-app');
  
  // Creează modelele pentru baza de date locală
  const LocalSeries = localConn.model('Series', new mongoose.Schema({}, { strict: false }));
  const LocalSession = localConn.model('Session', new mongoose.Schema({}, { strict: false }));
  const LocalRecentSeries = localConn.model('RecentSeries', new mongoose.Schema({}, { strict: false }));
  
  // Conectare la MongoDB Atlas
  const atlasConn = await mongoose.createConnection('mongodb+srv://radunituc:Christmas190889@cluster0.wpzbzlj.mongodb.net/remi-app');
  
  // Creează modelele pentru MongoDB Atlas
  const AtlasSeries = atlasConn.model('Series', Series.schema);
  const AtlasSession = atlasConn.model('Session', Session.schema);
  const AtlasRecentSeries = atlasConn.model('RecentSeries', RecentSeries.schema);
  
  // Obține toate datele din local
  const localSeries = await LocalSeries.find().lean();
  const localSessions = await LocalSession.find().lean();
  const localRecentSeries = await LocalRecentSeries.find().lean();
  
  console.log(`Găsite ${localSeries.length} serii, ${localSessions.length} sesiuni, și ${localRecentSeries.length} serii recente.`);
  
  // Verifică și repară datele Series - adaugă password dacă lipsește
  const fixedSeries = localSeries.map(series => {
    if (!series.password) {
      console.log(`Adăugare parolă implicită pentru seria ${series.seriesId}`);
      return { ...series, password: 'parola_implicita' };
    }
    return series;
  });
  
  // Verifică și repară datele Session - adaugă password dacă lipsește
  const fixedSessions = localSessions.map(session => {
    if (!session.password) {
      console.log(`Adăugare parolă implicită pentru sesiunea ${session.sessionId}`);
      return { ...session, password: 'parola_implicita' };
    }
    return session;
  });
  
  // Importă datele în MongoDB Atlas
  try {
    // Importă serii
    if (fixedSeries.length > 0) {
      for (const series of fixedSeries) {
        try {
          await AtlasSeries.create(series);
        } catch (err) {
          console.log(`Eroare la importarea seriei ${series.seriesId}: ${err.message}`);
        }
      }
      console.log('Serii importate cu succes.');
    }
    
    // Importă sesiuni
    if (fixedSessions.length > 0) {
      for (const session of fixedSessions) {
        try {
          await AtlasSession.create(session);
        } catch (err) {
          console.log(`Eroare la importarea sesiunii ${session.sessionId}: ${err.message}`);
        }
      }
      console.log('Sesiuni importate cu succes.');
    }
    
    // Importă serii recente
    if (localRecentSeries.length > 0) {
      for (const recentSeries of localRecentSeries) {
        try {
          await AtlasRecentSeries.create(recentSeries);
        } catch (err) {
          console.log(`Eroare la importarea seriei recente pentru ${recentSeries.seriesId}: ${err.message}`);
        }
      }
      console.log('Serii recente importate cu succes.');
    }
  } catch (err) {
    console.error('Eroare la importarea datelor:', err);
  }
  
  // Închide conexiunile
  await localConn.close();
  await atlasConn.close();
  
  console.log('Migrare completă!');
}

migrateData().catch(err => {
  console.error('Eroare în procesul de migrare:', err);
});