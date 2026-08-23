import { useState, useEffect, useRef } from 'react';
import * as React from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { subscribeToPush, unsubscribeFromPush, syncSettingsToServer, loadSettingsFromServer } from '../lib/pushHelper';

interface NotificationSettingsProps {
  birthday: string;
}

interface Reminder {
  id: string;
  name: string;
  type: 'once' | 'recurring';
  hour: string;
  minute: string;
  date?: string;
  days?: number[];
  weeks?: number;
  startDate?: string;
  active: boolean;
}

const DAY_NAMES = ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo'];

export default function NotificationSettings({ birthday }: NotificationSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<'birthday' | 'nameday' | 'reminders'>('birthday');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const syncTimeout = useRef<any>(null);

  const [bSettings, setBSettings] = useState({
    enabled: false, oneWeekBefore: false, threeDaysBefore: false, oneDayBefore: false, onBirthdayDay: false,
  });
  const [nameDayAlerts, setNameDayAlerts] = useState(false);
  const [nameDayDays, setNameDayDays] = useState<number[]>([0, 1, 3, 7]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [newReminder, setNewReminder] = useState<Partial<Reminder>>({
    name: '', type: 'once', hour: '08', minute: '00', date: '', days: [], weeks: 1,
    startDate: new Date().toISOString().split('T')[0], active: true,
  });

  // Load settings — server first, localStorage fallback
  useEffect(() => {
    if ('Notification' in window) setPermission(Notification.permission);
    navigator.serviceWorker?.ready.then(reg =>
      reg.pushManager.getSubscription().then(sub => setPushEnabled(!!sub))
    );

    const loadSettings = async () => {
      setSyncing(true);
      try {
        const serverData = await loadSettingsFromServer(birthday);
        if (serverData && (serverData.savedNames?.length > 0 || serverData.reminders?.length > 0 || Object.keys(serverData.notificationSettings || {}).length > 0)) {
          // Server has data — use it and update localStorage
          const s = serverData.notificationSettings || {};
          setBSettings(s.birthday || bSettings);
          setNameDayAlerts(s.nameDayAlerts || false);
          setNameDayDays(s.nameDayAlertDays || [0, 1, 3, 7]);
          setReminders(serverData.reminders || []);
          localStorage.setItem('savedNameDays', JSON.stringify(serverData.savedNames || []));
          localStorage.setItem('customReminders', JSON.stringify(serverData.reminders || []));
          localStorage.setItem('notificationSettings', JSON.stringify(s));
          setLastSync(new Date().toLocaleTimeString('hu-HU'));
        } else {
          // No server data — load from localStorage
          const saved = localStorage.getItem('notificationSettings');
          if (saved) {
            const s = JSON.parse(saved);
            setBSettings(s.birthday || bSettings);
            setNameDayAlerts(s.nameDayAlerts || false);
            setNameDayDays(s.nameDayAlertDays || [0, 1, 3, 7]);
          }
          setReminders(JSON.parse(localStorage.getItem('customReminders') || '[]'));
        }
      } catch (e) {
        const saved = localStorage.getItem('notificationSettings');
        if (saved) {
          const s = JSON.parse(saved);
          setBSettings(s.birthday || bSettings);
          setNameDayAlerts(s.nameDayAlerts || false);
          setNameDayDays(s.nameDayAlertDays || [0, 1, 3, 7]);
        }
        setReminders(JSON.parse(localStorage.getItem('customReminders') || '[]'));
      } finally {
        setSyncing(false);
      }
    };

    loadSettings();
  }, [birthday]);

  // Reminder checker
  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const nowH = now.getHours();
      const nowM = now.getMinutes();
      const currentReminders: Reminder[] = JSON.parse(localStorage.getItem('customReminders') || '[]');

      for (const r of currentReminders) {
        if (!r.active) continue;
        if (parseInt(r.hour || '8') !== nowH || parseInt(r.minute || '0') !== nowM) continue;

        const notifKey = `reminder_fired_${r.id}_${todayStr}_${nowH}_${nowM}`;
        if (localStorage.getItem(notifKey)) continue;

        let shouldFire = false;
        if (r.type === 'once') {
          shouldFire = r.date === todayStr;
        } else {
          const dayOfWeek = now.getDay();
          if ((r.days || []).includes(dayOfWeek)) {
            const start = new Date(r.startDate || todayStr);
            const end = new Date(start);
            end.setDate(end.getDate() + (r.weeks || 1) * 7);
            shouldFire = now >= start && now <= end;
          }
        }

        if (shouldFire) {
          fetch('/api/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: `⏰ ${r.name}`, body: r.type === 'recurring' ? 'Ismétlődő emlékeztető!' : 'Emlékeztető!', tag: `reminder-${r.id}` }),
          }).catch(() => {
            if (Notification.permission === 'granted') {
              new Notification(`⏰ ${r.name}`, { body: 'Emlékeztető!', icon: '/icon-192.png' });
            }
          });
          localStorage.setItem(notifKey, '1');
        }
      }
    };

    const interval = setInterval(checkReminders, 30000);
    checkReminders();
    return () => clearInterval(interval);
  }, []);

  // Debounced sync to server
  const syncToServer = (data: { bSettings?: any; nameDayAlerts?: boolean; nameDayDays?: number[]; reminders?: Reminder[] }) => {
    if (syncTimeout.current) clearTimeout(syncTimeout.current);
    syncTimeout.current = setTimeout(async () => {
      const currentSettings = JSON.parse(localStorage.getItem('notificationSettings') || '{}');
      const savedNames = JSON.parse(localStorage.getItem('savedNameDays') || '[]');
      const currentReminders = JSON.parse(localStorage.getItem('customReminders') || '[]');
      setSyncing(true);
      await syncSettingsToServer(birthday, {
        savedNames,
        reminders: data.reminders ?? currentReminders,
        notificationSettings: currentSettings,
      });
      setLastSync(new Date().toLocaleTimeString('hu-HU'));
      setSyncing(false);
    }, 1000);
  };

  const saveSettings = (updates: any) => {
    const current = JSON.parse(localStorage.getItem('notificationSettings') || '{}');
    const merged = { ...current, ...updates };
    localStorage.setItem('notificationSettings', JSON.stringify(merged));
    syncToServer({});
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

  const toggleBSetting = (key: string) => {
    const updated = { ...bSettings, [key]: !bSettings[key as keyof typeof bSettings] };
    setBSettings(updated);
    saveSettings({ birthday: updated, enabled: updated.enabled });
  };

  const toggleNameDayDay = (d: number) => {
    const updated = nameDayDays.includes(d) ? nameDayDays.filter(x => x !== d) : [...nameDayDays, d];
    setNameDayDays(updated);
    saveSettings({ nameDayAlertDays: updated });
  };

  const saveReminder = () => {
    if (!newReminder.name?.trim()) return;
    const reminder: Reminder = {
      id: Date.now().toString(),
      name: newReminder.name!,
      type: newReminder.type!,
      hour: newReminder.hour!,
      minute: newReminder.minute || '00',
      date: newReminder.date,
      days: newReminder.days,
      weeks: newReminder.weeks,
      startDate: newReminder.startDate,
      active: true,
    };
    const updated = [...reminders, reminder];
    setReminders(updated);
    localStorage.setItem('customReminders', JSON.stringify(updated));
    syncToServer({ reminders: updated });
    setShowReminderForm(false);
    setNewReminder({ name: '', type: 'once', hour: '08', minute: '00', date: '', days: [], weeks: 1, startDate: new Date().toISOString().split('T')[0], active: true });
  };

  const deleteReminder = (id: string) => {
    const updated = reminders.filter(r => r.id !== id);
    setReminders(updated);
    localStorage.setItem('customReminders', JSON.stringify(updated));
    syncToServer({ reminders: updated });
  };

  const toggleReminderActive = (id: string) => {
    const updated = reminders.map(r => r.id === id ? { ...r, active: !r.active } : r);
    setReminders(updated);
    localStorage.setItem('customReminders', JSON.stringify(updated));
    syncToServer({ reminders: updated });
  };

  const toggleDay = (d: number) => {
    const days = newReminder.days || [];
    setNewReminder({ ...newReminder, days: days.includes(d) ? days.filter(x => x !== d) : [...days, d] });
  };

  const timeInput = (
    <div>
      <label className="text-xs text-gray-500 dark:text-gray-400">Időpont</label>
      <input
        type="time"
        value={`${(newReminder.hour||'08').padStart(2,'0')}:${(newReminder.minute||'00').padStart(2,'0')}`}
        onChange={e => {
          const [h, m] = e.target.value.split(':');
          setNewReminder({ ...newReminder, hour: h, minute: m });
        }}
        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white mt-1"
      />
    </div>
  );

  return (
    <div className="relative">
      <Button onClick={() => setIsOpen(!isOpen)} variant="outline" className="text-sm">
        🔔 Értesítések
      </Button>

      {isOpen && <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />}

      {isOpen && (
        <div className="fixed inset-x-0 bottom-0 z-50 md:absolute md:inset-auto md:right-0 md:top-full md:bottom-auto md:mt-2">
          <Card className="w-full md:w-96 bg-white dark:bg-gray-800 shadow-2xl overflow-hidden rounded-t-2xl md:rounded-xl">

            <div className="md:hidden flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
            </div>

            {/* Sync status */}
            <div className="px-4 pt-3 pb-1 flex items-center gap-2">
              {syncing ? (
                <span className="text-xs text-blue-500">🔄 Szinkronizálás...</span>
              ) : lastSync ? (
                <span className="text-xs text-green-500">✅ Szinkronizálva {lastSync}</span>
              ) : (
                <span className="text-xs text-gray-400">☁️ Több eszközön szinkronizált</span>
              )}
            </div>

            {/* Push header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">Push értesítések</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {pushEnabled ? '✅ Engedélyezve' : permission === 'denied' ? '❌ Letiltva a böngészőben' : 'Háttérben is működik'}
                  </p>
                </div>
                <button
                  onClick={handleEnablePush}
                  disabled={pushLoading || permission === 'denied'}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${pushEnabled ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400' : 'bg-indigo-600 text-white hover:bg-indigo-700'} disabled:opacity-50`}
                >
                  {pushLoading ? '...' : pushEnabled ? 'Kikapcsolás' : 'Bekapcsolás'}
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              {(['birthday', 'nameday', 'reminders'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`flex-1 py-2 text-xs font-medium transition-colors ${tab === t ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 dark:text-gray-400'}`}>
                  {t === 'birthday' ? '🎂 Születésnap' : t === 'nameday' ? '👤 Névnap' : '⏰ Emlékeztetők'}
                </button>
              ))}
            </div>

            <div className="p-4 max-h-[60vh] overflow-y-auto">

              {tab === 'birthday' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                    <Label className="text-sm">Értesítések be</Label>
                    <Switch checked={bSettings.enabled} onCheckedChange={() => toggleBSetting('enabled')} />
                  </div>
                  {bSettings.enabled && [
                    { key: 'oneWeekBefore', label: '1 héttel előbb' },
                    { key: 'threeDaysBefore', label: '3 nappal előbb' },
                    { key: 'oneDayBefore', label: '1 nappal előbb' },
                    { key: 'onBirthdayDay', label: 'A születésnapomon 🎉' },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                      <Label className="text-sm">{label}</Label>
                      <Switch checked={bSettings[key as keyof typeof bSettings] as boolean} onCheckedChange={() => toggleBSetting(key)} />
                    </div>
                  ))}
                </div>
              )}

              {tab === 'nameday' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                    <Label className="text-sm">Névnap értesítők be</Label>
                    <Switch checked={nameDayAlerts} onCheckedChange={v => { setNameDayAlerts(v); saveSettings({ nameDayAlerts: v }); }} />
                  </div>
                  {nameDayAlerts && (
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Emlékeztess ennyivel előbb:</p>
                      <div className="flex flex-wrap gap-2">
                        {[{ d: 0, label: 'Aznap' }, { d: 1, label: '1 nap' }, { d: 3, label: '3 nap' }, { d: 7, label: '1 hét' }].map(({ d, label }) => (
                          <button key={d} onClick={() => toggleNameDayDay(d)}
                            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${nameDayDays.includes(d) ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                            {label}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-gray-400 mt-3">A névnapokat a Névnap widgetben kezelheted.</p>
                    </div>
                  )}
                </div>
              )}

              {tab === 'reminders' && (
                <div className="space-y-3">
                  {reminders.map(r => (
                    <div key={r.id} className={`p-3 rounded-lg border ${r.active ? 'border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 opacity-60'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{r.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {r.type === 'once'
                              ? `📅 ${r.date} — ${(r.hour||'00').padStart(2,'0')}:${(r.minute||'00').padStart(2,'0')}`
                              : `🔁 ${(r.days||[]).map(d => DAY_NAMES[d]).join(', ')} — ${(r.hour||'00').padStart(2,'0')}:${(r.minute||'00').padStart(2,'0')} — ${r.weeks} hét`
                            }
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Switch checked={r.active} onCheckedChange={() => toggleReminderActive(r.id)} />
                          <button onClick={() => deleteReminder(r.id)} className="text-red-400 hover:text-red-600 ml-1 text-lg">×</button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {!showReminderForm ? (
                    <button onClick={() => setShowReminderForm(true)}
                      className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors">
                      + Új emlékeztető
                    </button>
                  ) : (
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-3">
                      <input type="text" placeholder="Emlékeztető neve" value={newReminder.name}
                        onChange={e => setNewReminder({ ...newReminder, name: e.target.value })}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />

                      <div className="flex gap-2">
                        {(['once', 'recurring'] as const).map(t => (
                          <button key={t} onClick={() => setNewReminder({ ...newReminder, type: t })}
                            className={`flex-1 py-1.5 rounded-lg text-sm transition-colors ${newReminder.type === t ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                            {t === 'once' ? 'Egyszeri' : 'Ismétlődő'}
                          </button>
                        ))}
                      </div>

                      {newReminder.type === 'once' ? (
                        <div className="space-y-2">
                          <div>
                            <label className="text-xs text-gray-500 dark:text-gray-400">Dátum</label>
                            <input type="date" value={newReminder.date}
                              onChange={e => setNewReminder({ ...newReminder, date: e.target.value })}
                              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white mt-1" />
                          </div>
                          {timeInput}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div>
                            <label className="text-xs text-gray-500 dark:text-gray-400">Napok</label>
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {DAY_NAMES.map((n, i) => (
                                <button key={i} onClick={() => toggleDay(i)}
                                  className={`w-9 h-9 rounded-full text-xs font-medium transition-colors ${(newReminder.days||[]).includes(i) ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                                  {n}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 dark:text-gray-400">Hány héten át</label>
                            <input type="number" min="1" max="52" value={newReminder.weeks}
                              onChange={e => setNewReminder({ ...newReminder, weeks: parseInt(e.target.value) })}
                              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white mt-1" />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 dark:text-gray-400">Kezdő dátum</label>
                            <input type="date" value={newReminder.startDate}
                              onChange={e => setNewReminder({ ...newReminder, startDate: e.target.value })}
                              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white mt-1" />
                          </div>
                          {timeInput}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button onClick={saveReminder} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">Mentés</button>
                        <button onClick={() => setShowReminderForm(false)} className="flex-1 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm">Mégse</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}