import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Activity, AlertCircle, TrendingUp, Zap, Server, Clock, Gauge, Package } from 'lucide-react';

interface DashboardData {
  timestamp: string;
  uptime_seconds: number;
  total_requests: number;
  providers: Record<string, any>;
  stats: {
    total_requests: number;
    successful_requests: number;
    failed_requests: number;
    avg_latency_ms: number;
    total_tokens: number;
    cache_hits: number;
    uptime_percent: number;
  };
  recent_metrics: any[];
}

function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'metrics' | 'providers'>('overview');

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/dashboard/ws/metrics`);

    ws.onopen = () => {
      setConnected(true);
      setError(null);
    };

    ws.onmessage = (event) => {
      const newData = JSON.parse(event.data);
      setData(newData);
    };

    ws.onerror = () => {
      setError('WebSocket connection error');
      setConnected(false);
    };

    ws.onclose = () => {
      setConnected(false);
    };

    return () => ws.close();
  }, []);

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <Activity className="w-16 h-16 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-white text-xl font-semibold">Loading Dashboard...</p>
          {error && <p className="text-red-400 mt-2">{error}</p>}
        </div>
      </div>
    );
  }

  const uptime = data.uptime_seconds;
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = uptime % 60;

  const chartData = data.recent_metrics.slice(-30).map(m => ({
    time: new Date(m.timestamp * 1000).toLocaleTimeString(),
    latency: parseFloat(m.duration_ms.toFixed(2)),
    tokens: m.total_tokens,
    status: m.status_code
  }));

  const providerData = Object.entries(data.providers).map(([name, provider]: [string, any]) => ({
    name: name.replace(/_/g, ' ').toUpperCase(),
    success: provider.successful_requests,
    failed: provider.failed_requests
  }));

  const tokenData = Object.entries(data.providers).map(([name, provider]: [string, any]) => ({
    name: name.replace(/_/g, ' '),
    value: provider.total_requests
  }));

  const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Zap className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Free Claude Code Dashboard</h1>
                <p className="text-slate-400 text-sm">Real-time Proxy Monitoring</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 ${
                connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
              }`}>
                <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
                {connected ? 'Connected' : 'Disconnected'}
              </div>
              <div className="text-right">
                <p className="text-slate-400 text-xs">Uptime</p>
                <p className="font-mono text-sm">{hours}h {minutes}m {seconds}s</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-700 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-8">
            {(['overview', 'metrics', 'providers'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-2 border-b-2 font-medium transition ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                icon={<Activity className="w-5 h-5" />}
                title="Total Requests"
                value={data.stats.total_requests.toLocaleString()}
                subtitle="Since startup"
                color="blue"
              />
              <StatCard
                icon={<TrendingUp className="w-5 h-5" />}
                title="Success Rate"
                value={`${Math.round(data.stats.uptime_percent)}%`}
                subtitle={`${data.stats.successful_requests} successful`}
                color="green"
              />
              <StatCard
                icon={<Gauge className="w-5 h-5" />}
                title="Avg Latency"
                value={`${data.stats.avg_latency_ms.toFixed(0)}ms`}
                subtitle="Response time"
                color="purple"
              />
              <StatCard
                icon={<Package className="w-5 h-5" />}
                title="Total Tokens"
                value={data.stats.total_tokens.toLocaleString()}
                subtitle={`${data.stats.cache_hits} cache hits`}
                color="orange"
              />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Latency Chart */}
              <div className="lg:col-span-2 bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-400" />
                  Request Latency Trend
                </h2>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="time" stroke="#94a3b8" style={{ fontSize: '12px' }} />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                      formatter={(value) => `${value}ms`}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="latency" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Provider Health */}
              <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Server className="w-5 h-5 text-green-400" />
                  Provider Health
                </h2>
                <div className="space-y-3">
                  {Object.entries(data.providers).slice(0, 5).map(([name, provider]: [string, any]) => (
                    <div key={name} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${provider.is_healthy ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
                        <span className="text-sm font-medium capitalize">{name.replace(/_/g, ' ')}</span>
                      </div>
                      <span className="text-xs text-slate-400">{provider.total_requests} req</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-6">Session Summary</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryItem label="Successful" value={data.stats.successful_requests} color="green" />
                <SummaryItem label="Failed" value={data.stats.failed_requests} color="red" />
                <SummaryItem label="Cache Hits" value={data.stats.cache_hits} color="blue" />
                <SummaryItem label="Error Rate" value={`${(100 - data.stats.uptime_percent).toFixed(1)}%`} color="orange" />
              </div>
            </div>
          </div>
        )}

        {/* Metrics Tab */}
        {activeTab === 'metrics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Latency Over Time */}
              <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4">Latency Trend</h2>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="time" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b' }} />
                    <Legend />
                    <Line type="monotone" dataKey="latency" stroke="#3b82f6" strokeWidth={2} dot={false} name="Latency (ms)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Token Usage */}
              <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4">Token Consumption</h2>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="time" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b' }} />
                    <Bar dataKey="tokens" fill="#10b981" name="Tokens" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Request Timeline */}
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4">Recent Requests</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-600">
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Provider</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Endpoint</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Status</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Latency</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Tokens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_metrics.slice(-10).reverse().map((metric, idx) => (
                      <tr key={idx} className="border-b border-slate-700 hover:bg-slate-700/50 transition">
                        <td className="py-3 px-4 capitalize">{metric.provider.replace(/_/g, ' ')}</td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-400">{metric.endpoint}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            metric.status_code >= 200 && metric.status_code < 300 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                          }`}>
                            {metric.status_code}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono">{metric.duration_ms.toFixed(2)}ms</td>
                        <td className="py-3 px-4">{metric.total_tokens}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Providers Tab */}
        {activeTab === 'providers' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Request Distribution */}
              <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4">Request Distribution</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={tokenData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {tokenData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${value} requests`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Success vs Failed */}
              <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4">Success vs Failed</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={providerData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b' }} />
                    <Legend />
                    <Bar dataKey="success" fill="#10b981" name="Success" />
                    <Bar dataKey="failed" fill="#ef4444" name="Failed" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Provider Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(data.providers).map(([name, provider]: [string, any]) => (
                <div key={name} className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold capitalize">{name.replace(/_/g, ' ')}</h3>
                      <p className="text-slate-400 text-sm mt-1">Provider Statistics</p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                      provider.is_healthy ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {provider.is_healthy ? 'Healthy' : 'Unhealthy'}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <MetricRow label="Total Requests" value={provider.total_requests.toString()} />
                    <MetricRow label="Successful" value={provider.successful_requests.toString()} color="green" />
                    <MetricRow label="Failed" value={provider.failed_requests.toString()} color="red" />
                    <MetricRow label="Error Rate" value={`${(provider.error_rate * 100).toFixed(1)}%`} color={provider.error_rate > 0.1 ? 'red' : 'green'} />
                    <MetricRow label="Avg Latency" value={`${provider.avg_latency_ms.toFixed(2)}ms`} />
                    {provider.last_error && (
                      <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded">
                        <p className="text-red-400 text-xs font-mono">{provider.last_error}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700 bg-slate-900/50 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-6 text-center text-slate-400 text-sm">
          <p>Free Claude Code Dashboard • Real-time Monitoring</p>
        </div>
      </footer>
    </div>
  );
}

function StatCard({ icon, title, value, subtitle, color }: {
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle: string;
  color: 'blue' | 'green' | 'purple' | 'orange';
}) {
  const colorClasses = {
    blue: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    green: 'bg-green-500/10 border-green-500/30 text-green-400',
    purple: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
    orange: 'bg-orange-500/10 border-orange-500/30 text-orange-400',
  };

  return (
    <div className={`${colorClasses[color]} border rounded-xl p-6 backdrop-blur hover:border-opacity-100 transition`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-slate-400 text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold mt-2">{value}</p>
          <p className="text-slate-400 text-xs mt-2">{subtitle}</p>
        </div>
        <div className="opacity-50">{icon}</div>
      </div>
    </div>
  );
}

function SummaryItem({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colorClasses = {
    green: 'text-green-400',
    red: 'text-red-400',
    blue: 'text-blue-400',
    orange: 'text-orange-400',
  };

  return (
    <div className="text-center">
      <p className="text-slate-400 text-xs font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${colorClasses[color as keyof typeof colorClasses]}`}>{value}</p>
    </div>
  );
}

function MetricRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between p-2 bg-slate-700/30 rounded">
      <span className="text-slate-400 text-sm">{label}</span>
      <span className={`font-mono font-medium ${color ? `text-${color}-400` : 'text-slate-200'}`}>{value}</span>
    </div>
  );
}

export default App;
