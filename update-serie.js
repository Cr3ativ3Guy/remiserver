// Salvează ca script check-database.js
const mongoose = require('mongoose');

async function checkDatabase() {
  try {
    // Conectare la MongoDB Atlas
    await mongoose.connect('mongodb+srv://radunituc:Christmas190889@cluster0.wpzbzlj.mongodb.net/remi-app');
    console.log('Conectat la MongoDB Atlas');
    
    // Definește un model simplu pentru Series
    const Series = mongoose.model('Series', new mongoose.Schema({}, { strict: false }));
    
    // 1. Verifică toate documentele din colecția Series
    console.log('\n=== TOATE SERIILE DIN BAZA DE DATE ===');
    const allSeries = await Series.find();
    console.log(`Număr total de serii în baza de date: ${allSeries.length}`);
    
    if (allSeries.length === 0) {
      console.log('Nu există nicio serie în baza de date!');
    } else {
      // Arată primele 5 serii pentru verificare
      console.log('\nPrimele 5 serii:');
      allSeries.slice(0, 5).forEach((s, idx) => {
        console.log(`\nSeria ${idx + 1}:`);
        console.log(`- SeriesId: ${s.seriesId} (tip: ${typeof s.seriesId})`);
        console.log(`- Password: ${s.password} (tip: ${typeof s.password})`);
      });
    }
    
    // 2. Caută specific seria cu ID-ul 3664911501
    console.log('\n=== CĂUTARE SERIE CU ID 3664911501 ===');
    
    // Caută ca string
    const seriesAsString = await Series.findOne({ seriesId: '3664911501' });
    console.log('Căutare ca string:', seriesAsString ? 'GĂSITĂ' : 'NEGĂSITĂ');
    
    // Caută ca număr
    const seriesAsNumber = await Series.findOne({ seriesId: 3664911501 });
    console.log('Căutare ca număr:', seriesAsNumber ? 'GĂSITĂ' : 'NEGĂSITĂ');
    
    // 3. Verifică dacă există vreun document care conține "3664911501" în orice câmp
    console.log('\n=== CĂUTARE AVANSATĂ ===');
    const seriesWithIdInAnyField = await Series.find({
      $or: [
        { seriesId: '3664911501' },
        { seriesId: 3664911501 },
        { _id: { $regex: '3664911501' } }
      ]
    });
    
    console.log(`Rezultate căutare avansată: ${seriesWithIdInAnyField.length}`);
    if (seriesWithIdInAnyField.length > 0) {
      seriesWithIdInAnyField.forEach((s, idx) => {
        console.log(`\nRezultat ${idx + 1}:`);
        console.log(JSON.stringify(s, null, 2));
      });
    }
    
    // 4. Verifică colecțiile din baza de date
    console.log('\n=== VERIFICARE COLECȚII ===');
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Colecții în baza de date:');
    collections.forEach(c => console.log('- ' + c.name));
    
  } catch (error) {
    console.error('Eroare:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nConexiune închisă');
  }
}

checkDatabase();