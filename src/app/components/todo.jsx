"use client"
import { useState, useEffect } from 'react';
import { CheckSquare, Square, Plus, Edit2, Trash2, Calendar, X, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { getDatabase, ref, push, set, onValue, remove, update } from 'firebase/database';

export default function TodoComponent({ db, currentUser, onBack }) {
  const [todos, setTodos] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedTodo, setSelectedTodo] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [completionHistory, setCompletionHistory] = useState({});
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    recurring: 'none',
    recurringDays: []
  });

  useEffect(() => {
    if (currentUser) {
      const todosRef = ref(db, `todos/${currentUser.pin}`);
      const unsubscribe = onValue(todosRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const todoArray = Object.entries(data).map(([key, val]) => ({
            id: key,
            ...val
          }));
          setTodos(todoArray);
        } else {
          setTodos([]);
        }
      });

      const historyRef = ref(db, `todoHistory/${currentUser.pin}`);
      const unsubscribeHistory = onValue(historyRef, (snapshot) => {
        const data = snapshot.val();
        setCompletionHistory(data || {});
      });

      return () => {
        unsubscribe();
        unsubscribeHistory();
      };
    }
  }, [currentUser, db]);

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      recurring: 'none',
      recurringDays: []
    });
  };

  const addTodo = () => {
    if (!formData.title.trim()) return;

    const todosRef = ref(db, `todos/${currentUser.pin}`);
    const newTodoRef = push(todosRef);
    
    const newTodo = {
      title: formData.title,
      description: formData.description,
      recurring: formData.recurring,
      recurringDays: formData.recurringDays,
      completed: false,
      createdAt: Date.now()
    };

    set(newTodoRef, newTodo).then(() => {
      setShowAddModal(false);
      resetForm();
    });
  };

  const editTodo = () => {
    if (!formData.title.trim() || !selectedTodo) return;

    const todoRef = ref(db, `todos/${currentUser.pin}/${selectedTodo.id}`);
    
    update(todoRef, {
      title: formData.title,
      description: formData.description,
      recurring: formData.recurring,
      recurringDays: formData.recurringDays
    }).then(() => {
      setShowEditModal(false);
      setSelectedTodo(null);
      resetForm();
    });
  };

  const deleteTodo = (todoId) => {
    if (confirm('Delete this task?')) {
      const todoRef = ref(db, `todos/${currentUser.pin}/${todoId}`);
      remove(todoRef);
    }
  };

  const toggleComplete = (todo) => {
    const todoRef = ref(db, `todos/${currentUser.pin}/${todo.id}`);
    const newCompleted = !todo.completed;
    
    update(todoRef, { completed: newCompleted });

    if (newCompleted) {
      const today = new Date().toISOString().split('T')[0];
      const historyRef = ref(db, `todoHistory/${currentUser.pin}/${today}/${todo.id}`);
      set(historyRef, {
        title: todo.title,
        completedAt: Date.now()
      });
    }
  };

  const openEditModal = (todo) => {
    setSelectedTodo(todo);
    setFormData({
      title: todo.title,
      description: todo.description || '',
      recurring: todo.recurring || 'none',
      recurringDays: todo.recurringDays || []
    });
    setShowEditModal(true);
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const getCompletedTasksForDate = (dateStr) => {
    return completionHistory[dateStr] ? Object.keys(completionHistory[dateStr]).length : 0;
  };

  const renderCalendar = () => {
    const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth);
    const days = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="p-2"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const completedCount = getCompletedTasksForDate(dateStr);
      const isToday = dateStr === new Date().toISOString().split('T')[0];

      days.push(
        <div
          key={day}
          className={`p-2 border border-zinc-700 rounded-lg ${isToday ? 'bg-emerald-900/30 border-emerald-500' : 'bg-zinc-800/50'}`}
        >
          <div className="text-white text-sm font-semibold">{day}</div>
          {completedCount > 0 && (
            <div className="mt-1 text-xs text-emerald-400">{completedCount} ✓</div>
          )}
        </div>
      );
    }

    return (
      <div>
        <div className="grid grid-cols-7 gap-2 mb-2">
          {dayNames.map(name => (
            <div key={name} className="text-center text-xs text-zinc-400 font-semibold p-2">
              {name}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {days}
        </div>
      </div>
    );
  };

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const toggleRecurringDay = (day) => {
    setFormData(prev => ({
      ...prev,
      recurringDays: prev.recurringDays.includes(day)
        ? prev.recurringDays.filter(d => d !== day)
        : [...prev.recurringDays, day]
    }));
  };

  const recurringDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-black to-zinc-900 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-zinc-900/50 backdrop-blur-lg rounded-2xl border border-zinc-800 overflow-hidden">
          <div className="bg-zinc-900/80 px-6 py-4 flex items-center justify-between border-b border-zinc-800">
            <button onClick={onBack} className="text-white hover:text-emerald-400 transition">
              ← Back
            </button>
            <h2 className="text-white font-semibold text-xl">My Tasks</h2>
            <button
              onClick={() => setShowCalendar(!showCalendar)}
              className="text-zinc-400 hover:text-white transition"
            >
              <Calendar size={20} />
            </button>
          </div>

          {showCalendar ? (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <button onClick={previousMonth} className="text-white hover:text-emerald-400 transition">
                  <ChevronLeft size={24} />
                </button>
                <h3 className="text-white font-semibold text-lg">
                  {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h3>
                <button onClick={nextMonth} className="text-white hover:text-emerald-400 transition">
                  <ChevronRight size={24} />
                </button>
              </div>
              {renderCalendar()}
            </div>
          ) : (
            <div className="p-6">
              <button
                onClick={() => setShowAddModal(true)}
                className="w-full mb-6 px-4 py-3 bg-emerald-500 text-black rounded-lg font-semibold hover:bg-emerald-400 transition flex items-center justify-center gap-2"
              >
                <Plus size={20} /> Add Task
              </button>

              <div className="space-y-3">
                {todos.length === 0 ? (
                  <p className="text-zinc-400 text-center py-8">No tasks yet. Create your first task!</p>
                ) : (
                  todos.map(todo => (
                    <div
                      key={todo.id}
                      className="bg-zinc-800/60 border border-zinc-700 rounded-lg p-4 hover:border-emerald-500/50 transition"
                    >
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => toggleComplete(todo)}
                          className="text-emerald-400 hover:text-emerald-300 transition mt-1"
                        >
                          {todo.completed ? <CheckSquare size={20} /> : <Square size={20} />}
                        </button>
                        
                        <div className="flex-1 min-w-0">
                          <h3 className={`text-white font-semibold ${todo.completed ? 'line-through opacity-50' : ''}`}>
                            {todo.title}
                          </h3>
                          {todo.description && (
                            <p className="text-zinc-400 text-sm mt-1">{todo.description}</p>
                          )}
                          {todo.recurring !== 'none' && (
                            <div className="mt-2 flex items-center gap-2 text-xs">
                              <Clock size={12} className="text-emerald-400" />
                              <span className="text-emerald-400">
                                {todo.recurring === 'daily' && 'Daily'}
                                {todo.recurring === 'weekly' && `Weekly: ${todo.recurringDays.join(', ')}`}
                                {todo.recurring === 'custom' && `Custom: ${todo.recurringDays.join(', ')}`}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => openEditModal(todo)}
                            className="text-zinc-400 hover:text-white transition"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => deleteTodo(todo.id)}
                            className="text-zinc-400 hover:text-red-400 transition"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white font-semibold text-xl">New Task</h3>
              <button onClick={() => { setShowAddModal(false); resetForm(); }} className="text-zinc-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-white text-sm mb-2">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full px-4 py-3 rounded-lg bg-zinc-800 text-white border border-zinc-700 focus:outline-none focus:border-emerald-500"
                  placeholder="Task title"
                />
              </div>

              <div>
                <label className="block text-white text-sm mb-2">Description (optional)</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-3 rounded-lg bg-zinc-800 text-white border border-zinc-700 focus:outline-none focus:border-emerald-500 resize-none"
                  rows="3"
                  placeholder="Task details"
                />
              </div>

              <div>
                <label className="block text-white text-sm mb-2">Recurring</label>
                <select
                  value={formData.recurring}
                  onChange={(e) => setFormData({...formData, recurring: e.target.value, recurringDays: []})}
                  className="w-full px-4 py-3 rounded-lg bg-zinc-800 text-white border border-zinc-700 focus:outline-none focus:border-emerald-500"
                >
                  <option value="none">None</option>
                  <option value="daily">Daily</option>
                  <option value="custom">Custom Days</option>
                </select>
              </div>

              {formData.recurring === 'custom' && (
                <div>
                  <label className="block text-white text-sm mb-2">Select Days</label>
                  <div className="flex gap-2 flex-wrap">
                    {recurringDays.map(day => (
                      <button
                        key={day}
                        onClick={() => toggleRecurringDay(day)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                          formData.recurringDays.includes(day)
                            ? 'bg-emerald-500 text-black'
                            : 'bg-zinc-800 text-white border border-zinc-700'
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={addTodo}
                className="w-full bg-emerald-500 text-black py-3 rounded-lg font-semibold hover:bg-emerald-400 transition"
              >
                Create Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white font-semibold text-xl">Edit Task</h3>
              <button onClick={() => { setShowEditModal(false); setSelectedTodo(null); resetForm(); }} className="text-zinc-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-white text-sm mb-2">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full px-4 py-3 rounded-lg bg-zinc-800 text-white border border-zinc-700 focus:outline-none focus:border-emerald-500"
                  placeholder="Task title"
                />
              </div>

              <div>
                <label className="block text-white text-sm mb-2">Description (optional)</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-3 rounded-lg bg-zinc-800 text-white border border-zinc-700 focus:outline-none focus:border-emerald-500 resize-none"
                  rows="3"
                  placeholder="Task details"
                />
              </div>

              <div>
                <label className="block text-white text-sm mb-2">Recurring</label>
                <select
                  value={formData.recurring}
                  onChange={(e) => setFormData({...formData, recurring: e.target.value, recurringDays: []})}
                  className="w-full px-4 py-3 rounded-lg bg-zinc-800 text-white border border-zinc-700 focus:outline-none focus:border-emerald-500"
                >
                  <option value="none">None</option>
                  <option value="daily">Daily</option>
                  <option value="custom">Custom Days</option>
                </select>
              </div>

              {formData.recurring === 'custom' && (
                <div>
                  <label className="block text-white text-sm mb-2">Select Days</label>
                  <div className="flex gap-2 flex-wrap">
                    {recurringDays.map(day => (
                      <button
                        key={day}
                        onClick={() => toggleRecurringDay(day)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                          formData.recurringDays.includes(day)
                            ? 'bg-emerald-500 text-black'
                            : 'bg-zinc-800 text-white border border-zinc-700'
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={editTodo}
                className="w-full bg-emerald-500 text-black py-3 rounded-lg font-semibold hover:bg-emerald-400 transition"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
