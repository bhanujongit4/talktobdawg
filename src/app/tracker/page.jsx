'use client';

import React, { useState, useEffect } from 'react';
import { Flame, TrendingDown, Target, Plus, Calendar, Award, Trash2, Activity, ChevronUp, ChevronDown } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, remove, get } from 'firebase/database';

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
  const [todayData, setTodayData] = useState(null);
  const [caloriesIn, setCaloriesIn] = useState('');
  const [dailyCaloriesOut, setDailyCaloriesOut] = useState(2800);
  const [loading, setLoading] = useState(false);

  const today = new Date().toISOString().split('T')[0];

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
        
        // Find today's data
        const todayEntry = entriesArray.find(e => e.date === today);
        setTodayData(todayEntry || null);
      } else {
        setEntries([]);
        setTodayData(null);
      }
    });

    return () => unsubscribe();
  }, [today]);

  const addIntake = async () => {
    if (!caloriesIn) return;
    
    setLoading(true);
    const todayRef = ref(db, `entries/${today}`);
    
    // Get current data for today
    const snapshot = await get(todayRef);
    const currentData = snapshot.val();
    
    const newTotalIn = (currentData?.totalCaloriesIn || 0) + parseInt(caloriesIn);
    const caloriesOut = currentData?.caloriesOut || dailyCaloriesOut;
    const deficit = caloriesOut - newTotalIn;
    
    await set(todayRef, {
      date: today,
      totalCaloriesIn: newTotalIn,
      caloriesOut: caloriesOut,
      deficit: deficit,
      points: deficit,
      timestamp: Date.now(),
      lastUpdated: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    });

    setCaloriesIn('');
    setLoading(false);
  };

  const updateCaloriesOut = async (change) => {
    const newCaloriesOut = dailyCaloriesOut + change;
    setDailyCaloriesOut(newCaloriesOut);
    
    // Update today's entry if it exists
    if (todayData) {
      const todayRef = ref(db, `entries/${today}`);
      const totalIn = todayData.totalCaloriesIn || 0;
      const deficit = newCaloriesOut - totalIn;
      
      await set(todayRef, {
        ...todayData,
        caloriesOut: newCaloriesOut,
        deficit: deficit,
        points: deficit,
        timestamp: Date.now()
      });
    }
  };

  const deleteEntry = async (date) => {
    const entryRef = ref(db, `entries/${date}`);
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

  const todayPoints = todayData?.points || 0;
  const todayIntake = todayData?.totalCaloriesIn || 0;
  const todayOut = todayData?.caloriesOut || dailyCaloriesOut;

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
            <div className={`text-4xl font-bold font-mono ${todayPoints >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {todayPoints > 0 ? '+' : ''}{todayPoints.toLocaleString()}
            </div>
            <div className="text-sm text-zinc-500 mt-1">points</div>
          </div>
        </div>

        {/* Today's Summary Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Today's Summary</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-zinc-800/50 rounded-lg p-4">
              <div className="text-sm text-zinc-400 mb-1">Total Intake</div>
              <div className="text-2xl font-bold text-red-400 font-mono">{todayIntake}</div>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-4">
              <div className="text-sm text-zinc-400 mb-1">Expected Out</div>
              <div className="text-2xl font-bold text-blue-400 font-mono">{todayOut}</div>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-4">
              <div className="text-sm text-zinc-400 mb-1">Deficit</div>
              <div className={`text-2xl font-bold font-mono ${(todayOut - todayIntake) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {todayOut - todayIntake}
              </div>
            </div>
          </div>
        </div>

        {/* Input Section */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <Plus className="w-6 h-6 text-green-500" />
            <h2 className="text-xl font-semibold">Add Intake</h2>
          </div>
          
          {/* Daily Calories Out Control */}
          <div className="mb-6 bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-zinc-400 mb-1">Daily Calories Out (Constant)</div>
                <div className="text-2xl font-bold text-green-500 font-mono">{dailyCaloriesOut}</div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => updateCaloriesOut(-50)}
                  className="bg-zinc-700 hover:bg-zinc-600 text-zinc-100 p-2 rounded-lg transition-colors"
                >
                  <ChevronDown className="w-5 h-5" />
                </button>
                <button
                  onClick={() => updateCaloriesOut(50)}
                  className="bg-zinc-700 hover:bg-zinc-600 text-zinc-100 p-2 rounded-lg transition-colors"
                >
                  <ChevronUp className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Add Calories
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
                New Total Intake
              </label>
              <div className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-4 py-3 text-zinc-300 font-mono text-lg">
                {caloriesIn ? (todayIntake + parseInt(caloriesIn)).toLocaleString() : todayIntake.toLocaleString()}
              </div>
            </div>
          </div>

          {caloriesIn && (
            <div className="mb-6 bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
              <div className="text-sm text-zinc-400 mb-2">New Points After This Entry</div>
              <div className={`text-3xl font-bold font-mono ${(todayOut - (todayIntake + parseInt(caloriesIn))) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {(todayOut - (todayIntake + parseInt(caloriesIn))) >= 0 ? '+' : ''}
                {(todayOut - (todayIntake + parseInt(caloriesIn))).toLocaleString()}
              </div>
            </div>
          )}

          <button
            onClick={addIntake}
            disabled={loading || !caloriesIn}
            className="w-full bg-green-500 hover:bg-green-600 text-black font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-green-500"
          >
            {loading ? 'Adding...' : 'Add Intake'}
          </button>
        </div>

        {/* Entries List */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <Flame className="w-6 h-6 text-green-500" />
            <h2 className="text-xl font-semibold">Daily Log</h2>
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
                      <div className="text-zinc-500 text-sm font-mono min-w-32">
                        {entry.date}
                        {entry.lastUpdated && <span className="ml-2 text-zinc-600">{entry.lastUpdated}</span>}
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        <div>
                          <span className="text-zinc-500">Total In:</span>
                          <span className="ml-2 text-red-400 font-mono">{entry.totalCaloriesIn}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500">Out:</span>
                          <span className="ml-2 text-blue-400 font-mono">{entry.caloriesOut}</span>
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
                        onClick={() => deleteEntry(entry.date)}
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
