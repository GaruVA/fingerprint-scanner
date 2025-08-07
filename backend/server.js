const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT;

// Initialize Firebase Admin
const serviceAccount = require('./firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = admin.database();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));
app.use(express.json());
app.use(express.static('build')); // Serve React build files

// Routes

// Get all scan logs
app.get('/api/logs', async (req, res) => {
  try {
    const { deviceID, startDate, endDate, limit = 100 } = req.query;
    
    let query = db.ref('logs');
    
    if (deviceID) {
      query = query.orderByChild('deviceID').equalTo(deviceID);
    }
    
    query = query.limitToLast(parseInt(limit));
    
    const snapshot = await query.once('value');
    const logs = [];
    
    snapshot.forEach(child => {
      const logData = child.val();
      // Handle both JSON string and object formats
      const parsedData = typeof logData === 'string' ? JSON.parse(logData) : logData;
      logs.push({
        id: child.key,
        ...parsedData
      });
    });
    
    // Filter by date if provided
    let filteredLogs = logs;
    if (startDate || endDate) {
      filteredLogs = logs.filter(log => {
        const logDate = new Date(log.timestamp);
        if (startDate && logDate < new Date(startDate)) return false;
        if (endDate && logDate > new Date(endDate)) return false;
        return true;
      });
    }
    
    // Sort by timestamp (newest first)
    filteredLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json(filteredLogs);
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Get device status
app.get('/api/devices', async (req, res) => {
  try {
    const snapshot = await db.ref('devices').once('value');
    const devices = [];
    
    snapshot.forEach(child => {
      const deviceData = child.val();
      // Handle both JSON string and object formats
      const parsedData = typeof deviceData === 'string' ? JSON.parse(deviceData) : deviceData;
      devices.push({
        id: child.key,
        ...parsedData,
        isOnline: Date.now() - parseInt(parsedData.lastSeen || 0) < 600000 // 10 minutes
      });
    });
    
    res.json(devices);
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

// Get specific device
app.get('/api/devices/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const snapshot = await db.ref(`devices/${deviceId}`).once('value');
    
    if (!snapshot.exists()) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    const deviceData = snapshot.val();
    const parsedData = typeof deviceData === 'string' ? JSON.parse(deviceData) : deviceData;
    res.json({
      id: deviceId,
      ...parsedData,
      isOnline: Date.now() - parseInt(parsedData.lastSeen || 0) < 600000
    });
  } catch (error) {
    console.error('Error fetching device:', error);
    res.status(500).json({ error: 'Failed to fetch device' });
  }
});

// Get analytics/statistics
app.get('/api/analytics', async (req, res) => {
  try {
    const { deviceID, period = '7d' } = req.query;
    
    // Calculate date range based on period
    const now = new Date();
    let startDate;
    switch (period) {
      case '1d':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
    
    let query = db.ref('logs');
    if (deviceID) {
      query = query.orderByChild('deviceID').equalTo(deviceID);
    }
    
    const snapshot = await query.once('value');
    const logs = [];
    
    snapshot.forEach(child => {
      const logData = child.val();
      const parsedData = typeof logData === 'string' ? JSON.parse(logData) : logData;
      const logDate = new Date(parsedData.timestamp);
      if (logDate >= startDate) {
        logs.push(parsedData);
      }
    });
    
    // Calculate statistics
    const totalScans = logs.filter(log => log.type === 'scan').length;
    const successfulScans = logs.filter(log => log.type === 'scan' && log.status === 'success').length;
    const failedScans = logs.filter(log => log.type === 'scan' && log.status === 'failed').length;
    const enrollments = logs.filter(log => log.type === 'enroll' && log.status === 'success').length;
    
    // Group by day for chart data
    const dailyStats = {};
    logs.forEach(log => {
      const day = new Date(log.timestamp).toISOString().split('T')[0];
      if (!dailyStats[day]) {
        dailyStats[day] = { successful: 0, failed: 0, enrollments: 0 };
      }
      
      if (log.type === 'scan') {
        if (log.status === 'success') {
          dailyStats[day].successful++;
        } else {
          dailyStats[day].failed++;
        }
      } else if (log.type === 'enroll' && log.status === 'success') {
        dailyStats[day].enrollments++;
      }
    });
    
    const chartData = Object.entries(dailyStats).map(([date, stats]) => ({
      date,
      ...stats
    })).sort((a, b) => new Date(a.date) - new Date(b.date));
    
    res.json({
      summary: {
        totalScans,
        successfulScans,
        failedScans,
        enrollments,
        successRate: totalScans > 0 ? ((successfulScans / totalScans) * 100).toFixed(1) : 0
      },
      chartData
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get users (enrolled fingerprints)
app.get('/api/users', async (req, res) => {
  try {
    const { deviceID } = req.query;
    
    // Get enrollment logs to find users
    let query = db.ref('logs').orderByChild('type').equalTo('enroll');
    
    const snapshot = await query.once('value');
    const users = new Map();
    
    snapshot.forEach(child => {
      const logData = child.val();
      const parsedData = typeof logData === 'string' ? JSON.parse(logData) : logData;
      if (parsedData.status === 'success' && (!deviceID || parsedData.deviceID === deviceID)) {
        users.set(parsedData.fingerprintID, {
          fingerprintID: parsedData.fingerprintID,
          serviceNumber: parsedData.serviceNumber,
          deviceID: parsedData.deviceID,
          enrolledAt: parsedData.timestamp
        });
      }
    });
    
    res.json(Array.from(users.values()));
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Real-time logs endpoint (Server-Sent Events)
app.get('/api/logs/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  
  const logsRef = db.ref('logs');
  
  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Stream connected' })}\n\n`);
  
  // Listen for new logs
  const listener = logsRef.on('child_added', (snapshot) => {
    try {
      const logData = snapshot.val();
      const parsedData = typeof logData === 'string' ? JSON.parse(logData) : logData;
      const eventData = {
        id: snapshot.key,
        ...parsedData
      };
      
      res.write(`data: ${JSON.stringify(eventData)}\n\n`);
    } catch (error) {
      console.error('Error in stream listener:', error);
    }
  });
  
  // Clean up on client disconnect
  req.on('close', () => {
    logsRef.off('child_added', listener);
    console.log('Client disconnected from stream');
  });
  
  req.on('error', (error) => {
    console.error('Stream error:', error);
    logsRef.off('child_added', listener);
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Fingerprint Scanner Dashboard API',
    version: '1.0.0',
    endpoints: {
      'GET /api/health': 'Health check',
      'GET /api/logs': 'Get scan logs (query: deviceID, startDate, endDate, limit)',
      'GET /api/logs/stream': 'Real-time logs stream (Server-Sent Events)',
      'GET /api/devices': 'Get all devices',
      'GET /api/devices/:deviceId': 'Get specific device',
      'GET /api/analytics': 'Get analytics (query: deviceID, period)',
      'GET /api/users': 'Get enrolled users (query: deviceID)'
    }
  });
});

// Serve React app for any other routes (in production)
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  });
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT. Graceful shutdown...');
  admin.app().delete().then(() => {
    console.log('Firebase Admin SDK disconnected.');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Graceful shutdown...');
  admin.app().delete().then(() => {
    console.log('Firebase Admin SDK disconnected.');
    process.exit(0);
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📚 API docs: http://localhost:${PORT}/api`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
