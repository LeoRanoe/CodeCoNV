"use client";

import { CloudRain, CloudSun, Cloud, RefreshCw, Sun, Wind } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { useLiveProjectWeather } from "@/lib/weather-client";
import type { ProjectWeatherCondition } from "@/lib/weather";

const conditionIcons: Record<ProjectWeatherCondition, typeof Sun> = {
  sunny: Sun,
  partly_cloudy: CloudSun,
  cloudy: Cloud,
  rain: CloudRain,
  heavy_rain: CloudRain,
};

/**
 * Always-visible live weather for the current project. Site work is weather driven,
 * so this stays on screen in every module rather than only on the overview.
 */
export function LiveWeatherChip({ location }: { location: string }) {
  const { text } = useLanguage();
  const { weather, error, loading, reload } = useLiveProjectWeather(location);
  const Icon = weather ? conditionIcons[weather.condition] ?? CloudSun : CloudSun;
  const conditionLabel = weather
    ? ({
      sunny: text("Clear", "Helder"),
      partly_cloudy: text("Partly cloudy", "Licht bewolkt"),
      cloudy: text("Cloudy", "Bewolkt"),
      rain: text("Rain", "Regen"),
      heavy_rain: text("Heavy rain", "Zware regen"),
    } as Record<ProjectWeatherCondition, string>)[weather.condition]
    : "";
  const windWarning = weather?.windCondition === "strong";
  const rainWarning = weather?.condition === "heavy_rain";

  return (
    <button
      className={`live-weather-chip${windWarning || rainWarning ? " attention" : ""}`}
      type="button"
      onClick={reload}
      title={weather
        ? `${conditionLabel} · ${weather.temperatureC}°C · ${text("feels like", "gevoelstemperatuur")} ${weather.apparentTemperatureC}°C · ${text("wind", "wind")} ${weather.windSpeedKph} km/h · ${text("rain", "regen")} ${weather.precipitationMm} mm · ${weather.resolvedLocation}`
        : error || text("Load live weather", "Laad actueel weer")}
      aria-label={weather
        ? text(`${weather.temperatureC}°C. Live weather: ${conditionLabel}. Refresh.`, `${weather.temperatureC}°C. Actueel weer: ${conditionLabel}. Ververs.`)
        : text("Refresh live weather", "Ververs actueel weer")}
    >
      {loading && !weather ? <RefreshCw className="spin" size={15} /> : <Icon size={15} />}
      {weather
        ? <span>{weather.temperatureC}°C</span>
        : <span>{loading ? text("Loading weather", "Weer laden") : text("Weather unavailable", "Weer niet beschikbaar")}</span>}
      {windWarning ? <Wind size={13} /> : null}
    </button>
  );
}
