import { Card } from '../ui';

export interface Weather {
  location: string;
  tempC: number;
  condition: string;
  glyph: string;
  high: number;
  low: number;
  forecast: Array<{ day: string; glyph: string; high: number; low: number }>;
}

/** Weather widget block. Presentational — data is supplied by a provider/integration. */
export function WeatherCard({ weather }: { weather: Weather }) {
  return (
    <Card padded={false} className="overflow-hidden">
      <div
        className="flex items-center justify-between p-4 text-white"
        style={{ background: 'linear-gradient(135deg, #4f9bff, #7c6dff)' }}
      >
        <div>
          <div className="text-sm/none opacity-90">{weather.location}</div>
          <div className="mt-1 text-4xl font-bold">{Math.round(weather.tempC)}°</div>
          <div className="text-sm opacity-90">{weather.condition}</div>
        </div>
        <div className="text-right">
          <div className="text-5xl leading-none" aria-hidden>
            {weather.glyph}
          </div>
          <div className="mt-2 text-xs opacity-90">
            H:{Math.round(weather.high)}° L:{Math.round(weather.low)}°
          </div>
        </div>
      </div>
      <div className="grid grid-cols-5 divide-x divide-[var(--border)]">
        {weather.forecast.map((d) => (
          <div key={d.day} className="flex flex-col items-center gap-1 py-2.5 text-xs">
            <span className="text-muted">{d.day}</span>
            <span className="text-base" aria-hidden>
              {d.glyph}
            </span>
            <span className="font-medium text-text">{Math.round(d.high)}°</span>
            <span className="text-faint">{Math.round(d.low)}°</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
