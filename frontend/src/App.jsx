import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { Activity, Users, Clock, CheckCircle, XCircle, Wifi, WifiOff, AlertCircle } from 'lucide-react';

// Use Vite environment variables
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : '');

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [logs, setLogs] = useState([]);
  const [devices, setDevices] = useState([]);
  const [users, setUsers] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  // Fetch data function
  const fetchData = async () => {
    try {
      setLoading(true);
      const [logsRes, devicesRes, usersRes, analyticsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/logs?limit=50${selectedDevice !== 'all' ? `&deviceID=${selectedDevice}` : ''}`),
        fetch(`${API_BASE_URL}/api/devices`),
        fetch(`${API_BASE_URL}/api/users${selectedDevice !== 'all' ? `?deviceID=${selectedDevice}` : ''}`),
        fetch(`${API_BASE_URL}/api/analytics?period=${selectedPeriod}${selectedDevice !== 'all' ? `&deviceID=${selectedDevice}` : ''}`)
      ]);

      const [logsData, devicesData, usersData, analyticsData] = await Promise.all([
        logsRes.json(),
        devicesRes.json(),
        usersRes.json(),
        analyticsRes.json()
      ]);

      setLogs(logsData);
      setDevices(devicesData);
      setUsers(usersData);
      setAnalytics(analyticsData);
      setConnectionStatus('connected');
    } catch (error) {
      console.error('Error fetching data:', error);
      setConnectionStatus('error');
    } finally {
      setLoading(false);
    }
  };

  // Setup real-time updates and data fetching
  useEffect(() => {
    fetchData();
    
    // Set up real-time updates for logs using Server-Sent Events
    let eventSource;
    
    try {
      eventSource = new EventSource(`${API_BASE_URL}/api/logs/stream`);
      
      eventSource.onopen = () => {
        setConnectionStatus('connected');
      };
      
      eventSource.onmessage = (event) => {
        try {
          const newLog = JSON.parse(event.data);
          setLogs(prevLogs => [newLog, ...prevLogs.slice(0, 49)]); // Keep latest 50
        } catch (error) {
          console.error('Error parsing SSE data:', error);
        }
      };

      eventSource.onerror = () => {
        setConnectionStatus('error');
        console.error('EventSource failed');
      };
    } catch (error) {
      console.error('Error setting up EventSource:', error);
      setConnectionStatus('error');
    }

    // Refresh data every 30 seconds as fallback
    const interval = setInterval(fetchData, 30000);

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      clearInterval(interval);
    };
  }, [selectedDevice, selectedPeriod]);

  // Utility functions
  const formatDateTime = (timestamp) => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return 'text-green-600';
      case 'failed': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-600" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected': return <Wifi className="w-4 h-4 text-green-500" />;
      case 'error': return <WifiOff className="w-4 h-4 text-red-500" />;
      default: return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
  };

  const COLORS = ['#10B981', '#EF4444', '#F59E0B', '#3B82F6'];

  if (loading && !analytics) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <Activity className="w-8 h-8 text-blue-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">Fingerprint Scanner Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              {/* Connection Status */}
              <div className="flex items-center">
                {getConnectionStatusIcon()}
                <span className={`ml-2 text-sm ${
                  connectionStatus === 'connected' ? 'text-green-600' : 
                  connectionStatus === 'error' ? 'text-red-600' : 'text-yellow-600'
                }`}>
                  {connectionStatus === 'connected' ? 'Live' : 
                   connectionStatus === 'error' ? 'Offline' : 'Connecting'}
                </span>
              </div>
              
              {/* Device Filter */}
              <select 
                value={selectedDevice} 
                onChange={(e) => setSelectedDevice(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Devices</option>
                {devices.map(device => (
                  <option key={device.id} value={device.id}>{device.deviceID || device.id}</option>
                ))}
              </select>
              
              {/* Time Period Filter */}
              <select 
                value={selectedPeriod} 
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="1d">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: 'overview', label: 'Overview', icon: Activity },
              { id: 'logs', label: 'Activity Logs', icon: Clock },
              { id: 'devices', label: 'Devices', icon: Wifi },
              { id: 'users', label: 'Users', icon: Users }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center px-1 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Stats Cards */}
            {analytics && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-center">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <Activity className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm text-gray-600">Total Scans</p>
                      <p className="text-2xl font-bold text-gray-900">{analytics.summary.totalScans}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-center">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm text-gray-600">Success Rate</p>
                      <p className="text-2xl font-bold text-gray-900">{analytics.summary.successRate}%</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-center">
                    <div className="p-3 bg-purple-100 rounded-lg">
                      <Users className="w-6 h-6 text-purple-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm text-gray-600">Enrolled Users</p>
                      <p className="text-2xl font-bold text-gray-900">{analytics.summary.enrollments}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-center">
                    <div className="p-3 bg-yellow-100 rounded-lg">
                      <Wifi className="w-6 h-6 text-yellow-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm text-gray-600">Active Devices</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {devices.filter(d => d.isOnline).length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Charts */}
            {analytics && analytics.chartData && analytics.chartData.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Activity Timeline */}
                <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Timeline</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={analytics.chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => new Date(value).toLocaleDateString()}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip 
                        labelFormatter={(value) => new Date(value).toLocaleDateString()}
                        contentStyle={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="successful" 
                        stroke="#10B981" 
                        strokeWidth={2}
                        name="Successful Scans"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="failed" 
                        stroke="#EF4444" 
                        strokeWidth={2}
                        name="Failed Scans"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Success vs Failed Pie Chart */}
                <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Scan Results Distribution</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Successful', value: analytics.summary.successfulScans, color: '#10B981' },
                          { name: 'Failed', value: analytics.summary.failedScans, color: '#EF4444' }
                        ]}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {[
                          { name: 'Successful', value: analytics.summary.successfulScans, color: '#10B981' },
                          { name: 'Failed', value: analytics.summary.failedScans, color: '#EF4444' }
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Recent Activity */}
            <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
              <div className="p-6 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
                <p className="text-sm text-gray-600 mt-1">Latest fingerprint scanner events</p>
              </div>
              <div className="divide-y divide-gray-200">
                {logs.slice(0, 5).map((log) => (
                  <div key={log.id} className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center">
                      {getStatusIcon(log.status)}
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-900">
                          {log.type === 'scan' ? 'Fingerprint Scan' : 'User Enrollment'}
                          {log.serviceNumber && ` - ${log.serviceNumber}`}
                        </p>
                        <p className="text-sm text-gray-500">
                          Device: {log.deviceID} • {formatDateTime(log.timestamp)}
                        </p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                      log.status === 'success' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {log.status}
                    </span>
                  </div>
                ))}
                {logs.length === 0 && (
                  <div className="p-8 text-center text-gray-500">
                    <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No recent activity</p>
                    <p className="text-sm">Scan logs will appear here when devices are active</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Activity Logs</h3>
                  <p className="mt-1 text-sm text-gray-600">Complete history of all scanner activities</p>
                </div>
                <div className="text-sm text-gray-500">
                  {logs.length} total entries
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Service Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Device
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Timestamp
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          log.type === 'scan' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {log.type === 'scan' ? 'Scan' : 'Enrollment'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {getStatusIcon(log.status)}
                          <span className={`ml-2 text-sm font-medium ${getStatusColor(log.status)}`}>
                            {log.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {log.serviceNumber ? (
                          <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                            {log.serviceNumber}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                          {log.deviceID}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDateTime(log.timestamp)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {logs.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No activity logs found</p>
                  <p className="text-sm">Logs will appear here when devices start scanning</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'devices' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Device Management</h3>
                <p className="text-sm text-gray-600">Monitor and manage your fingerprint scanners</p>
              </div>
              <div className="text-sm text-gray-500">
                {devices.filter(d => d.isOnline).length} of {devices.length} devices online
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {devices.map((device) => (
                <div key={device.id} className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-gray-900">
                      {device.deviceID || device.id}
                    </h4>
                    <div className="flex items-center">
                      {device.isOnline ? (
                        <Wifi className="w-5 h-5 text-green-500" />
                      ) : (
                        <WifiOff className="w-5 h-5 text-red-500" />
                      )}
                      <span className={`ml-2 text-sm font-medium ${
                        device.isOnline ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {device.isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Status:</span>
                      <span className={`text-sm font-medium px-2 py-1 rounded-full ${
                        device.status === 'online' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {device.status}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Enrolled Users:</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {device.enrolledUsers || 0}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Last Seen:</span>
                      <span className="text-sm text-gray-900">
                        {device.lastSeen ? formatDateTime(parseInt(device.lastSeen)) : 'Never'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <button 
                      onClick={() => setSelectedDevice(device.id)}
                      className="w-full text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      View Device Logs
                    </button>
                  </div>
                </div>
              ))}
              
              {devices.length === 0 && (
                <div className="col-span-full bg-white rounded-lg shadow p-8 text-center text-gray-500">
                  <Wifi className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No devices found</p>
                  <p className="text-sm">Devices will appear here when they come online</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Enrolled Users</h3>
                  <p className="mt-1 text-sm text-gray-600">Users with registered fingerprints</p>
                </div>
                <div className="text-sm text-gray-500">
                  {users.length} total users
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fingerprint ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Service Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Device
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Enrolled At
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user, index) => {
                    const isDeviceOnline = devices.find(d => d.id === user.deviceID)?.isOnline;
                    return (
                      <tr key={`${user.deviceID}-${user.fingerprintID}`} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            #{user.fingerprintID}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                            {user.serviceNumber}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                            {user.deviceID}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDateTime(user.enrolledAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            isDeviceOnline 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {isDeviceOnline ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {users.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No enrolled users found</p>
                  <p className="text-sm">Users will appear here after fingerprint enrollment</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;