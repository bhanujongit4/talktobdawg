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
  const [messageTTL, setMessageTTL] = useState('24');
  const [selectedContact, setSelectedContact] = useState('');
  const [chatPin, setChatPin] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [error, setError] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);

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
            if (msg.expiresAt && msg.expiresAt <= now) {
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

  const toggleLike = (msgId) => {
    const chatId = [currentUser.pin, selectedContact].sort().join('_');
    const messageRef = ref(db, `messages/${chatId}/${msgId}`);
    
    const msg = messages.find(m => m.id === msgId);
    const likes = msg.likes || [];
    const hasLiked = likes.includes(currentUser.pin);
    
    const updatedLikes = hasLiked 
      ? likes.filter(pin => pin !== currentUser.pin)
      : [...likes, currentUser.pin];
    
    update(messageRef, { likes: updatedLikes });
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
      expiresAt: currentUser.ttl === '24' ? Date.now() + (24 * 60 * 60 * 1000) : null,
      likes: [],
      replyTo: replyingTo ? replyingTo.id : null
    };
    
    set(newMessageRef, newMessage).then(() => {
      setMessageInput('');
      setReplyingTo(null);
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
    if (!expiresAt) return 'Forever';
    const hoursLeft = Math.ceil((expiresAt - Date.now()) / (1000 * 60 * 60));
    return `${hoursLeft}h left`;
  };

  const getRepliedMessage = (replyToId) => {
    return messages.find(m => m.id === replyToId);
  };

  if (page === 'auth') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-black to-zinc-900 flex items-center justify-center p-4">
        <div className="bg-zinc-900/50 backdrop-blur-lg rounded-2xl p-8 w-full max-w-md border border-zinc-800">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-emerald-400 mb-2">WithBhanuj</h1>
            <p className="text-zinc-400 text-sm">In Development Phase</p>
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
                <label className="block text-white text-sm mb-2">Message Lifespan</label>
                <select
                  value={messageTTL}
                  onChange={(e) => setMessageTTL(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-zinc-800/80 text-white border border-zinc-700 focus:outline-none focus:border-emerald-500"
                >
                  <option value="24" className="bg-zinc-900">24 Hours</option>
                  <option value="forever" className="bg-zinc-900">Keep Forever</option>
                </select>
              </div>
            )}

            {error && <p className="text-red-300 text-sm text-center">{error}</p>}

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
                <User className="text-white" size={24} />
                <div>
                  <h2 className="text-white font-semibold">Your PIN: {currentUser.pin}</h2>
                  <p className="text-zinc-400 text-xs">
                    Messages {currentUser.ttl === '24' ? 'expire in 24h' : 'kept forever'}
                  </p>
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
                        className="w-full px-4 py-3 bg-zinc-800/60 hover:bg-zinc-700/60 rounded-lg text-left text-white transition border border-zinc-700"
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
          className="text-white hover:text-zinc-300 transition"
        >
          ← Back
        </button>
        <div className="text-center">
          <h2 className="text-white font-semibold">PIN: {selectedContact}</h2>
          <p className="text-zinc-400 text-xs flex items-center gap-1 justify-center">
            <Clock size={12} /> Messages {currentUser.ttl === '24' ? 'expire in 24h' : 'kept forever'}
          </p>
        </div>
        <button onClick={logout} className="text-zinc-400 hover:text-white transition">
          <LogOut size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map(msg => {
          const repliedMsg = msg.replyTo ? getRepliedMessage(msg.replyTo) : null;
          const isLiked = msg.likes && msg.likes.includes(currentUser.pin);
          const likeCount = msg.likes ? msg.likes.length : 0;
          
          return (
            <div
              key={msg.id}
              className={`flex ${msg.from === currentUser.pin ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs ${
                  msg.from === currentUser.pin
                    ? 'bg-emerald-600 text-white'
                    : 'bg-zinc-800 text-white border border-zinc-700'
                } rounded-2xl overflow-hidden`}
              >
                {repliedMsg && (
                  <div className="px-4 pt-2 pb-1 border-b border-white/10">
                    <div className="flex items-center gap-1 text-xs opacity-70 mb-1">
                      <Reply size={12} />
                      <span>Reply to</span>
                    </div>
                    <p className="text-xs opacity-80 line-clamp-2">{repliedMsg.text}</p>
                  </div>
                )}
                
                <div className="px-4 py-2">
                  <p className="break-words">{msg.text}</p>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <p className="text-xs opacity-70">{formatTime(msg.timestamp)}</p>
                    <p className="text-xs opacity-50">{getTimeLeft(msg.expiresAt)}</p>
                  </div>
                </div>

                <div className="px-2 pb-2 flex items-center justify-end gap-2">
                  <button
                    onClick={() => setReplyingTo(msg)}
                    className="p-1 hover:bg-white/10 rounded transition"
                  >
                    <Reply size={14} />
                  </button>
                  <button
                    onClick={() => toggleLike(msg.id)}
                    className="flex items-center gap-1 p-1 hover:bg-white/10 rounded transition"
                  >
                    <Heart 
                      size={14} 
                      className={isLiked ? 'fill-red-500 text-red-500' : ''}
                    />
                    {likeCount > 0 && <span className="text-xs">{likeCount}</span>}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-zinc-900/50 backdrop-blur-lg border-t border-zinc-800 p-4">
        {replyingTo && (
          <div className="mb-2 px-4 py-2 bg-zinc-800/50 rounded-lg flex items-start justify-between gap-2 border border-zinc-700">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 text-emerald-400 text-xs mb-1">
                <Reply size={12} />
                <span>Replying to</span>
              </div>
              <p className="text-zinc-300 text-sm truncate">{replyingTo.text}</p>
            </div>
            <button 
              onClick={() => setReplyingTo(null)}
              className="text-zinc-400 hover:text-white transition flex-shrink-0"
            >
              <X size={16} />
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
            className="p-3 bg-emerald-600 hover:bg-emerald-500 rounded-full text-white transition"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
