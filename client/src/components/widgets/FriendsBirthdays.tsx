import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';

interface FriendBirthday {
  id: string;
  name: string;
  date: string;   // 'YYYY-MM-DD'
  note?: string;  // megjegyzés
}

const STORAGE_KEY = 'friendsBirthdays';

const MONTHS = [
  'január', 'február', 'március', 'április', 'május', 'június',
  'július', 'augusztus', 'szeptember', 'október', 'november', 'december',
];

function loadFriends(): FriendBirthday[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveFriends(list: FriendBirthday[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

// Következő előfordulás (hónap/nap alapján, évtől függetlenül) + hátralévő napok
function nextOccurrence(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let next = new Date(today.getFullYear(), m - 1, d);
  next.setHours(0, 0, 0, 0);
  if (next < today) {
    next = new Date(today.getFullYear() + 1, m - 1, d);
  }

  const diffMs = next.getTime() - today.getTime();
  const daysLeft = Math.round(diffMs / (1000 * 60 * 60 * 24));

  const turningAge = y ? next.getFullYear() - y : null;

  return { next, daysLeft, turningAge };
}

function formatDate(date: Date) {
  return `${date.getFullYear()}. ${MONTHS[date.getMonth()]} ${date.getDate()}.`;
}

export default function FriendsBirthdays() {
  const [friends, setFriends] = useState<FriendBirthday[]>(() => loadFriends());
  const [browseIndex, setBrowseIndex] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<FriendBirthday>>({
    name: '', date: '', note: '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    saveFriends(friends);
  }, [friends]);

  // Sorba rendezve a következő előfordulás szerint (a legközelebbi legelöl)
  const sorted = useMemo(() => {
    return [...friends]
      .map(f => ({ friend: f, ...nextOccurrence(f.date) }))
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [friends]);

  useEffect(() => {
    if (browseIndex >= sorted.length) setBrowseIndex(Math.max(0, sorted.length - 1));
  }, [sorted.length, browseIndex]);

  const upcoming = sorted[0];
  const browsed = sorted[browseIndex] ?? sorted[0];

  const handleAdd = () => {
    if (!form.name?.trim()) { setError('Add meg a nevet'); return; }
    if (!form.date) { setError('Add meg a dátumot'); return; }

    const entry: FriendBirthday = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      name: form.name.trim(),
      date: form.date,
      note: form.note?.trim() || undefined,
    };

    setFriends(prev => [...prev, entry]);
    setForm({ name: '', date: '', note: '' });
    setError('');
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    setFriends(prev => prev.filter(f => f.id !== id));
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-5 flex flex-col h-full">
      <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase mb-4">
        🎂 Ismerősök Szülinapja
      </p>

      {sorted.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
          <p className="text-3xl mb-2">🎉</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Még nincs elmentve senki
          </p>
        </div>
      ) : (
        <>
          {/* Következő szülinap — mindig ez van legfelül */}
          <div className="flex flex-col items-center text-center mb-4">
            <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-2xl mb-2">
              🎂
            </div>
            <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
              {upcoming.friend.name}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {formatDate(upcoming.next)}
            </p>
            {upcoming.turningAge !== null && (
              <p className="text-xs text-gray-400 mt-0.5">{upcoming.turningAge}. születésnap</p>
            )}
            {upcoming.friend.note && (
              <p className="text-xs italic text-gray-400 mt-1 max-w-[220px]">
                "{upcoming.friend.note}"
              </p>
            )}
          </div>

          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3 text-center mb-4">
            <p className="text-xs text-gray-400 uppercase font-semibold mb-0.5">Hátravan</p>
            <p className="text-lg font-bold text-purple-700 dark:text-purple-300">
              {upcoming.daysLeft === 0 ? 'Ma van! 🎉' : `${upcoming.daysLeft} nap múlva`}
            </p>
          </div>

          {/* Egyesével böngészés — 1 bejegyzésnél is látszik, csak a nyilak tűnnek el */}
          <div className="border border-gray-100 dark:border-gray-700 rounded-xl p-3 mb-3">
            {sorted.length > 1 && (
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => setBrowseIndex(i => (i - 1 + sorted.length) % sorted.length)}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 text-sm"
                >
                  ◀
                </button>
                <span className="text-xs text-gray-400">{browseIndex + 1} / {sorted.length}</span>
                <button
                  onClick={() => setBrowseIndex(i => (i + 1) % sorted.length)}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 text-sm"
                >
                  ▶
                </button>
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                  {browsed.friend.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(browsed.next)}
                  {' · '}{browsed.daysLeft === 0 ? 'ma' : `${browsed.daysLeft} nap`}
                </p>
                {browsed.friend.note && (
                  <p className="text-xs italic text-gray-400 truncate">"{browsed.friend.note}"</p>
                )}
              </div>
              <button
                onClick={() => handleDelete(browsed.friend.id)}
                className="text-red-400 hover:text-red-600 text-lg flex-shrink-0"
                title="Törlés"
              >
                ×
              </button>
            </div>
          </div>
        </>
      )}

      {/* Hozzáadás */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:border-purple-400 hover:text-purple-500 transition-colors"
        >
          + Új szülinap hozzáadása
        </button>
      ) : (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2 mt-auto">
          <input
            type="text"
            placeholder="Név"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <input
            type="date"
            value={form.date}
            onChange={e => setForm({ ...form, date: e.target.value })}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <textarea
            placeholder="Megjegyzés (opcionális)"
            value={form.note}
            onChange={e => setForm({ ...form, note: e.target.value })}
            rows={2}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
          />
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleAdd} className="flex-1 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">
              Mentés
            </button>
            <button
              onClick={() => { setShowForm(false); setError(''); }}
              className="flex-1 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm"
            >
              Mégse
            </button>
          </div>
        </div>
      )}
    </div>
  );
}