import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import Clock from '../components/widgets/Clock';
import BirthdayCountdown from '../components/widgets/BirthdayCountdown';
import Weather from '../components/widgets/Weather';
import DailyJoke from '../components/widgets/DailyJoke';
import NameDay from '../components/widgets/NameDay';
import AgeCounter from '../components/widgets/AgeCounter';
import Holidays from '../components/widgets/Holidays';
import CountdownEvent from '../components/widgets/CountdownEvent';
import Notes from '../components/widgets/Notes';
import OnThisDay from '../components/widgets/OnThisDay';
import DailyQuiz from '../components/widgets/DailyQuiz';
import Stopwatch from '../components/widgets/Stopwatch';
import NotificationsWidget from '../components/widgets/NotificationsWidget';
import RemindersWidget from '../components/widgets/RemindersWidget';
import { Button } from '../components/ui/button';
import { subscribeToPush, unsubscribeFromPush } from '../lib/pushHelper';

interface DashboardProps {
  birthday: string;
  onChangeBirthday: (date: string) => void;
}

// 'settings' és 'notifications' eltávolítva a widgetekből — beállítások csak fogaskerékből
const DEFAULT_ORDER = [
  'clock', 'birthday', 'weather', 'nameday', 'age',
  'reminders', 'holidays', 'onthisday', 'quiz',
  'countdown', 'stopwatch', 'notes', 'joke',
];

const WIDGET_LABELS: Record<string, string> = {
  clock: '🕐 Óra', birthday: '🎂 Születésnap számláló', weather: '🌤 Időjárás',
  nameday: '👤 Névnap', age: '🎂 Életkor',
  reminders: '⏰ Emlékeztetők',
  holidays: '🎉 Ünnepek', onthisday: '📰 Ezen a napon', quiz: '🎯 Napi kvíz',
  countdown: '⏰ Időzítő', stopwatch: '⏱️ Stopper', notes: '📝 jegyzetek',
  joke: '😄 Napi vicc',
};

