'use client';

import React, { useState, useEffect } from 'react';
import { Flame, TrendingDown, Target, Plus, Calendar, Award, Trash2, Activity } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, push, onValue, remove } from 'firebase/database';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export default function CalorieTracker() {
  const [entries, setEntries] = useState([]);
  const [caloriesIn, setCaloriesIn] = useState('');
  const [caloriesOut, setCaloriesOut] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const entriesRef = ref(db, 'entries');
    const unsubscribe = onValue(entriesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const entriesArray = Object.entries(data).map(([id, entry]) => ({
          id,
          ...entry
        }));
        setEntries(entriesArray.sort((a, b) => b.timestamp - a.timestamp));
      } else {
        setEntries([]);
      }
    });

    return () => unsubscribe();
  }, []);

  const addEntry = async () => {
    if (!caloriesIn || !caloriesOut) return;
    
    setLoading(true);
    const entriesRef = ref(db, 'entries');
    const deficit = parseInt(caloriesOut) - parseInt(caloriesIn);
    
    await push(entriesRef, {
      caloriesIn: parseInt(caloriesIn),
      caloriesOut: parseInt(caloriesOut),
      deficit,
      points: deficit,
      timestamp: Date.now(),
      date: new Date().toISOString().split('T')[0]
    });

    setCaloriesIn('');
    setCaloriesOut('');
    setLoading(false);
  };

  const deleteEntry = async (id) => {
    const entryRef = ref(db, `entries/${id}`);
    await remove(entryRef);
  };

  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  const currentMonth = getCurrentMonth();
  const monthlyEntries = entries.filter(e => e.date.startsWith(currentMonth));
  const totalPoints = monthlyEntries.reduce((sum, e) => sum + e.points, 0);
  const monthlyGoal = 25000;
  const progress = (totalPoints / monthlyGoal) * 100;

  const todayEntries = entries.filter(e => e.date === new Date().toISOString().split('T')[0]);
  const todayPoints = todayEntries.reduce((sum, e) => sum + e.points, 0);

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-12 pt-8">
          <div className="flex items-center gap-4 mb-3">
            <Activity className="w-10 h-10 text-green-500" />
            <h1 className="text-5xl font-bold tracking-tight">Calorie Tracker</h1>
          </div>
          <p className="text-zinc-400 text-lg ml-14">Precision tracking for optimal performance</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {/* Monthly Goal Card */}
          <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-lg p-6 hover:border-zinc-700 transition-colors">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Target className="w-6 h-6 text-green-500" />
                <h2 className="text-xl font-semibold">Monthly Target</h2>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-green-500">{totalPoints.toLocaleString()}</div>
                <div className="text-sm text-zinc-500">/ {monthlyGoal.toLocaleString()} pts</div>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Progress</span>
                <span className="text-zinc-300 font-mono">{progress.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-3 overflow-hidden">
                <div 
                  className="h-full bg-green-500 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
            </div>

            {progress >= 100 && (
              <div className="mt-4 bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex items-center gap-3">
                <Award className="w-6 h-6 text-green-500" />
                <span className="text-green-500 font-semibold">Target achieved this month</span>
              </div>
            )}
          </div>

          {/* Today's Points */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 hover:border-zinc-700 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <Calendar className="w-6 h-6 text-green-500" />
              <h2 className="text-xl font-semibold">Today</h2>
            </div>
            <div className="text-4xl font-bold text-green-500 font-mono">
              {todayPoints > 0 ? '+' : ''}{todayPoints.toLocaleString()}
            </div>
            <div className="text-sm text-zinc-500 mt-1">points</div>
          </div>
        </div>

        {/* Input Section */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <Plus className="w-6 h-6 text-green-500" />
            <h2 className="text-xl font-semibold">New Entry</h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Calories In
              </label>
              <input
                type="number"
                value={caloriesIn}
                onChange={(e) => setCaloriesIn(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors font-mono"
                placeholder="0"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Calories Out
              </label>
              <input
                type="number"
                value={caloriesOut}
                onChange={(e) => setCaloriesOut(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors font-mono"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Deficit
              </label>
              <div className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-4 py-3 text-green-500 font-mono text-lg font-semibold">
                {caloriesIn && caloriesOut ? (parseInt(caloriesOut) - parseInt(caloriesIn)).toLocaleString() : '—'}
              </div>
            </div>
          </div>

          <button
            onClick={addEntry}
            disabled={loading || !caloriesIn || !caloriesOut}
            className="w-full bg-green-500 hover:bg-green-600 text-black font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-green-500"
          >
            {loading ? 'Adding Entry...' : 'Add Entry'}
          </button>
        </div>

        {/* Entries List */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <Flame className="w-6 h-6 text-green-500" />
            <h2 className="text-xl font-semibold">Activity Log</h2>
          </div>
          
          <div className="space-y-2">
            {entries.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No entries recorded</p>
              </div>
            ) : (
              entries.map((entry) => (
                <div 
                  key={entry.id} 
                  className="bg-zinc-800/50 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="text-zinc-500 text-sm font-mono min-w-24">
                        {entry.date}
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        <div>
                          <span className="text-zinc-500">In:</span>
                          <span className="ml-2 text-zinc-300 font-mono">{entry.caloriesIn}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500">Out:</span>
                          <span className="ml-2 text-zinc-300 font-mono">{entry.caloriesOut}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500">Deficit:</span>
                          <span className="ml-2 text-zinc-300 font-mono">{entry.deficit}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className={`text-xl font-bold font-mono ${entry.points >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {entry.points >= 0 ? '+' : ''}{entry.points.toLocaleString()}
                      </div>
                      <button
                        onClick={() => deleteEntry(entry.id)}
                        className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-500 p-2 hover:bg-zinc-700 rounded transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
