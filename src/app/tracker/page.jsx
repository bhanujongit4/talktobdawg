import React, { useState, useEffect } from 'react';
import { Flame, TrendingDown, Target, Plus, Calendar, Award, Trash2 } from 'lucide-react';
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
    <div className="min-h-screen bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 pt-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Flame className="w-12 h-12 text-white" />
            <h1 className="text-5xl font-bold text-white">Calorie Tracker</h1>
          </div>
          <p className="text-white/90 text-lg">Track your deficit, earn points, crush goals!</p>
        </div>

        {/* Monthly Progress Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 mb-6 transform hover:scale-[1.02] transition-transform">
          <div className="flex items-center gap-3 mb-4">
            <Target className="w-8 h-8 text-purple-600" />
            <h2 className="text-2xl font-bold text-gray-800">Monthly Goal</h2>
          </div>
          <div className="mb-4">
            <div className="flex justify-between mb-2">
              <span className="text-gray-600 font-semibold">Progress</span>
              <span className="text-2xl font-bold text-purple-600">{totalPoints.toLocaleString()} / {monthlyGoal.toLocaleString()} pts</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                style={{ width: `${Math.min(progress, 100)}%` }}
              >
                {progress > 10 && <span className="text-white text-sm font-bold">{progress.toFixed(1)}%</span>}
              </div>
            </div>
          </div>
          {progress >= 100 && (
            <div className="bg-gradient-to-r from-yellow-400 to-orange-400 rounded-2xl p-4 flex items-center gap-3">
              <Award className="w-8 h-8 text-white" />
              <span className="text-white font-bold text-lg">🎉 Goal Achieved! Amazing work!</span>
            </div>
          )}
        </div>

        {/* Today's Summary */}
        <div className="bg-white rounded-3xl shadow-2xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="w-7 h-7 text-pink-600" />
            <h2 className="text-xl font-bold text-gray-800">Today's Points</h2>
          </div>
          <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">
            {todayPoints > 0 ? '+' : ''}{todayPoints.toLocaleString()}
          </div>
        </div>

        {/* Input Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Plus className="w-8 h-8 text-orange-600" />
            <h2 className="text-2xl font-bold text-gray-800">Add Entry</h2>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Calories In 🍽️
              </label>
              <input
                type="number"
                value={caloriesIn}
                onChange={(e) => setCaloriesIn(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none text-lg"
                placeholder="Enter calories consumed"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Calories Out 🔥
              </label>
              <input
                type="number"
                value={caloriesOut}
                onChange={(e) => setCaloriesOut(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-orange-200 focus:border-orange-500 focus:outline-none text-lg"
                placeholder="Enter calories burned"
              />
            </div>
          </div>

          {caloriesIn && caloriesOut && (
            <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-2xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-5 h-5 text-purple-600" />
                <span className="font-semibold text-gray-700">Deficit Preview:</span>
              </div>
              <div className="text-3xl font-bold text-purple-600">
                {(parseInt(caloriesOut) - parseInt(caloriesIn)).toLocaleString()} points
              </div>
            </div>
          )}

          <button
            onClick={addEntry}
            disabled={loading || !caloriesIn || !caloriesOut}
            className="w-full bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 text-white font-bold py-4 rounded-xl hover:shadow-lg transform hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Adding...' : 'Add Entry'}
          </button>
        </div>

        {/* Entries List */}
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Recent Entries</h2>
          <div className="space-y-3">
            {entries.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No entries yet. Start tracking!</p>
            ) : (
              entries.map((entry) => (
                <div key={entry.id} className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 flex items-center justify-between hover:shadow-md transition-shadow">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-2">
                      <span className="text-sm font-semibold text-gray-600">{entry.date}</span>
                      <span className={`text-2xl font-bold ${entry.points >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {entry.points >= 0 ? '+' : ''}{entry.points.toLocaleString()} pts
                      </span>
                    </div>
                    <div className="flex gap-6 text-sm text-gray-600">
                      <span>In: {entry.caloriesIn}</span>
                      <span>Out: {entry.caloriesOut}</span>
                      <span>Deficit: {entry.deficit}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteEntry(entry.id)}
                    className="text-red-500 hover:text-red-700 p-2 hover:bg-red-100 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
