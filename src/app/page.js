"use client"
import { useState, useEffect } from 'react';
import { Send, LogOut, Clock, User } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, push, set, onValue, query, orderByChild, equalTo, remove } from 'firebase/database';

// Replace with your Firebase config from Firebase Console
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
// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export default function EphemeralChat() {
  const [currentUser, setCurrentUser] = useState(null);
  const [page, setPage] = useState('auth');
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [messageTTL, setMessageTTL] = useState(48);
  const [selectedContact, setSelectedContact] = useState('');
  const [chatPin, setChatPin] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const user = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (user) {
      setCurrentUser(user);
      setPage('contacts');
      loadContacts(user.pin);
    }
    cleanExpiredMessages();
    const interval = setInterval(cleanExpiredMessages, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedContact && currentUser) {
      const chatId = [currentUser.pin, selectedContact].sort().join('_');
      const messagesRef = ref(db, `messages/${chatId}`);
      
      const unsubscribe = onValue(messagesRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const msgArray = Object.entries(data).map(([key, val]) => ({
            id: key,
            ...val
          })).sort((a, b) => a.timestamp - b.timestamp);
          setMessages(msgArray);
        } else {
          setMessages([]);
        }
      });

      return () => unsubscribe();
    }
  }, [selectedContact, currentUser]);

  const cleanExpiredMessages = async () => {
    const messagesRef = ref(db, 'messages');
    onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const now = Date.now();
        Object.entries(data).forEach(([chatId, chatMsgs]) => {
          Object.entries(chatMsgs).forEach(([msgId, msg]) => {
            if (msg.expiresAt <= now) {
              remove(ref(db, `messages/${chatId}/${msgId}`));
            }
          });
        });
      }
    }, { onlyOnce: true });
  };

  const handleAuth = () => {
    setError('');
    if (pin.length !== 6 || !/^\d+$/.test(pin)) {
      setError('PIN must be 6 digits');
      return;
    }
    if (password.length < 4) {
      setError('Password must be at least 4 characters');
      return;
    }

    const usersRef = ref(db, `users/${pin}`);
    
    onValue(usersRef, (snapshot) => {
      const userData = snapshot.val();
      
      if (isSignup) {
        if (userData) {
          setError('PIN already exists');
          return;
        }
        set(usersRef, { password, ttl: messageTTL }).then(() => {
          const user = { pin, ttl: messageTTL };
          setCurrentUser(user);
          sessionStorage.setItem('currentUser', JSON.stringify(user));
          setPage('contacts');
          loadContacts(pin);
        });
      } else {
        if (!userData || userData.password !== password) {
          setError('Invalid PIN or password');
          return;
        }
        const user = { pin, ttl: userData.ttl };
        setCurrentUser(user);
        sessionStorage.setItem('currentUser', JSON.stringify(user));
        setPage('contacts');
        loadContacts(pin);
      }
    }, { onlyOnce: true });
  };

  const loadContacts = (userPin) => {
    const messagesRef = ref(db, 'messages');
    onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const contactSet = new Set();
        Object.entries(data).forEach(([chatId, chatMsgs]) => {
          const [pin1, pin2] = chatId.split('_');
          if (pin1 === userPin) contactSet.add(pin2);
          if (pin2 === userPin) contactSet.add(pin1);
        });
        setContacts(Array.from(contactSet));
      }
    }, { onlyOnce: true });
  };

  const startChat = () => {
    if (chatPin.length !== 6 || !/^\d+$/.test(chatPin)) {
      setError('Enter a valid 6-digit PIN');
      return;
    }
    if (chatPin === currentUser.pin) {
      setError('Cannot chat with yourself');
      return;
    }
    
    const userRef = ref(db, `users/${chatPin}`);
    onValue(userRef, (snapshot) => {
      if (!snapshot.exists()) {
        setError('User not found');
        return;
      }
      setError('');
      setSelectedContact(chatPin);
      setPage('chat');
    }, { onlyOnce: true });
  };

  const sendMessage = () => {
    if (!messageInput.trim()) return;
    
    const chatId = [currentUser.pin, selectedContact].sort().join('_');
    const messagesRef = ref(db, `messages/${chatId}`);
    const newMessageRef = push(messagesRef);
    
    const ttlHours = currentUser.ttl;
    const newMessage = {
      from: currentUser.pin,
      to: selectedContact,
      text: messageInput,
      timestamp: Date.now(),
      expiresAt: Date.now() + (ttlHours * 60 * 60 * 1000)
    };
    
    set(newMessageRef, newMessage).then(() => {
      setMessageInput('');
      loadContacts(currentUser.pin);
    });
  };

  const logout = () => {
    sessionStorage.removeItem('currentUser');
    setCurrentUser(null);
    setPage('auth');
    setSelectedContact('');
    setPin('');
    setPassword('');
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getTimeLeft = (expiresAt) => {
    const hoursLeft = Math.ceil((expiresAt - Date.now()) / (1000 * 60 * 60));
    return `${hoursLeft}h left`;
  };

  if (page === 'auth') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 w-full max-w-md border border-white/20">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">Ephemeral</h1>
            <p className="text-blue-200 text-sm">Messages that disappear</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-white text-sm mb-2">6-Digit PIN</label>
              <input
                type="text"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 rounded-lg bg-white/20 text-white placeholder-white/50 border border-white/30 focus:outline-none focus:border-white/60"
                placeholder="123456"
              />
            </div>

            <div>
              <label className="block text-white text-sm mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/20 text-white placeholder-white/50 border border-white/30 focus:outline-none focus:border-white/60"
                placeholder="••••••"
              />
            </div>

            {isSignup && (
              <div>
                <label className="block text-white text-sm mb-2">Message Lifespan</label>
                <select
                  value={messageTTL}
                  onChange={(e) => setMessageTTL(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-lg bg-white/20 text-white border border-white/30 focus:outline-none focus:border-white/60"
                >
                  <option value={24} className="bg-indigo-900">24 Hours</option>
                  <option value={48} className="bg-indigo-900">48 Hours</option>
                </select>
              </div>
            )}

            {error && <p className="text-red-300 text-sm text-center">{error}</p>}

            <button
              onClick={handleAuth}
              className="w-full bg-white text-indigo-900 py-3 rounded-lg font-semibold hover:bg-blue-50 transition"
            >
              {isSignup ? 'Create Account' : 'Login'}
            </button>

            <button
              onClick={() => {
                setIsSignup(!isSignup);
                setError('');
              }}
              className="w-full text-white/80 text-sm hover:text-white transition"
            >
              {isSignup ? 'Already have a PIN? Login' : 'Need a PIN? Sign up'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (page === 'contacts') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 overflow-hidden">
            <div className="bg-white/5 px-6 py-4 flex items-center justify-between border-b border-white/20">
              <div className="flex items-center gap-3">
                <User className="text-white" size={24} />
                <div>
                  <h2 className="text-white font-semibold">Your PIN: {currentUser.pin}</h2>
                  <p className="text-blue-200 text-xs">Messages expire in {currentUser.ttl}h</p>
                </div>
              </div>
              <button onClick={logout} className="text-white/80 hover:text-white transition">
                <LogOut size={20} />
              </button>
            </div>

            <div className="p-6">
              <h3 className="text-white text-lg font-semibold mb-4">Start a Chat</h3>
              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  maxLength={6}
                  value={chatPin}
                  onChange={(e) => setChatPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 6-digit PIN"
                  className="flex-1 px-4 py-3 rounded-lg bg-white/20 text-white placeholder-white/50 border border-white/30 focus:outline-none focus:border-white/60"
                />
                <button
                  onClick={startChat}
                  className="px-6 py-3 bg-white text-indigo-900 rounded-lg font-semibold hover:bg-blue-50 transition"
                >
                  Chat
                </button>
              </div>
              {error && <p className="text-red-300 text-sm mb-4">{error}</p>}

              {contacts.length > 0 && (
                <div>
                  <h3 className="text-white text-lg font-semibold mb-3">Recent Chats</h3>
                  <div className="space-y-2">
                    {contacts.map(contact => (
                      <button
                        key={contact}
                        onClick={() => {
                          setSelectedContact(contact);
                          setPage('chat');
                        }}
                        className="w-full px-4 py-3 bg-white/10 hover:bg-white/20 rounded-lg text-left text-white transition border border-white/10"
                      >
                        PIN: {contact}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col">
      <div className="bg-white/10 backdrop-blur-lg border-b border-white/20 px-6 py-4 flex items-center justify-between">
        <button
          onClick={() => {
            setPage('contacts');
            setSelectedContact('');
          }}
          className="text-white hover:text-blue-200 transition"
        >
          ← Back
        </button>
        <div className="text-center">
          <h2 className="text-white font-semibold">PIN: {selectedContact}</h2>
          <p className="text-blue-200 text-xs flex items-center gap-1 justify-center">
            <Clock size={12} /> Messages expire in {currentUser.ttl}h
          </p>
        </div>
        <button onClick={logout} className="text-white/80 hover:text-white transition">
          <LogOut size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.from === currentUser.pin ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs px-4 py-2 rounded-2xl ${
                msg.from === currentUser.pin
                  ? 'bg-blue-500 text-white'
                  : 'bg-white/20 text-white border border-white/30'
              }`}
            >
              <p className="break-words">{msg.text}</p>
              <div className="flex items-center justify-between gap-2 mt-1">
                <p className="text-xs opacity-70">{formatTime(msg.timestamp)}</p>
                <p className="text-xs opacity-50">{getTimeLeft(msg.expiresAt)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white/10 backdrop-blur-lg border-t border-white/20 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..."
            className="flex-1 px-4 py-3 rounded-full bg-white/20 text-white placeholder-white/50 border border-white/30 focus:outline-none focus:border-white/60"
          />
          <button
            onClick={sendMessage}
            className="p-3 bg-blue-500 hover:bg-600 rounded-full text-white transition"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}