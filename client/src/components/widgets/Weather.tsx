import * as React from 'react';
import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/card';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

// Az interface rendben van itt kívül
interface WeatherData {
  temp: number;
  description: string;
  humidity: number;
  windSpeed: number;
  error?: string;
}

export default function Weather() {
  // ✅ JAVÍTVA: a hook-ok és az early return a komponensen BELÜL kell legyenek
  const isOnline = useOnlineStatus();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Ha offline, ne próbáljon lekérni semmit
    if (!isOnline) {
      setLoading(false);
      return;
    }

    const fetchWeather = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/weather');
        if (!response.ok) throw new Error('Failed to fetch weather');
        const data = await response.json();
        setWeather(data);
      } catch (error) {
        console.error('Weather error:', error);
        setWeather({
          temp: 0,
          description: 'Unable to load weather',
          humidity: 0,
          windSpeed: 0,
          error: 'Failed to fetch weather data',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 600000);
    return () => clearInterval(interval);
  }, [isOnline]); // isOnline változásra újra fut

  // ✅ Offline állapot - a hooks-ok után, de a return előtt
  if (!isOnline) {
    return (
      <Card className="p-6 bg-white dark:bg-gray-800 shadow-lg">
        <div className="text-center">
          <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-4 uppercase">
            Időjárás - Budapest
          </h2>
          <div className="text-4xl mb-2">📵</div>
          <p className="text-gray-600 dark:text-gray-400 text-sm">Offline – időjárás nem elérhető</p>
        </div>
      </Card>
    );
  }

  if (loading || !weather) {
    return (
      <Card className="p-6 bg-white dark:bg-gray-800 shadow-lg">
        <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-4 uppercase">
          Időjárás - Budapest
        </h2>
        <p className="text-gray-600 dark:text-gray-400">Betöltés...</p>
      </Card>
    );
  }

  const getWeatherEmoji = (description: string) => {
    const desc = description.toLowerCase();
    if (desc.includes('rain')) return '🌧️';
    if (desc.includes('cloud')) return '☁️';
    if (desc.includes('sunny') || desc.includes('clear')) return '☀️';
    if (desc.includes('snow')) return '❄️';
    if (desc.includes('wind')) return '💨';
    return '🌤️';
  };

  return (
    <Card className="p-6 bg-white dark:bg-gray-800 shadow-lg">
      <div className="text-center">
        <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-4 uppercase">
          Időjárás - Budapest
        </h2>

        {weather.error ? (
          <p className="text-gray-600 dark:text-gray-400 text-sm">{weather.error}</p>
        ) : (
          <div>
            <div className="text-5xl mb-2">{getWeatherEmoji(weather.description)}</div>
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
              {Math.round(weather.temp)}°C
            </div>
            <p className="text-gray-700 dark:text-gray-300 mb-3 capitalize">{weather.description}</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-blue-50 dark:bg-gray-700 rounded p-2">
                <div className="font-bold text-blue-600 dark:text-blue-400">{weather.humidity}%</div>
                <div className="text-gray-600 dark:text-gray-400">Páratartalom</div>
              </div>
              <div className="bg-blue-50 dark:bg-gray-700 rounded p-2">
                <div className="font-bold text-blue-600 dark:text-blue-400">{Math.round(weather.windSpeed)} m/s</div>
                <div className="text-gray-600 dark:text-gray-400">Szél</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
