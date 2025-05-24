const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');
require('dotenv').config();

// Importă fetch pentru Node.js (pentru keep-alive)
const fetch = require('node-fetch');

// DEBUG pentru Render
console.log('=== RENDER DEPLOYMENT INFO ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('MONGODB_URI exists:', !!process.env.MONGODB_URI);
console.log('================================');

const app = express();
const server = http.createServer(app);

// CORS configuration pentru producție
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? [
        'https://your-frontend-domain.com', // Înlocuiește cu domeniul aplicației iOS
        'http://localhost:3000', // Pentru teste locale
        /https:\/\/.*\.render\.com$/ // Pentru subdomenii Render
      ] 
    : "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
  optionsSuccessStatus: 200
};

const io = socketIo(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling']
});

// Socket.IO configuration
io.on('connection', (socket) => {
  console.log('Client conectat:', socket.id);
  
  socket.on('join-series', (seriesId) => {
    socket.join(`series:${seriesId}`);
    console.log(`Client ${socket.id} alăturat camerei series:${seriesId}`);
  });
  
  socket.on('leave-series', (seriesId) => {
    socket.leave(`series:${seriesId}`);
    console.log(`Client ${socket.id} părăsit camera series:${seriesId}`);
  });
  
  socket.on('disconnect', () => {
    console.log('Client deconectat:', socket.id);
  });
});

app.set('io', io);

// Middleware
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(cors(corsOptions));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Request logging doar în development
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });
}

// MongoDB connection optimized for Atlas
const mongooseOptions = {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 75000,
  retryWrites: true,
  maxPoolSize: 10,
};

console.log('🔌 Conectare la MongoDB Atlas...');
mongoose.connect(process.env.MONGODB_URI, mongooseOptions)
  .then(() => {
    console.log('✅ Conectat la MongoDB Atlas');
    console.log('📊 Database:', mongoose.connection.name);
    console.log('📊 Host:', mongoose.connection.host);
  })
  .catch(err => {
    console.error('❌ Eroare conectare MongoDB:', err.message);
    process.exit(1);
  });

// MongoDB event handlers
mongoose.connection.on('connected', () => {
  console.log('🔗 Mongoose conectat');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Eroare MongoDB:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('🔌 Mongoose deconectat');
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbState = mongoose.connection.readyState;
    const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    
    res.status(200).json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      database: states[dbState],
      host: mongoose.connection.host,
      dbName: mongoose.connection.name,
      environment: process.env.NODE_ENV,
      port: process.env.PORT
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: error.message
    });
  }
});

// Root endpoint
app.get('/', async (req, res) => {
  try {
    res.json({ 
      message: 'Remi Scorer API - LIVE on Render!',
      database: mongoose.connection.name,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.json({ 
      message: 'Remi Scorer API - LIVE on Render!',
      environment: process.env.NODE_ENV || 'development'
    });
  }
});

// API Routes
const sessionRoutes = require('./routes/sessions');
const seriesRoutes = require('./routes/series');
app.use('/api/sessions', sessionRoutes);
app.use('/api/series', seriesRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Eroare internă server',
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint negăsit'
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server pornit pe portul ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  if (process.env.NODE_ENV === 'production') {
    console.log('📡 API disponibil la: https://your-app-name.onrender.com');
    
    // Keep-alive pentru free tier Render
    const RENDER_URL = process.env.RENDER_EXTERNAL_URL || `https://${process.env.RENDER_SERVICE_NAME}.onrender.com`;
    
    if (RENDER_URL) {
      setInterval(async () => {
        try {
          const response = await fetch(`${RENDER_URL}/health`);
          console.log(`🏓 Keep-alive ping: ${response.status} - ${new Date().toISOString()}`);
        } catch (error) {
          console.log(`🏓 Keep-alive ping failed: ${error.message}`);
        }
      }, 14 * 60 * 1000); // 14 minute - evită sleep-ul la 15 minute
      
      console.log('🏓 Auto keep-alive activat pentru free tier');
    }
  } else {
    console.log(`📡 API local: http://localhost:${PORT}`);
  }
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} primit. Închidere grațioasă...`);
  
  server.close(() => {
    console.log('🔌 Server HTTP închis');
  });
  
  try {
    await mongoose.connection.close();
    console.log('🔌 Conexiune MongoDB închisă');
  } catch (err) {
    console.error('Eroare închidere MongoDB:', err);
  }
  
  process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error('Unhandled Promise Rejection:', err.message);
  // Close server & exit process
  server.close(() => {
    process.exit(1);
  });
});