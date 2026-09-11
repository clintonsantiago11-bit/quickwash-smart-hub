"use client";

import Header from '@/components/Header';
import { Coins, ListOrdered } from 'lucide-react';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface TransactionItem {
  id: string;
  amount: number;
  method: string;
  time: string;
  status: string;
}

export default function VendingPage() {
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [totalCollected, setTotalCollected] = useState(0);
  const [todayCount, setTodayCount] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [txns, stats] = await Promise.all([
          api.getTransactions(),
          api.getVendingStats(),
        ]);
        setTransactions(txns.data || txns);
        setTotalCollected(stats.today_collected || 0);
        setTodayCount(stats.today_transactions || 0);
      } catch {
        console.warn('Vending backend unavailable');
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);
  return (
    <>
      <Header title="Vending Transactions" subtitle="Detailed log of all payments" />
      <main className="flex-1 p-3 sm:p-4 md:p-6 space-y-6 w-full max-w-[1600px] mx-auto">
        
        {/* Vending KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="card p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[var(--accent-glow)] flex items-center justify-center shrink-0">
              <Coins className="text-[var(--accent)]" size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest font-mono">Total Collected</p>
              <h3 className="text-xl font-bold font-ui" style={{color: totalCollected > 0 ? 'var(--accent)' : 'var(--text-muted)'}}>₱{totalCollected.toFixed(2)}</h3>
            </div>
          </div>
          <div className="card p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[var(--border)] flex items-center justify-center shrink-0">
              <ListOrdered className="text-[var(--text-muted)]" size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest font-mono">Transactions</p>
              <h3 className="text-xl font-bold font-ui" style={{color: todayCount > 0 ? 'var(--accent)' : 'var(--text-muted)'}}>{todayCount} <span className="text-xs font-medium opacity-50">Today</span></h3>
            </div>
          </div>
        </div>

        <div className="card p-3 sm:p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold font-display text-sm sm:text-base flex items-center gap-2">
              <ListOrdered size={18} style={{ color: 'var(--accent)' }}/>
              Recent Transactions
            </h3>
          </div>
          
          {/* Mobile Card View (Hidden on Tablet/Desktop) */}
          <div className="md:hidden space-y-3">
            {transactions.map((txn, i) => (
              <div key={i} className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-[10px] text-[var(--accent)] font-bold">{txn.id}</span>
                  <span className="badge badge-online text-[10px] px-2 py-0.5">{txn.status}</span>
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-mono mb-1">Amount</p>
                    <p className="text-lg font-bold">₱{txn.amount.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-[var(--text-muted)] font-mono">{txn.time}</p>
                    <p className="text-xs flex items-center justify-end gap-1 mt-1">
                      <Coins size={12} className="opacity-50"/> {txn.method}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Tablet/Desktop Table View (Hidden on Mobile) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="font-mono text-[10px] lg:text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                <tr>
                  <th className="pb-4 font-normal">TXN ID</th>
                  <th className="pb-4 font-normal">AMOUNT</th>
                  <th className="pb-4 font-normal">METHOD</th>
                  <th className="pb-4 font-normal">TIMESTAMP</th>
                  <th className="pb-4 font-normal">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {transactions.map((txn, i) => (
                  <tr key={i} className="hover:bg-[var(--bg-hover)] transition-colors group">
                    <td className="py-4 font-mono text-[var(--accent)] whitespace-nowrap">{txn.id}</td>
                    <td className="py-4 font-bold whitespace-nowrap text-sm lg:text-base">₱{txn.amount.toFixed(2)}</td>
                    <td className="py-4 whitespace-nowrap text-xs lg:text-sm">
                      <span className="flex items-center gap-1.5"><Coins size={14} className="opacity-50"/> {txn.method}</span>
                    </td>
                    <td className="py-4 text-[var(--text-secondary)] whitespace-nowrap text-xs lg:text-sm">{txn.time}</td>
                    <td className="py-4">
                      <span className="badge shrink-0 px-3 py-1 text-[10px] lg:text-xs font-bold uppercase tracking-wider badge-online">{txn.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );
}
