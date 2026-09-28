import "./weather.scss";

const WEATHER_TYPES = [
  { kind: "sun-shower", label: "Sun shower" },
  { kind: "thunder-storm", label: "Thunderstorm" },
  { kind: "cloudy", label: "Cloudy" },
  { kind: "flurries", label: "Flurries" },
  { kind: "sunny", label: "Sunny" },
  { kind: "rainy", label: "Rainy" },
] as const;

function WeatherIcon({ kind, label }: (typeof WEATHER_TYPES)[number]) {
  return (
    <div
      className={`weather-icon weather-icon--${kind}`}
      role="img"
      aria-label={label}
    >
      <div className="weather-icon__art" aria-hidden="true">
        {(kind === "sun-shower" || kind === "thunder-storm" || kind === "cloudy" || kind === "flurries" || kind === "rainy") && (
          <div className="weather-icon__cloud" />
        )}
        {kind === "sun-shower" && (
          <>
            <div className="weather-icon__sun">
              <div className="weather-icon__rays" />
            </div>
            <div className="weather-icon__rain" />
          </>
        )}
        {kind === "thunder-storm" && (
          <div className="weather-icon__lightning">
            <div className="weather-icon__bolt" />
            <div className="weather-icon__bolt" />
          </div>
        )}
        {kind === "cloudy" && <div className="weather-icon__cloud" />}
        {kind === "flurries" && (
          <div className="weather-icon__snow">
            <div className="weather-icon__flake" />
            <div className="weather-icon__flake" />
          </div>
        )}
        {kind === "sunny" && (
          <div className="weather-icon__sun">
            <div className="weather-icon__rays" />
          </div>
        )}
        {kind === "rainy" && <div className="weather-icon__rain" />}
      </div>
      <span className="weather-icon__label">{label}</span>
    </div>
  );
}

function Weather() {
  return (
    <section className="weather-icons" aria-labelledby="weather-icons-title">
      <h2 className="weather-icons__title" id="weather-icons-title">
        Animated Weather Icons
      </h2>
      <div className="weather-icons__grid">
        {WEATHER_TYPES.map((weather) => (
          <WeatherIcon key={weather.kind} {...weather} />
        ))}
      </div>
    </section>
  );
}

export default Weather;