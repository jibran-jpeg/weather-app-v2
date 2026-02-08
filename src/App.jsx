import { useState, useEffect, useRef } from 'react'
import { Cloud, Sun, CloudRain, CloudSnow, CloudLightning, Wind, Droplets, Search, MapPin, Loader2, Thermometer, Eye, LocateFixed, Sunrise, Sunset, Leaf } from 'lucide-react'
import './index.css'

function App() {
  const [city, setCity] = useState("Detecting Location...")
  const [weatherData, setWeatherData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [aqiData, setAqiData] = useState(null)

  const scrollRef = useRef(null)

  useEffect(() => {
    handleCurrentLocation();
  }, [])

  const handleCurrentLocation = () => {
    setLoading(true);
    setCity("Locating...");
    setError(null);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          fetchWeather(latitude, longitude)
        },
        (err) => {
          console.error("Geolocation error:", err)
          fetchWeather(51.5074, -0.1278, "London, United Kingdom")
        }
      )
    } else {
      fetchWeather(51.5074, -0.1278, "London, United Kingdom")
    }
  }

  const fetchWeather = async (lat, lon, manualLocationName = null) => {
    setLoading(true)
    setError(null)

    try {
      // Get location name
      let finalName = manualLocationName
      if (!finalName) {
        try {
          const geoRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`)
          const geoData = await geoRes.json()
          finalName = `${geoData.city || geoData.locality || 'Unknown'}, ${geoData.countryName || ''}`
        } catch (e) {
          finalName = `${lat.toFixed(2)}, ${lon.toFixed(2)}`
        }
      }
      setCity(finalName)

      // Fetch weather data from Open-Meteo
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,wind_speed_10m&hourly=temperature_2m,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max&timezone=auto`
      )
      if (!response.ok) throw new Error('Failed to fetch weather data')
      const data = await response.json()

      // Fetch AQI data
      try {
        const aqiRes = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi`)
        const aqiJson = await aqiRes.json()
        setAqiData(aqiJson.current?.us_aqi)
      } catch (e) {
        console.error("AQI fetch failed", e)
        setAqiData(null)
      }

      setWeatherData(data)
      updateBackground(data.current.weather_code, data.current.is_day)

    } catch (err) {
      console.error(err)
      setError("Unable to load weather data.")
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!searchTerm.trim()) return

    setLoading(true)
    setError(null)

    try {
      const geoResponse = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchTerm)}&count=1&language=en&format=json`
      )
      const geoData = await geoResponse.json()

      if (!geoData.results || geoData.results.length === 0) {
        throw new Error('City not found')
      }

      const { latitude, longitude, name, country } = geoData.results[0]
      const fullName = `${name}, ${country || ''}`
      fetchWeather(latitude, longitude, fullName)
      setSearchTerm('')
    } catch (err) {
      console.error(err)
      setError("City not found. Please try another location.")
      setLoading(false)
    }
  }

  // --- HELPERS ---

  const mapWeatherAPIcode = (code) => {
    if (code === 1000) return 0;
    if (code === 1003) return 2;
    if (code === 1006 || code === 1009) return 3;
    if ([1030, 1135, 1147].includes(code)) return 45;
    if ([1063, 1150, 1153, 1180, 1183, 1240].includes(code)) return 61;
    if ([1186, 1189, 1192, 1195, 1243].includes(code)) return 65;
    if ([1066, 1114, 1210, 1213, 1216, 1219, 1222, 1225, 1255, 1258].includes(code)) return 71;
    if ([1087, 1273, 1276, 1279, 1282].includes(code)) return 95;
    return 3;
  }

  const transformHourlyWeatherAPI = (hours) => {
    return {
      mapped: hours.map(h => ({
        time: h.time,
        temp: h.temp_c,
        code: mapWeatherAPIcode(h.condition.code),
        isDay: h.is_day
      }))
    }
  }

  const getNext24Hours = (hourlyData) => {
    if (hourlyData.time && Array.isArray(hourlyData.time)) {
      const currentHour = new Date().getHours();
      return hourlyData.time.slice(currentHour, currentHour + 24).map((time, index) => {
        const realIndex = currentHour + index;
        return {
          time: time,
          temp: hourlyData.temperature_2m[realIndex],
          code: hourlyData.weather_code[realIndex],
          isDay: hourlyData.is_day[realIndex]
        }
      });
    }
    if (hourlyData.mapped) {
      const currentHour = new Date().getHours();
      return hourlyData.mapped.slice(currentHour);
    }
    return [];
  }

  const updateBackground = (code, isDay) => {
    const body = document.body;
    body.className = '';

    if (code === 0 || code === 1) body.classList.add(isDay ? 'sunny' : 'clear-night');
    else if (code >= 2 && code <= 3) body.classList.add('cloudy');
    else if (code >= 51 && code <= 67) body.classList.add('rainy');
    else if (code >= 71 && code <= 77) body.classList.add('snowy');
    else if (code >= 95) body.classList.add('stormy');
    else body.classList.add('cloudy');
  }

  const getIconColor = (code, isDay) => {
    if (code === 0 || code === 1) return isDay ? "#fbbf24" : "#fef08a";
    if (code >= 2 && code <= 3) return "#cbd5e1";
    if (code >= 45 && code <= 48) return "#94a3b8";
    if (code >= 51 && code <= 67) return "#7dd3fc";
    if (code >= 71 && code <= 77) return "#f1f5f9";
    if (code >= 80 && code <= 82) return "#38bdf8";
    if (code >= 95) return "#c084fc";
    return "#ffffff";
  }

  const getWeatherIcon = (code, isDay, size = 120) => {
    const color = getIconColor(code, isDay);
    const props = { size, color, strokeWidth: 1.5 };

    if (code === 0 || code === 1) return <Sun {...props} />
    if (code === 2 || code === 3) return <Cloud {...props} />
    if (code >= 45 && code <= 48) return <Cloud {...props} />
    if (code >= 51 && code <= 67) return <CloudRain {...props} />
    if (code >= 71 && code <= 77) return <CloudSnow {...props} />
    if (code >= 80 && code <= 82) return <CloudRain {...props} />
    if (code >= 95) return <CloudLightning {...props} />

    return <Sun {...props} />
  }

  const getWeatherDescription = (code, description = null) => {
    if (description) return description;

    const codes = {
      0: 'Clear Sky', 1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
      45: 'Fog', 48: 'Freezing Fog',
      51: 'Light Drizzle', 53: 'Moderate Drizzle', 55: 'Dense Drizzle',
      61: 'Slight Rain', 63: 'Moderate Rain', 65: 'Heavy Rain',
      71: 'Slight Snow', 73: 'Moderate Snow', 75: 'Heavy Snow',
      95: 'Thunderstorm'
    }
    return codes[code] || 'Unknown'
  }

  const formatTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: 'numeric', hour12: true });
  }

  const getDayName = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }

  const getAqiDescription = (aqi) => {
    if (!aqi) return { text: 'N/A', color: '#94a3b8' }
    if (aqi <= 50) return { text: 'Good', color: '#4ade80' } // Green
    if (aqi <= 100) return { text: 'Moderate', color: '#facc15' } // Yellow
    if (aqi <= 150) return { text: 'Unhealthy for Sensitive', color: '#fb923c' } // Orange
    if (aqi <= 200) return { text: 'Unhealthy', color: '#f87171' } // Red
    if (aqi <= 300) return { text: 'Very Unhealthy', color: '#a855f7' } // Purple
    return { text: 'Hazardous', color: '#7f1d1d' } // Maroon
  }

  const scrollLeft = () => scrollRef.current?.scrollBy({ left: -300, behavior: 'smooth' })
  const scrollRight = () => scrollRef.current?.scrollBy({ left: 300, behavior: 'smooth' })

  // Helpers for Sun Arc
  const calculateSunPosition = (sunrise, sunset) => {
    // Use current time to position sun on arc
    // sunrise/sunset are ISO strings for OpenMeteo or "06:00 AM" for WeatherAPI
    // Normalize to Date objects
    const now = new Date();
    let rise, set;

    // Try parsing assuming ISO first (OpenMeteo)
    rise = new Date(sunrise);
    set = new Date(sunset);

    // If Invalid (WeatherAPI sends "07:11 AM"), parse manually
    if (isNaN(rise.getTime())) {
      // Rudimentary parser for "HH:MM AM" - implies today
      const parseTime = (timeStr) => {
        const [time, modifier] = timeStr.split(' ');
        let [hours, minutes] = time.split(':');
        if (hours === '12') hours = '00';
        if (modifier === 'PM') hours = parseInt(hours, 10) + 12;
        const d = new Date();
        d.setHours(hours, minutes, 0);
        return d;
      }
      rise = parseTime(sunrise);
      set = parseTime(sunset);
    }

    const dayLength = set - rise;
    const elapsed = now - rise;
    let progress = elapsed / dayLength; // 0 to 1

    if (progress < 0) progress = 0; // Pre-sunrise
    if (progress > 1) progress = 1; // Post-sunset

    return progress * 100; // Percentage
  }

  return (
    <div className="dashboard-container">
      {/* 1. Header: Search & Settings */}
      <div className="header-section">
        <form onSubmit={handleSearch} className="search-box">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search city..."
            className="search-input"
          />
          <button type="submit" className="search-btn" disabled={loading}>
            {loading ? <Loader2 size={18} className="spin-anim" /> : <Search size={18} />}
          </button>
        </form>

        <button className="location-btn" onClick={handleCurrentLocation} title="Use Current Location">
          <LocateFixed size={20} />
        </button>
      </div>

      {/* 2. Main Content */}
      {weatherData && !loading ? (
        <div className="main-content">
          <div className="text-center animate-fade-in mb-8">
            <h1 className="city-name">
              <MapPin size={24} className="opacity-80" />
              {city}
            </h1>
            <div className="weather-display-large">
              <div className="icon-wrapper">{getWeatherIcon(weatherData.current.weather_code, weatherData.current.is_day, 140)}</div>
              <div className="temperature-large">{Math.round(weatherData.current.temperature_2m)}°</div>
            </div>
            <p className="weather-desc-large">
              {getWeatherDescription(weatherData.current.weather_code, weatherData.current.description)}
              <span className="block text-lg opacity-60 mt-1">H:{Math.round(weatherData.daily.temperature_2m_max[0])}° L:{Math.round(weatherData.daily.temperature_2m_min[0])}°</span>
            </p>
          </div>

          <div className="hourly-section">
            <h3 className="section-title">Hourly Forecast</h3>
            <div className="forecast-scroll-wrapper">
              <div className="forecast-container" ref={scrollRef}>
                {getNext24Hours(weatherData.hourly).map((hour, idx) => (
                  <div key={idx} className="forecast-item" style={{ animationDelay: `${idx * 0.05}s` }}>
                    <span className="forecast-time">{idx === 0 ? 'Now' : formatTime(hour.time)}</span>
                    {getWeatherIcon(hour.code, hour.isDay, 32)}
                    <span className="forecast-temp">{Math.round(hour.temp)}°</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 3. Details Grid: 7-Day Forecast & Sun/AQI */}
          <div className="details-grid animate-slide-up">

            {/* Left Column: 7-Day Forecast */}
            <div className="glass-panel h-full">
              <h3 className="section-title" style={{ marginLeft: 0, marginBottom: '1rem' }}>7-Day Forecast</h3>
              <div className="weekly-list">
                {(() => {
                  const days = weatherData.daily.time.slice(0, 7);
                  const mins = weatherData.daily.temperature_2m_min.slice(0, 7);
                  const maxs = weatherData.daily.temperature_2m_max.slice(0, 7);

                  // Calculate range for the whole week to scale the bars
                  const minWeek = Math.min(...mins);
                  const maxWeek = Math.max(...maxs);
                  const range = maxWeek - minWeek || 1;

                  return days.map((day, idx) => {
                    const min = Math.round(mins[idx]);
                    const max = Math.round(maxs[idx]);
                    const code = weatherData.daily.weather_code[idx];

                    // Calculate bar position (left) and width based on weekly range
                    const left = ((min - minWeek) / range) * 100;
                    const width = ((max - min) / range) * 100;

                    return (
                      <div key={idx} className="weekly-item">
                        <span className="day-name">{idx === 0 ? 'Today' : getDayName(day)}</span>
                        <div className="flex justify-center">{getWeatherIcon(code, 1, 24)}</div>

                        {/* Layout: Min Temp | Bar | Max Temp */}
                        <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '12px' }}>
                          <span className="min-max" style={{ minWidth: '28px', textAlign: 'right', whiteSpace: 'nowrap' }}>{min}°</span>

                          <div className="temp-bar">
                            <div className="temp-fill" style={{
                              left: `${left}%`,
                              width: `${width}%`,
                              position: 'absolute',
                              height: '100%',
                              borderRadius: '10px'
                            }}></div>
                          </div>

                          <span className="min-max" style={{ minWidth: '28px', textAlign: 'left', whiteSpace: 'nowrap', fontWeight: '700', color: '#fff' }}>{max}°</span>
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>
            </div>

            {/* Right Column: Sun & AQI */}
            <div className="right-column">

              {/* Sun Cycle */}
              <div className="glass-panel">
                <h3 className="section-title" style={{ marginLeft: 0 }}>Sunrise & Sunset</h3>
                <div className="sun-cycle-container">
                  {/* Simple SVG Arc */}
                  <svg className="sun-arc-svg" viewBox="0 0 200 120" preserveAspectRatio="xMidYMid meet">
                    {/* Track */}
                    <path d="M 20,100 A 80,80 0 0,1 180,100" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeDasharray="5,5" />
                    {/* Sun Circle positioned based on time */}
                    {(() => {
                      const progress = calculateSunPosition(weatherData.daily.sunrise[0], weatherData.daily.sunset[0]);
                      const angle = Math.PI - (progress / 100) * Math.PI;
                      const r = 80;
                      const cx = 100, cy = 100;
                      const x = cx + r * Math.cos(angle);
                      const y = cy - r * Math.sin(angle);

                      // Current Time Formatting
                      const now = new Date();
                      const timeString = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

                      return (
                        <>
                          <circle cx={x} cy={y} r="8" fill="#fbbf24" filter="drop-shadow(0 0 8px rgba(251, 191, 36, 0.8))" />
                          {/* Time Label floating above sun */}
                          <text x={x} y={y - 15} textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                            {timeString}
                          </text>
                        </>
                      );
                    })()}
                  </svg>
                  <div className="sun-times">
                    <span><Sunrise size={16} className="inline mr-1" /> {formatTime(weatherData.daily.sunrise[0])}</span>
                    <span><Sunset size={16} className="inline mr-1" /> {formatTime(weatherData.daily.sunset[0])}</span>
                  </div>
                </div>
              </div>

              {/* AQI Card */}
              <div className="glass-panel">
                <h3 className="section-title" style={{ marginLeft: 0 }}>Air Quality</h3>
                <div className="aqi-container">
                  <div className="aqi-left">
                    <span className="text-sm opacity-60 uppercase tracking-wider">US EPA Index</span>
                    <span className="aqi-value">{aqiData ?? '-'}</span>
                  </div>
                  <div className="aqi-right">
                    {(() => {
                      const status = getAqiDescription(aqiData);
                      return (
                        <span className="aqi-label" style={{ backgroundColor: status.color }}>
                          {status.text}
                        </span>
                      )
                    })()}
                    <Leaf size={40} className="mt-2 opacity-30" style={{ color: '#4ade80' }} />
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      ) : (
        <div className="loading-screen">
          <Loader2 size={48} className="spin-anim text-white/50" />
          <p className="mt-4 opacity-50 text-sm tracking-widest uppercase">{error ? "Error" : "Locating..."}</p>
        </div>
      )}

      {/* 3. Footer Stats (Simplified as we have details above now) */}
      {/* Keeping distinct stats row if desired, or merging. Let's keep it but maybe simplified */}

    </div>
  )
}

export default App
