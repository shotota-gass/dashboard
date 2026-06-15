"use client";

import { useEffect, useState } from "react";
import { Cloud, Sun, CloudRain, CloudSnow, CloudLightning, Wind, Droplets } from "lucide-react";
import { ROLE_LABELS } from "@/lib/constants";

interface WeatherData {
  temp: number;
  weatherCode: number;
  humidity: number;
  windSpeed: number;
}

function getWeatherIcon(code: number) {
  if (code === 0) return <Sun size={14} className="text-gray-600" />;
  if (code <= 3) return <Cloud size={14} className="text-gray-500" />;
  if (code <= 67) return <CloudRain size={14} className="text-gray-500" />;
  if (code <= 77) return <CloudSnow size={14} className="text-gray-400" />;
  if (code <= 82) return <CloudRain size={14} className="text-gray-600" />;
  return <CloudLightning size={14} className="text-gray-600" />;
}

function getWeatherLabel(code: number) {
  if (code === 0) return "Clear";
  if (code <= 3) return "Cloudy";
  if (code <= 55) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  return "Thunderstorm";
}

interface TopBarProps {
  userId: string;
  role: string;
}

export default function TopBar({ userId, role }: TopBarProps) {
  const [time, setTime] = useState(new Date());
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherError, setWeatherError] = useState(false);

  useEffect(() => {
    const tick = setInterval(() => setTime(new Date()), 60_000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setWeatherError(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&wind_speed_unit=kmh&timezone=auto`
          );
          const json = await res.json();
          const c = json.current;
          setWeather({
            temp: Math.round(c.temperature_2m),
            weatherCode: c.weather_code,
            humidity: c.relative_humidity_2m,
            windSpeed: Math.round(c.wind_speed_10m),
          });
        } catch {
          setWeatherError(true);
        }
      },
      () => setWeatherError(true),
      { timeout: 8000 }
    );
  }, []);

  const roleLabel = (ROLE_LABELS as Record<string, string>)[role] ?? role;
  const timeStr = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateStr = time.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

  return (
    <div className="flex items-center gap-5">
      {/* Weather */}
      {weather && (
        <div className="hidden sm:flex items-center gap-2 text-gray-600 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5">
          {getWeatherIcon(weather.weatherCode)}
          <span className="text-sm font-medium">{weather.temp}°C</span>
          <span className="text-xs text-gray-400">{getWeatherLabel(weather.weatherCode)}</span>
          <span className="text-gray-200 text-xs">|</span>
          <Droplets size={11} className="text-gray-400" />
          <span className="text-xs text-gray-400">{weather.humidity}%</span>
          <Wind size={11} className="text-gray-400" />
          <span className="text-xs text-gray-400">{weather.windSpeed} km/h</span>
        </div>
      )}
      {!weather && !weatherError && (
        <div className="hidden sm:block h-7 w-40 bg-gray-100 animate-pulse rounded-xl" />
      )}

      {/* Time */}
      <div className="hidden sm:flex flex-col items-end">
        <span className="text-sm font-semibold text-gray-800 tabular-nums">{timeStr}</span>
        <span className="text-xs text-gray-400">{dateStr}</span>
      </div>

      {/* Divider */}
      <div className="hidden sm:block h-7 w-px bg-gray-200" />

      {/* User */}
      <div className="text-right">
        <p className="text-sm font-medium text-gray-800">{userId}</p>
        <p className="text-xs text-gray-500">{roleLabel}</p>
      </div>
    </div>
  );
}
