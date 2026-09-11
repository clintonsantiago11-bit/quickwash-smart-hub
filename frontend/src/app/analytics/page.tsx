"use client";

import Header from '@/components/Header';
import { TrendingUp, Filter, Download } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface RevenuePoint {
  day: string;
  revenue: number;
  washes: number;
}

const defaultAnalyticsData = [
  { day: 'Mon', revenue: 0, washes: 0 },
  { day: 'Tue', revenue: 0, washes: 0 },
  { day: 'Wed', revenue: 0, washes: 0 },
  { day: 'Thu', revenue: 0, washes: 0 },
  { day: 'Fri', revenue: 0, washes: 0 },
  { day: 'Sat', revenue: 0, washes: 0 },
  { day: 'Sun', revenue: 0, washes: 0 },
];

const defaultPeakHours = [
  { hour: '08:00', volume: 0 },
  { hour: '10:00', volume: 0 },
  { hour: '12:00', volume: 0 },
  { hour: '14:00', volume: 0 },
  { hour: '16:00', volume: 0 },
  { hour: '18:00', volume: 0 },
  { hour: '20:00', volume: 0 },
];

export default function AnalyticsPage() {
  const [analyticsData, setAnalyticsData] = useState(defaultAnalyticsData);
  const [peakHoursData, setPeakHoursData] = useState(defaultPeakHours);
  const [weeklyRevenue, setWeeklyRevenue] = useState(0);
  const [totalWashes, setTotalWashes] = useState(0);
  const [revenueTrend, setRevenueTrend] = useState<number | null>(null);
  const [washTrend, setWashTrend] = useState<number | null>(null);
  const [period, setPeriod] = useState(7);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const [revenue, peak] = await Promise.all([
          api.getRevenue(period),
          api.getPeakHours(),
        ]);
        setPeakHoursData(peak);

        // If we have 14 days we can compute a real week-over-week trend
        if (revenue.length >= 14) {
          const current = revenue.slice(7);
          const previous = revenue.slice(0, 7);
          const curRev = current.reduce((sum: number, d: RevenuePoint) => sum + d.revenue, 0);
          const prevRev = previous.reduce((sum: number, d: RevenuePoint) => sum + d.revenue, 0);
          const curWash = current.reduce((sum: number, d: RevenuePoint) => sum + d.washes, 0);
          const prevWash = previous.reduce((sum: number, d: RevenuePoint) => sum + d.washes, 0);
          setRevenueTrend(prevRev > 0 ? ((curRev - prevRev) / prevRev) * 100 : null);
          setWashTrend(prevWash > 0 ? ((curWash - prevWash) / prevWash) * 100 : null);
          setAnalyticsData(current);
          setWeeklyRevenue(curRev);
          setTotalWashes(curWash);
        } else {
          setRevenueTrend(null);
          setWashTrend(null);
          setAnalyticsData(revenue);
          setWeeklyRevenue(revenue.reduce((sum: number, d: RevenuePoint) => sum + d.revenue, 0));
          setTotalWashes(revenue.reduce((sum: number, d: RevenuePoint) => sum + d.washes, 0));
        }
      } catch {
        console.warn('Analytics backend unavailable');
      }
    };
    fetchAnalytics();
  }, [period]);

  const avgRevenue = totalWashes > 0 ? weeklyRevenue / totalWashes : 0;

  const formatTrend = (trend: number | null) =>
    trend === null ? '--' : `${trend >= 0 ? '+' : ''}${trend.toFixed(1)}%`;

  const trendColor = (trend: number | null) =>
    trend === null ? 'var(--text-muted)' : trend >= 0 ? 'var(--success)' : 'var(--danger)';

  const exportToCSV = () => {
    const headers = ['Day', 'Revenue (PHP)', 'Total Washes'];
    const csvContent = [
      headers.join(','),
      ...analyticsData.map(row => `${row.day},${row.revenue},${row.washes}`)
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'quickwash_analytics_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <Header title="Vending Analytics" subtitle="Revenue and wash volume trends" />
      <main className="flex-1 p-3 sm:p-4 md:p-6 space-y-6 w-full max-w-[1600px] mx-auto overflow-x-hidden">
        
        {/* Top Actions Row */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2 sm:mb-4">
          <h2 className="text-xs lg:text-sm font-black uppercase tracking-[0.2em] opacity-40">Performance Overview</h2>
          <button onClick={exportToCSV} className="btn btn-primary flex items-center justify-center gap-2 py-3 px-6 text-[10px] lg:text-xs font-black uppercase tracking-widest text-black w-full sm:w-auto shadow-xl hover:shadow-[var(--accent-glow)] transition-all">
            <Download size={16} /> <span>Download Detailed CSV</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
          <div className="stat-card p-5 lg:p-6 group hover:border-[var(--accent)] transition-all">
            <h3 className="text-[10px] lg:text-xs font-bold mb-4 tracking-widest opacity-50 uppercase" style={{ fontFamily: 'var(--font-display)' }}>WEEKLY REVENUE</h3>
            <div className="text-2xl sm:text-3xl lg:text-4xl font-black font-mono tracking-tighter" style={{color: weeklyRevenue > 0 ? 'var(--accent)' : 'var(--text-muted)'}}>₱{weeklyRevenue.toFixed(2)}</div>
            <div className="text-xs mt-3 flex items-center gap-1.5 font-bold" style={{ color: trendColor(revenueTrend) }}>
              <TrendingUp size={14}/> {formatTrend(revenueTrend)} <span className="opacity-40 font-normal">vs last week</span>
            </div>
          </div>
          <div className="stat-card p-5 lg:p-6 group hover:border-[var(--accent)] transition-all">
            <h3 className="text-[10px] lg:text-xs font-bold mb-4 tracking-widest opacity-50 uppercase" style={{ fontFamily: 'var(--font-display)' }}>TOTAL WASHES</h3>
            <div className="text-2xl sm:text-3xl lg:text-4xl font-black font-mono tracking-tighter" style={{color: totalWashes > 0 ? 'var(--accent)' : 'var(--text-muted)'}}>{totalWashes} <span className="text-sm opacity-20">UNITS</span></div>
            <div className="text-xs mt-3 flex items-center gap-1.5 font-bold" style={{ color: trendColor(washTrend) }}>
              <TrendingUp size={14}/> {formatTrend(washTrend)} <span className="opacity-40 font-normal">vs last week</span>
            </div>
          </div>
          <div className="stat-card p-5 lg:p-6 group hover:border-[var(--accent)] transition-all sm:col-span-2 xl:col-span-1">
            <h3 className="text-[10px] lg:text-xs font-bold mb-4 tracking-widest opacity-50 uppercase" style={{ fontFamily: 'var(--font-display)' }}>AVG REV / WASH</h3>
            <div className="text-2xl sm:text-3xl lg:text-4xl font-black font-mono tracking-tighter" style={{color: avgRevenue > 0 ? 'var(--accent)' : 'var(--text-muted)'}}>₱{avgRevenue.toFixed(2)}</div>
            <div className="text-xs mt-3 flex items-center gap-1.5 font-bold text-[var(--text-muted)]">
              <TrendingUp size={14}/> Last {period} days <span className="opacity-40 font-normal">window</span>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8">
          {/* Main Chart */}
          <div className="card p-5 sm:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 sm:mb-12">
              <div>
                <h3 className="font-black text-sm sm:text-base lg:text-xl uppercase tracking-tighter" style={{ fontFamily: 'var(--font-display)' }}>7-Day Revenue Trend</h3>
                <p className="text-[10px] lg:text-xs opacity-50 font-bold uppercase tracking-widest mt-1">Growth analysis by day</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPeriod(7)}
                  className={`btn btn-ghost py-2 px-5 text-[10px] lg:text-xs font-black uppercase tracking-widest border-2 transition-all ${period === 7 ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--border)] hover:bg-[var(--bg-hover)]'}`}
                >
                  <Filter size={14} className="mr-2" /> 7 Days
                </button>
                <button
                  onClick={() => setPeriod(14)}
                  className={`btn btn-ghost py-2 px-5 text-[10px] lg:text-xs font-black uppercase tracking-widest border-2 transition-all ${period === 14 ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--border)] hover:bg-[var(--bg-hover)]'}`}
                >
                  <Filter size={14} className="mr-2" /> 14 Days
                </button>
              </div>
            </div>
            <div className="h-[250px] sm:h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analyticsData}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="var(--divider)" vertical={false} />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: 'var(--text-muted)' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: 'var(--text-muted)' }} tickFormatter={(value) => `₱${value/1000}k`} />
                  <Tooltip 
                    contentStyle={{ background: 'var(--bg-elevated)', border: '2px solid var(--border)', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}
                    itemStyle={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="var(--accent)" strokeWidth={4} fillOpacity={1} fill="url(#colorRev)" animationDuration={2000} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Peak Hours Chart */}
          <div className="card p-5 sm:p-8">
            <div className="mb-8 sm:mb-12">
              <h3 className="font-black text-sm sm:text-base lg:text-xl uppercase tracking-tighter" style={{ fontFamily: 'var(--font-display)' }}>Peak Hours Distribution</h3>
              <p className="text-[10px] lg:text-xs opacity-50 font-bold uppercase tracking-widest mt-1">Hourly wash volume density</p>
            </div>
            <div className="h-[250px] sm:h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={peakHoursData}>
                  <CartesianGrid strokeDasharray="4 4" stroke="var(--divider)" vertical={false} />
                  <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: 'var(--text-muted)' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: 'var(--text-muted)' }} />
                  <Tooltip 
                    cursor={{ fill: 'var(--bg-hover)', radius: 8 }}
                    contentStyle={{ background: 'var(--bg-elevated)', border: '2px solid var(--border)', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="volume" fill="var(--accent)" radius={[8, 8, 0, 0]} animationDuration={2000} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
