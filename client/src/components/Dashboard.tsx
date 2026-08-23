import * as React from 'react';
import { Button } from './ui/button';
import AgeCounter from './widgets/AgeCounter';
import BirthdayCountdown from './widgets/BirthdayCountdown';
import Clock from './widgets/Clock';
import CountdownEvent from './widgets/CountdownEvent';
import DailyJoke from './widgets/DailyJoke';
import DailyQuiz from './widgets/DailyQuiz';
import Holidays from './widgets/Holidays';
import NameDay from './widgets/NameDay';
import Notes from './widgets/Notes';
import OnThisDay from './widgets/OnThisDay';
import RemindersWidget from './widgets/RemindersWidget';
import Stopwatch from './widgets/Stopwatch';
import Weather from './widgets/Weather';

interface DashboardProps {
  birthday: string;
  onChangeBirthday: (date: string) => void;
}

export default function Dashboard({ birthday, onChangeBirthday }: DashboardProps) {
  const handleReset = () => {
    const confirmed = window.confirm('Biztosan meg akarod változtatni a születésnapodat?');
    if (!confirmed) return;
    const newDate = window.prompt('Add meg az új születésnapodat (ÉÉÉÉ-HH-NN):', birthday);
    if (newDate) onChangeBirthday(newDate);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            🎂 Születésnapi Számláló
          </h1>
          <Button variant="outline" onClick={handleReset}>
            Születésnap módosítása
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <BirthdayCountdown birthday={birthday} />
          <AgeCounter birthday={birthday} />
          <Clock />
          <NameDay birthday={birthday} />
          <Weather />
          <Holidays />
          <OnThisDay />
          <DailyJoke />
          <DailyQuiz />
          <CountdownEvent birthday={birthday} />
          <RemindersWidget birthday={birthday} />
          <Stopwatch />
          <Notes birthday={birthday} />
        </div>
      </div>
    </div>
  );
}