export default function Dashboard({ birthday, onChangeBirthday }: DashboardProps) {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [widgetOrder, setWidgetOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('widgetOrder');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Csak az érvényes widgeteket tartja meg, joke mindig utolsó
        const valid = DEFAULT_ORDER.filter(w => w !== 'joke');
        const filtered = parsed.filter((w: string) => valid.includes(w));
        const missing = valid.filter(w => !filtered.includes(w));
        return [...filtered, ...missing, 'joke'];
      }
    } catch {}
    return DEFAULT_ORDER;
  });

  const [editMode, setEditMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [hidden, setHidden] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('hiddenWidgets') || '[]'); } catch { return []; }
  });

  // Beállítások state
  const [lockRotation, setLockRotation] = useState(false);
  const [disableEasterEggs, setDisableEasterEggs] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [bSettings, setBSettings] = useState({
    enabled: false, oneWeekBefore: false, threeDaysBefore: false, oneDayBefore: false, onBirthdayDay: false,
  });
  const [nameDayAlerts, setNameDayAlerts] = useState(false);
  const [nameDayDays, setNameDayDays] = useState<number[]>([0, 1, 3, 7]);
  const [settingsExpanded, setSettingsExpanded] = useState(false);

  // Pull to refresh
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const pulling = useRef(false);
  const THRESHOLD = 80;
  const dragItem = useRef<string | null>(null);
  const dragOver = useRef<string | null>(null);

  // Scroll pozíció a modal-hoz
  const [scrollY, setScrollY] = useState(0);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement;
    if (meta) meta.content = isDark ? '#111827' : '#eef2ff';
  }, [isDark]);

  useEffect(() => {
    document.body.style.overscrollBehaviorY = 'contain';
    return () => { document.body.style.overscrollBehaviorY = ''; };
  }, []);

  // Beállítások betöltése
  useEffect(() => {
    if ('Notification' in window) setPermission(Notification.permission);
    navigator.serviceWorker?.ready.then(reg =>
      reg.pushManager.getSubscription().then(sub => setPushEnabled(!!sub))
    );
    const saved = localStorage.getItem('notificationSettings');
    if (saved) {
      const s = JSON.parse(saved);
      setBSettings(s.birthday || bSettings);
      setNameDayAlerts(s.nameDayAlerts || false);
      setNameDayDays(s.nameDayAlertDays || [0, 1, 3, 7]);
    }
    const loadAppSettings = async () => {
      try {
        const res = await fetch(`/api/app-settings/${encodeURIComponent(birthday)}`);
        if (res.ok) {
          const data = await res.json();
          setLockRotation(data.lockRotation ?? false);
          setDisableEasterEggs(data.disableEasterEggs ?? false);
        }
      } catch {
        setLockRotation(localStorage.getItem('lockRotation') === 'true');
        setDisableEasterEggs(localStorage.getItem('disableEasterEggs') === 'true');
      }
    };
    loadAppSettings();
  }, [birthday]);

  const saveNotifSettings = (updates: any) => {
    const current = JSON.parse(localStorage.getItem('notificationSettings') || '{}');
    localStorage.setItem('notificationSettings', JSON.stringify({ ...current, ...updates }));
  };

  const saveAppSettings = async (lr: boolean, dee: boolean) => {
    localStorage.setItem('lockRotation', String(lr));
    localStorage.setItem('disableEasterEggs', String(dee));
    try {
      await fetch(`/api/app-settings/${encodeURIComponent(birthday)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lockRotation: lr, disableEasterEggs: dee }),
      });
    } catch {}
  };

  const handleEnablePush = async () => {
    setPushLoading(true);
    if (pushEnabled) {
      await unsubscribeFromPush();
      setPushEnabled(false);
    } else {
      const sub = await subscribeToPush();
      setPushEnabled(!!sub);
      if (sub && 'Notification' in window) setPermission(Notification.permission);
    }
    setPushLoading(false);
  };

  const toggleB = (key: string) => {
    const updated = { ...bSettings, [key]: !bSettings[key as keyof typeof bSettings] };
    setBSettings(updated);
    saveNotifSettings({ birthday: updated });
  };

  const toggleNameDayDay = (d: number) => {
    const updated = nameDayDays.includes(d) ? nameDayDays.filter(x => x !== d) : [...nameDayDays, d];
    setNameDayDays(updated);
    saveNotifSettings({ nameDayAlertDays: updated });
  };

  const handleLockRotation = (val: boolean) => {
    setLockRotation(val);
    saveAppSettings(val, disableEasterEggs);
    if (val) { try { (screen.orientation as any)?.lock?.('portrait'); } catch {} }
    else { try { (screen.orientation as any)?.unlock?.(); } catch {} }
  };

  const handleDisableEasterEggs = (val: boolean) => {
    setDisableEasterEggs(val);
    saveAppSettings(lockRotation, val);
    if (val) {
      document.body.style.transition = 'transform 0.5s ease';
      document.body.style.transform = 'rotate(0deg)';
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) { touchStartY.current = e.touches[0].clientY; pulling.current = true; }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!pulling.current || isRefreshing) return;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (dy > 0 && window.scrollY === 0) { e.preventDefault(); setPullDistance(Math.min(dy * 0.5, THRESHOLD + 20)); }
  };
  const onTouchEnd = () => {
    if (!pulling.current) return;
    pulling.current = false;
    if (pullDistance >= THRESHOLD) { setIsRefreshing(true); setPullDistance(THRESHOLD); setTimeout(() => window.location.reload(), 1000); }
    else setPullDistance(0);
  };

  const toggleDark = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    localStorage.setItem('theme', newDark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', newDark);
  };

  const handleChangeBirthday = () => {
    localStorage.removeItem('userBirthday');
    onChangeBirthday('');
  };

  const saveOrder = (order: string[]) => { setWidgetOrder(order); localStorage.setItem('widgetOrder', JSON.stringify(order)); };
  const saveHidden = (h: string[]) => { setHidden(h); localStorage.setItem('hiddenWidgets', JSON.stringify(h)); };

  const handleDragStart = (id: string) => { dragItem.current = id; };
  const handleDragEnter = (id: string) => { dragOver.current = id; };
  const handleDragEnd = () => {
    if (!dragItem.current || !dragOver.current || dragItem.current === dragOver.current) return;
    const newOrder = [...widgetOrder];
    const fromIdx = newOrder.indexOf(dragItem.current);
    const toIdx = newOrder.indexOf(dragOver.current);
    // joke nem mozdítható
    if (dragItem.current === 'joke' || dragOver.current === 'joke') return;
    newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, dragItem.current);
    saveOrder(newOrder);
    dragItem.current = null;
    dragOver.current = null;
  };

  // Joke mindig utolsó, hidden-tól függetlenül a sorrend végén
  const orderedWidgets = [
    ...widgetOrder.filter(id => id !== 'joke'),
    'joke',
  ];

  const renderWidget = (id: string) => {
    const wrap = (el: React.ReactNode) => <div className="flex flex-col h-full">{el}</div>;
    switch (id) {
      case 'clock': return wrap(<Clock />);
      case 'birthday': return wrap(<BirthdayCountdown birthday={birthday} />);
      case 'weather': return wrap(<Weather />);
      case 'nameday': return wrap(<NameDay birthday={birthday} />);
      case 'age': return wrap(<AgeCounter birthday={birthday} />);
      case 'reminders': return wrap(<RemindersWidget birthday={birthday} />);
      case 'holidays': return wrap(<Holidays />);
      case 'onthisday': return wrap(<OnThisDay />);
      case 'quiz': return wrap(<DailyQuiz />);
      case 'countdown': return wrap(<CountdownEvent birthday={birthday} />);
      case 'stopwatch': return wrap(<Stopwatch />);
      case 'notes': return wrap(<Notes birthday={birthday} />);
      case 'joke': return <div className="col-span-1 md:col-span-2 lg:col-span-3"><DailyJoke /></div>;
      default: return null;
    }
  };

  const pullProgress = Math.min(pullDistance / THRESHOLD, 1);

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <button onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${value ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );

  return (
    <>
      {/* Pull-to-refresh indicator */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center pointer-events-none overflow-hidden"
        style={{ height: pullDistance > 0 || isRefreshing ? Math.max(pullDistance, isRefreshing ? 60 : 0) : 0 }}>
        <div style={{
          fontSize: 32 + pullProgress * 16, opacity: pullProgress,
          transform: isRefreshing ? undefined : `rotate(${pullProgress * 360}deg)`,
          animation: isRefreshing ? 'spin 0.6s linear infinite' : 'none',
        }}>
          {pullDistance > 30 ? '🎂' : '↓'}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .widget-stretch > * { height: 100%; }
        .widget-stretch .flex.flex-col.h-full > * { height: 100%; }
      `}</style>

      <div
        className="min-h-screen p-4 pt-safe transition-colors duration-300"
        style={{
          background: isDark ? 'linear-gradient(135deg, #111827 0%, #1f2937 100%)' : 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
          transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
          transition: pulling.current ? 'none' : 'transform 0.3s ease',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Születésnapi Számláló</h1>
              <div className="flex items-center gap-2">
                <button onClick={() => setEditMode(!editMode)}
                  className={`p-2 rounded-full border text-lg hover:scale-110 transition-all flex-shrink-0 ${editMode ? 'border-indigo-500 bg-indigo-100 dark:bg-indigo-900/40' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'}`}>
                  ✏️
                </button>
                {/* Fogaskerék — beállítások */}
                <button
                  ref={settingsBtnRef}
                  onClick={() => { setScrollY(window.scrollY); setShowSettings(true); }}
                  className="p-2 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xl hover:scale-110 transition-transform flex-shrink-0">
                  ⚙️
                </button>
                <button onClick={toggleDark}
                  className="p-2 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xl hover:scale-110 transition-transform flex-shrink-0">
                  {isDark ? '☀️' : '🌙'}
                </button>
                <button onClick={() => { setScrollY(window.scrollY); setShowInfo(true); }}
                  className="p-2 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xl hover:scale-110 transition-transform flex-shrink-0">
                  ℹ️
                </button>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={handleChangeBirthday} variant="outline" className="text-sm">
                Születésnap Módosítása
              </Button>
            </div>
          </div>

          {/* Edit mode */}
          {editMode && (
            <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-indigo-200 dark:border-indigo-800">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Widget sorrend — húzd át, kapcsold ki/be (a vicc mindig legalul)</p>
              <div className="space-y-2">
                {orderedWidgets.map((id) => (
                  <div key={id} draggable={id !== 'joke'}
                    onDragStart={() => handleDragStart(id)}
                    onDragEnter={() => handleDragEnter(id)}
                    onDragEnd={handleDragEnd}
                    onDragOver={e => e.preventDefault()}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-colors
                      ${id === 'joke' ? 'opacity-50 cursor-not-allowed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30' :
                        hidden.includes(id) ? 'bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-700 opacity-50 cursor-grab' :
                        'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 cursor-grab'}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">{id === 'joke' ? '🔒' : '☰'}</span>
                      <span className="text-sm text-gray-700 dark:text-gray-300">{WIDGET_LABELS[id]}</span>
                    </div>
                    {id !== 'joke' && (
                      <button onClick={() => saveHidden(hidden.includes(id) ? hidden.filter(h => h !== id) : [...hidden, id])}
                        className={`text-xs px-2 py-1 rounded-full ${hidden.includes(id) ? 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400' : 'bg-indigo-200 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-300'}`}>
                        {hidden.includes(id) ? 'Elrejtve' : 'Látható'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={() => { saveOrder(DEFAULT_ORDER); saveHidden([]); }}
                className="mt-3 text-xs text-gray-400 hover:text-gray-600 underline">
                Visszaállítás alapértelmezettre
              </button>
            </div>
          )}

          {/* Widgets — joke mindig legalul */}
          <div className="widget-stretch grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch auto-rows-fr">
            {orderedWidgets.filter(id => !hidden.includes(id)).map(id => (
              <React.Fragment key={id}>{renderWidget(id)}</React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* ⚙️ Beállítások modal — scroll pozícióhoz igazítva */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-8"
          style={{ paddingTop: Math.max(scrollY + 32, 32) }}
          onClick={() => setShowSettings(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm mx-4 shadow-2xl"
            onClick={e => e.stopPropagation()}>

            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">⚙️ Beállítások</h2>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">

              {/* Push értesítések */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">🔔 Push értesítések</p>
                  <button onClick={handleEnablePush} disabled={pushLoading || permission === 'denied'}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${pushEnabled ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-indigo-600 text-white hover:bg-indigo-700'} disabled:opacity-50`}>
                    {pushLoading ? '...' : pushEnabled ? '✅ Bekapcsolva' : 'Bekapcsolás'}
                  </button>
                </div>
                {permission === 'denied' && <p className="text-xs text-red-500 mb-2">❌ Letiltva a böngészőben</p>}

                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <span className="text-xs text-gray-700 dark:text-gray-300">🎂 Születésnapi értesítők</span>
                    <Toggle value={bSettings.enabled} onChange={() => toggleB('enabled')} />
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <span className="text-xs text-gray-700 dark:text-gray-300">👤 Névnap értesítők</span>
                    <Toggle value={nameDayAlerts} onChange={v => { setNameDayAlerts(v); saveNotifSettings({ nameDayAlerts: v }); }} />
                  </div>
                </div>

                <button onClick={() => setSettingsExpanded(!settingsExpanded)}
                  className="w-full text-xs text-indigo-500 hover:underline text-center mt-2">
                  {settingsExpanded ? '▲ Kevesebb' : '▼ Részletes beállítások'}
                </button>

                {settingsExpanded && (
                  <div className="mt-3 space-y-4">
                    {bSettings.enabled && (
                      <div className="space-y-2">
                        <p className="text-xs text-gray-400 uppercase font-semibold">Születésnap emlékeztetők</p>
                        {[
                          { key: 'oneWeekBefore', label: '1 héttel előbb' },
                          { key: 'threeDaysBefore', label: '3 nappal előbb' },
                          { key: 'oneDayBefore', label: '1 nappal előbb' },
                          { key: 'onBirthdayDay', label: 'A születésnapomon 🎉' },
                        ].map(({ key, label }) => (
                          <div key={key} className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                            <span className="text-xs text-gray-700 dark:text-gray-300">{label}</span>
                            <Toggle value={bSettings[key as keyof typeof bSettings] as boolean} onChange={() => toggleB(key)} />
                          </div>
                        ))}
                      </div>
                    )}
                    {nameDayAlerts && (
                      <div>
                        <p className="text-xs text-gray-400 uppercase font-semibold mb-2">Névnap emlékeztetők</p>
                        <div className="flex flex-wrap gap-2">
                          {[{ d: 0, label: 'Aznap' }, { d: 1, label: '1 nap' }, { d: 3, label: '3 nap' }, { d: 7, label: '1 hét' }].map(({ d, label }) => (
                            <button key={d} onClick={() => toggleNameDayDay(d)}
                              className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${nameDayDays.includes(d) ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <hr className="border-gray-100 dark:border-gray-700" />

              {/* App beállítások */}
              <div>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">📱 App beállítások</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">🔒 Képernyő elforgatás tiltása</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Portré módban tartja az appot</p>
                    </div>
                    <Toggle value={lockRotation} onChange={handleLockRotation} />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">🥚 Easter egg-ek kikapcsolása</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Bálint/derék nem forgatja az oldalt</p>
                    </div>
                    <Toggle value={disableEasterEggs} onChange={handleDisableEasterEggs} />
                  </div>
                </div>
              </div>

              <hr className="border-gray-100 dark:border-gray-700" />

              {/* Születésnap módosítás */}
              <button onClick={() => { setShowSettings(false); handleChangeBirthday(); }}
                className="w-full py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                🎂 Születésnap Módosítása
              </button>

              {/* Az appról gomb */}
              <button onClick={() => { setShowSettings(false); setTimeout(() => { setScrollY(window.scrollY); setShowInfo(true); }, 100); }}
                className="w-full py-2.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl text-sm hover:bg-indigo-100 transition-colors">
                ℹ️ Az appról
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ℹ️ Info modal — scroll pozícióhoz igazítva */}
      {showInfo && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-8"
          style={{ paddingTop: Math.max(scrollY + 32, 32) }}
          onClick={() => setShowInfo(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 w-80 shadow-2xl text-center mx-4"
            onClick={e => e.stopPropagation()}>
            <div className="text-5xl mb-4">🎂</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Birthday Buddy</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">v2.0</p>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 mb-3">
              <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Készítette</p>
              <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">Buday Bálint</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3 mb-3">
              <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Youtube</p>
              <a href="https://www.youtube.com/@BálintKalandjai" target="_blank" rel="noopener noreferrer"
                className="text-sm font-bold text-indigo-600 dark:text-indigo-400">Bálint Kalandjai</a>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3 mb-4">
              <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Weboldal</p>
              <a href="https://balint12.hu" target="_blank" rel="noopener noreferrer"
                className="text-sm font-bold text-indigo-600 dark:text-indigo-400">balint12.hu</a>
            </div>
            <div className="text-xs text-gray-400 space-y-1 mb-5">
              <p>React + TypeScript + Tailwind</p>
              <p>Express + PostgreSQL · Railway 🚀</p>
            </div>
            <button onClick={() => setShowInfo(false)}
              className="w-full py-2 bg-indigo-600 text-white rounded-xl text-sm hover:bg-indigo-700">
              Bezárás
            </button>
          </div>
        </div>
      )}
    </>
  );
}