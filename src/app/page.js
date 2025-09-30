"use client"
import { useState, useEffect, useRef } from 'react';
import { Send, LogOut, Clock, User, Smile, Reply, X } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, push, set, onValue, update, remove } from 'firebase/database';

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

// Initialize Firebase only if config is valid
let app;
let db;

try {
  app = initializeApp(firebaseConfig);
  // If databaseURL is not provided, construct it from projectId
  const dbURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || 
                `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`;
  db = getDatabase(app, dbURL);
} catch (error) {
  console.error('Firebase initialization error:', error);
}

const EMOJI_LIST = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export default function EphemeralChat() {
  const [currentUser, setCurrentUser] = useState(null);
  const [page, setPage] = useState('auth');
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [messageTTL, setMessageTTL] = useState('24h');
  const [selectedContact, setSelectedContact] = useState('');
  const [chatPin, setChatPin] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [error, setError] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

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
          setTimeout(scrollToBottom, 100);
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
            if (msg.expiresAt && msg.expiresAt <= now) {
              remove(ref(db, `messages/${chatId}/${msgId}`));
            }
          });
        });
      }
    }, { onlyOnce: true });
  };

  const handleAuth = async () => {
    setError('');
    
    if (!db) {
      setError('Firebase not initialized. Check your configuration.');
      return;
    }
    
    if (pin.length !== 6 || !/^\d+$/.test(pin)) {
      setError('PIN must be 6 digits');
      return;
    }
    if (password.length < 4) {
      setError('Password must be at least 4 characters');
      return;
    }

    const users1Ref = ref(db, `users1/${pin}`);
    
    try {
      onValue(users1Ref, (snapshot) => {
        const userData = snapshot.val();
        
        if (isSignup) {
          if (userData) {
            setError('PIN already exists');
            return;
          }
          set(users1Ref, { password, ttl: messageTTL }).then(() => {
            const user = { pin, ttl: messageTTL };
            setCurrentUser(user);
            sessionStorage.setItem('currentUser', JSON.stringify(user));
            setPage('contacts');
            loadContacts(pin);
          }).catch((error) => {
            setError('Signup failed: ' + error.message);
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
    } catch (error) {
      setError('Authentication error: ' + error.message);
    }
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
    
    if (!db) {
      setError('Firebase not initialized');
      return;
    }
    
    const userRef = ref(db, `users1/${chatPin}`);
    try {
      onValue(userRef, (snapshot) => {
        if (!snapshot.exists()) {
          setError('User not found');
          return;
        }
        setError('');
        setSelectedContact(chatPin);
        setPage('chat');
      }, { onlyOnce: true });
    } catch (error) {
      setError('Error starting chat: ' + error.message);
    }
  };

  const sendMessage = () => {
    if (!messageInput.trim()) return;
    
    const chatId = [currentUser.pin, selectedContact].sort().join('_');
    const messagesRef = ref(db, `messages/${chatId}`);
    const newMessageRef = push(messagesRef);
    
    const newMessage = {
      from: currentUser.pin,
      to: selectedContact,
      text: messageInput,
      timestamp: Date.now(),
      reactions: {},
      replyTo: replyingTo ? {
        id: replyingTo.id,
        text: replyingTo.text,
        from: replyingTo.from
      } : null
    };

    if (currentUser.ttl !== 'never') {
      const hours = parseInt(currentUser.ttl);
      newMessage.expiresAt = Date.now() + (hours * 60 * 60 * 1000);
    }
    
    set(newMessageRef, newMessage).then(() => {
      setMessageInput('');
      setReplyingTo(null);
      loadContacts(currentUser.pin);
      scrollToBottom();
    });
  };

  const addReaction = (messageId, emoji) => {
    const chatId = [currentUser.pin, selectedContact].sort().join('_');
    const messageRef = ref(db, `messages/${chatId}/${messageId}/reactions/${currentUser.pin}`);
    set(messageRef, emoji);
    setShowEmojiPicker(null);
  };

  const removeReaction = (messageId) => {
    const chatId = [currentUser.pin, selectedContact].sort().join('_');
    const reactionRef = ref(db, `messages/${chatId}/${messageId}/reactions/${currentUser.pin}`);
    remove(reactionRef);
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
    if (!expiresAt) return 'permanent';
    const hoursLeft = Math.ceil((expiresAt - Date.now()) / (1000 * 60 * 60));
    return `${hoursLeft}h left`;
  };

  const getTTLDisplay = (ttl) => {
    if (ttl === 'never') return 'Never';
    return `${ttl}`;
  };

  if (page === 'auth') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-black to-zinc-900 flex items-center justify-center p-4">
        <div className="bg-zinc-900/50 backdrop-blur-lg rounded-2xl p-8 w-full max-w-md border border-zinc-800">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-emerald-400 mb-2">EphemeralChat</h1>
            <p className="text-zinc-400 text-sm">Secure • Private • Temporary</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-white text-sm mb-2">6-Digit PIN</label>
              <input
                type="text"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 rounded-lg bg-zinc-800/80 text-white placeholder-zinc-500 border border-zinc-700 focus:outline-none focus:border-emerald-500"
                placeholder="123456"
              />
            </div>

            <div>
              <label className="block text-white text-sm mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-zinc-800/80 text-white placeholder-zinc-500 border border-zinc-700 focus:outline-none focus:border-emerald-500"
                placeholder="••••••"
              />
            </div>

            {isSignup && (
              <div>
                <label className="block text-white text-sm mb-2">Message Auto-Delete</label>
                <select
                  value={messageTTL}
                  onChange={(e) => setMessageTTL(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-zinc-800/80 text-white border border-zinc-700 focus:outline-none focus:border-emerald-500"
                >
                  <option value="24h" className="bg-zinc-900">24 Hours</option>
                  <option value="never" className="bg-zinc-900">Never Delete</option>
                </select>
              </div>
            )}

            {error && <p className="text-red-400 text-sm text-center bg-red-500/10 py-2 rounded-lg">{error}</p>}

            <button
              onClick={handleAuth}
              className="w-full bg-emerald-500 text-black py-3 rounded-lg font-semibold hover:bg-emerald-400 transition"
            >
              {isSignup ? 'Create Account' : 'Login'}
            </button>

            <button
              onClick={() => {
                setIsSignup(!isSignup);
                setError('');
              }}
              className="w-full text-zinc-400 text-sm hover:text-white transition"
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
      <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-black to-zinc-900 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-zinc-900/50 backdrop-blur-lg rounded-2xl border border-zinc-800 overflow-hidden">
            <div className="bg-zinc-900/80 px-6 py-4 flex items-center justify-between border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <User className="text-emerald-400" size={24} />
                <div>
                  <h2 className="text-white font-semibold">Your PIN: {currentUser.pin}</h2>
                  <p className="text-zinc-400 text-xs">Messages: {getTTLDisplay(currentUser.ttl)}</p>
                </div>
              </div>
              <button onClick={logout} className="text-zinc-400 hover:text-white transition">
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
                  className="flex-1 px-4 py-3 rounded-lg bg-zinc-800/80 text-white placeholder-zinc-500 border border-zinc-700 focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={startChat}
                  className="px-6 py-3 bg-emerald-500 text-black rounded-lg font-semibold hover:bg-emerald-400 transition"
                >
                  Chat
                </button>
              </div>
              {error && <p className="text-red-400 text-sm mb-4 bg-red-500/10 py-2 px-4 rounded-lg">{error}</p>}

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
                        className="w-full px-4 py-3 bg-zinc-800/60 hover:bg-zinc-700/60 rounded-lg text-left text-white transition border border-zinc-700 hover:border-emerald-500/50"
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
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-black to-zinc-900 flex flex-col">
      <div className="bg-zinc-900/50 backdrop-blur-lg border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <button
          onClick={() => {
            setPage('contacts');
            setSelectedContact('');
            setReplyingTo(null);
          }}
          className="text-white hover:text-emerald-400 transition font-medium"
        >
          ← Back
        </button>
        <div className="text-center">
          <h2 className="text-white font-semibold">PIN: {selectedContact}</h2>
          <p className="text-zinc-400 text-xs flex items-center gap-1 justify-center">
            <Clock size={12} /> {getTTLDisplay(currentUser.ttl)}
          </p>
        </div>
        <button onClick={logout} className="text-zinc-400 hover:text-white transition">
          <LogOut size={20} />
        </button>
      </div>

      <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.from === currentUser.pin ? 'justify-end' : 'justify-start'} group`}
          >
            <div className="relative max-w-xs">
              {msg.replyTo && (
                <div className={`mb-1 px-3 py-2 rounded-lg text-xs ${
                  msg.from === currentUser.pin 
                    ? 'bg-emerald-700/50 text-emerald-100' 
                    : 'bg-zinc-700/50 text-zinc-300'
                } border-l-2 ${
                  msg.from === currentUser.pin ? 'border-emerald-400' : 'border-zinc-500'
                }`}>
                  <p className="opacity-70 text-xs mb-1">Replying to {msg.replyTo.from === currentUser.pin ? 'you' : msg.replyTo.from}</p>
                  <p className="truncate">{msg.replyTo.text}</p>
                </div>
              )}
              
              <div
                className={`px-4 py-2 rounded-2xl ${
                  msg.from === currentUser.pin
                    ? 'bg-emerald-600 text-white'
                    : 'bg-zinc-800 text-white border border-zinc-700'
                }`}
              >
                <p className="break-words">{msg.text}</p>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <p className="text-xs opacity-70">{formatTime(msg.timestamp)}</p>
                  {msg.expiresAt && <p className="text-xs opacity-50">{getTimeLeft(msg.expiresAt)}</p>}
                </div>
              </div>

              {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                <div className="flex gap-1 mt-1 flex-wrap">
                  {Object.entries(msg.reactions).reduce((acc, [userId, emoji]) => {
                    const existing = acc.find(item => item.emoji === emoji);
                    if (existing) {
                      existing.count++;
                      existing.users1.push(userId);
                    } else {
                      acc.push({ emoji, count: 1, users1: [userId] });
                    }
                    return acc;
                  }, []).map((reaction, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        if (reaction.users1.includes(currentUser.pin)) {
                          removeReaction(msg.id);
                        }
                      }}
                      className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 ${
                        reaction.users1.includes(currentUser.pin)
                          ? 'bg-emerald-500/20 border border-emerald-500'
                          : 'bg-zinc-700/50 border border-zinc-600'
                      }`}
                    >
                      <span>{reaction.emoji}</span>
                      <span className="text-zinc-300">{reaction.count}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 right-0 flex gap-1 bg-zinc-800 rounded-lg p-1 border border-zinc-700">
                <button
                  onClick={() => setReplyingTo(msg)}
                  className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white"
                  title="Reply"
                >
                  <Reply size={16} />
                </button>
                <button
                  onClick={() => setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id)}
                  className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white"
                  title="React"
                >
                  <Smile size={16} />
                </button>
              </div>

              {showEmojiPicker === msg.id && (
                <div className="absolute top-0 right-0 bg-zinc-800 border border-zinc-700 rounded-lg p-2 flex gap-1 z-10 shadow-lg">
                  {EMOJI_LIST.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => addReaction(msg.id, emoji)}
                      className="text-xl hover:scale-125 transition-transform"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="bg-zinc-900/50 backdrop-blur-lg border-t border-zinc-800 p-4">
        {replyingTo && (
          <div className="mb-2 px-4 py-2 bg-zinc-800 rounded-lg flex items-center justify-between border border-zinc-700">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-zinc-400 mb-1">Replying to {replyingTo.from === currentUser.pin ? 'yourself' : replyingTo.from}</p>
              <p className="text-sm text-white truncate">{replyingTo.text}</p>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="ml-2 text-zinc-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        )}
        
        <div className="flex gap-2">
          <input
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..."
            className="flex-1 px-4 py-3 rounded-full bg-zinc-800/80 text-white placeholder-zinc-500 border border-zinc-700 focus:outline-none focus:border-emerald-500"
          />
          <button
            onClick={sendMessage}
            className="p-3 bg-emerald-600 hover:bg-emerald-500 rounded-full text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!messageInput.trim()}
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
