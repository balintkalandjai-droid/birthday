import * as React from 'react';
import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/card';

interface Note {
  id: string;
  text: string;
  color: string;
  createdAt: string;
}

interface NotesProps {
  birthday: string;
}

const COLORS = [
  'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
  'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
  'bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800',
  'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
];

let currentRotation = 0;

function checkEasterEggs(notes: Note[]) {
  const allText = notes.map(n => n.text.toLowerCase()).join(' ');
  const hasBalint = allText.includes('bálint') || allText.includes('balint');
  const hasHordo = allText.includes('hordó') || allText.includes('hordo');
  const hasAbel = allText.includes('ábel') || allText.includes('abel');

  if (hasAbel) {
    const before = currentRotation;
    const after = before + 360;
    document.body.style.transition = 'transform 0.8s cubic-bezier(0.4,0,0.2,1)';
    document.body.style.transformOrigin = 'center center';
    document.body.style.transform = `rotate(${after}deg)`;
    setTimeout(() => {
      document.body.style.transition = 'none';
      document.body.style.transform = `rotate(${before}deg)`;
    }, 850);
    return;
  }

  let target = 0;
  if (hasBalint && hasHordo) target = 270;
  else if (hasBalint) target = 180;
  else if (hasHordo) target = 360;

  currentRotation = target;
  document.body.style.transition = 'transform 0.8s cubic-bezier(0.4,0,0.2,1)';
  document.body.style.transformOrigin = 'center center';
  document.body.style.transform = `rotate(${target}deg)`;
}

export default function Notes({ birthday }: NotesProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [newText, setNewText] = useState('');
  const [colorIndex, setColorIndex] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);

  // Betöltés DB-ből, fallback localStorage-ra
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/notes/${encodeURIComponent(birthday)}`);
        if (res.ok) {
          const data = await res.json();
          setNotes(data);
          localStorage.setItem('quickNotes', JSON.stringify(data));
        } else {
          throw new Error('API error');
        }
      } catch {
        try { setNotes(JSON.parse(localStorage.getItem('quickNotes') || '[]')); } catch {}
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [birthday]);

  useEffect(() => {
    checkEasterEggs(notes);
  }, [notes]);

  const addNote = async () => {
    if (!newText.trim()) return;
    const note: Note = {
      id: Date.now().toString(),
      text: newText.trim(),
      color: COLORS[colorIndex],
      createdAt: new Date().toLocaleDateString('hu-HU'),
    };
    const updated = [note, ...notes];
    setNotes(updated);
    localStorage.setItem('quickNotes', JSON.stringify(updated));
    setNewText('');
    setColorIndex((colorIndex + 1) % COLORS.length);
    try {
      await fetch(`/api/notes/${encodeURIComponent(birthday)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(note),
      });
    } catch {}
  };

  const deleteNote = async (id: string) => {
    const updated = notes.filter(n => n.id !== id);
    setNotes(updated);
    localStorage.setItem('quickNotes', JSON.stringify(updated));
    try {
      await fetch(`/api/notes/${encodeURIComponent(birthday)}/${id}`, { method: 'DELETE' });
    } catch {}
  };

  const displayed = showAll ? notes : notes.slice(0, 3);

  return (
    <Card className="p-6 bg-white dark:bg-gray-800 shadow-lg">
      <div>
        <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-4 uppercase text-center">
          📝 Gyors jegyzetek
        </h2>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addNote()}
            placeholder="Írj egy rövid jegyzetet..."
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <button onClick={addNote} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">+</button>
        </div>

        {loading && <p className="text-center text-gray-400 text-sm">Betöltés...</p>}
        {!loading && notes.length === 0 && (
          <p className="text-center text-gray-400 text-sm">Még nincs jegyzet</p>
        )}

        <div className="space-y-2">
          {displayed.map(note => (
            <div key={note.id} className={`flex items-start justify-between p-3 rounded-lg border ${note.color}`}>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 dark:text-gray-200 break-words">{note.text}</p>
                <p className="text-xs text-gray-400 mt-1">{note.createdAt}</p>
              </div>
              <button onClick={() => deleteNote(note.id)} className="text-gray-400 hover:text-red-500 ml-2 flex-shrink-0">×</button>
            </div>
          ))}
        </div>

        {notes.length > 3 && (
          <button onClick={() => setShowAll(!showAll)} className="w-full mt-2 text-xs text-indigo-500 hover:underline">
            {showAll ? '▲ Kevesebb' : `▼ Összes (${notes.length})`}
          </button>
        )}
      </div>
    </Card>
  );
}
