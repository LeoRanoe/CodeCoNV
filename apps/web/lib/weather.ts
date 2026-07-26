export type ProjectWeatherCondition = "sunny" | "partly_cloudy" | "cloudy" | "rain" | "heavy_rain";
export type ProjectWindCondition = "calm" | "moderate" | "strong";

export type CurrentProjectWeather = {
  condition: ProjectWeatherCondition;
  temperatureC: number;
  apparentTemperatureC: number;
  windCondition: ProjectWindCondition;
  windSpeedKph: number;
  windGustKph: number;
  precipitationMm: number;
  relativeHumidityPercent: number;
  weatherCode: number;
  observedAt: string;
  resolvedLocation: string;
  latitude: number;
  longitude: number;
  source: "Open-Meteo";
};

export function weatherConditionFromWmoCode(code: number, precipitationMm = 0): ProjectWeatherCondition {
  if (code === 0) return "sunny";
  if (code === 1 || code === 2) return "partly_cloudy";
  if (code === 3 || code === 45 || code === 48) return "cloudy";
  if ([65, 67, 82, 95, 96, 99].includes(code) || precipitationMm >= 7.5) return "heavy_rain";
  if ([51, 53, 55, 56, 57, 61, 63, 66, 71, 73, 75, 77, 80, 81, 85, 86].includes(code)) return "rain";
  return precipitationMm > 0 ? "rain" : "cloudy";
}

export function windConditionFromSpeed(speedKph: number, gustKph = speedKph): ProjectWindCondition {
  const governingSpeed = Math.max(speedKph, gustKph * 0.65);
  if (governingSpeed < 15) return "calm";
  if (governingSpeed < 35) return "moderate";
  return "strong";
}

export function weatherSuitableForAnchorWork(
  condition: ProjectWeatherCondition,
  wind: ProjectWindCondition,
) {
  return condition !== "rain" && condition !== "heavy_rain" && wind !== "strong";
}
