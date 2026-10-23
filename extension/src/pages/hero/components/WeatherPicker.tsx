import {
  WEATHER_TYPES,
  type WeatherType,
} from "../systems/weather";

interface WeatherPickerProps {
  weather: WeatherType;
  automatic: boolean;
  onSelect: (weather: WeatherType) => void;
  onRandomize: () => void;
}

export const WeatherPicker = ({
  weather,
  automatic,
  onSelect,
  onRandomize,
}: WeatherPickerProps) => (
  <div className="hero-page__weather-picker">
    <label className="hero-page__weather-control" htmlFor="hero-weather-select">
      <span className="hero-page__weather-label">天气</span>
      <select
        id="hero-weather-select"
        value={automatic ? "automatic" : weather}
        onChange={(event) => {
          const value = event.currentTarget.value;
          if (value === "automatic") {
            onRandomize();
            return;
          }
          const selectedWeather = WEATHER_TYPES.find(
            (option) => option === value,
          );
          if (selectedWeather) {
            onSelect(selectedWeather);
          }
        }}
      >
        <option value="automatic">随机天气</option>
        {WEATHER_TYPES.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
    <p className="hero-page__weather-current">
      <span aria-hidden="true" />
      当前 · {weather}
      {automatic ? " · 本次随机" : ""}
    </p>
  </div>
);
