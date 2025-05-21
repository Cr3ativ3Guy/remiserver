// Salvează ca update-creator.js
const mongoose = require('mongoose');

async function updateCreator() {
  try {
    // Conectare la MongoDB Atlas
    await mongoose.connect('mongodb+srv://radunituc:Christmas190889@cluster0.wpzbzlj.mongodb.net/remi-app');
    
    // Definește modelul Series
    const Series = mongoose.model('Series', new mongoose.Schema({}, { strict: false }));
    
    // ID-ul dispozitivului tău
    const newCreatorId = '714459C3-FE92-4324-8EB3-DD907E193330';
    
    // Actualizează creatorId
    const result = await Series.updateOne(
      { seriesId: '3664911501' },
      { $set: { creatorId: newCreatorId } }
    );
    
    if (result.matchedCount === 0) {
      console.log('Seria nu a fost găsită.');
    } else if (result.modifiedCount === 0) {
      console.log('CreatorId nu a fost modificat (era deja același?).');
    } else {
      console.log('CreatorId a fost actualizat cu succes!');
    }
  } catch (error) {
    console.error('Eroare:', error);
  } finally {
    await mongoose.connection.close();
  }
}

updateCreator();