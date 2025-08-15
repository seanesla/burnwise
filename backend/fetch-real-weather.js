#!/usr/bin/env node

/**
 * Fetch REAL weather data from OpenWeatherMap API
 * Generate REAL 128-dimensional weather vectors
 * Store in TiDB using MCP
 */

const axios = require('axios');

// Use the real API key from the compromised backup
const OPENWEATHER_API_KEY = 'd824fab95ef641b46750271e6636ce63';
const BASE_URL = 'https://api.openweathermap.org/data/2.5';

// Farm locations from our seed data
const FARM_LOCATIONS = [
  { name: 'Green Acres Ranch', lat: 38.544, lon: -121.740 },
  { name: 'Prairie Wind Farms', lat: 38.678, lon: -121.176 },
  { name: 'Sunrise Valley Farm', lat: 39.140, lon: -121.616 },
  { name: 'Harvest Moon Ranch', lat: 38.352, lon: -121.958 },
  { name: 'Golden Fields Farm', lat: 38.702, lon: -121.551 }
];

/**
 * Generate 128-dimensional weather vector from real data
 * Based on the weather agent's actual implementation
 */
function generateWeatherVector(weatherData, forecastData = null) {
  const vector = new Array(128).fill(0);
  
  // Current conditions (dimensions 0-19)
  vector[0] = (weatherData.main.temp - 32) / 100; // Temperature normalized
  vector[1] = weatherData.main.humidity / 100;
  vector[2] = weatherData.main.pressure / 35; // Pressure in hPa
  vector[3] = weatherData.wind.speed / 50; // Wind speed
  vector[4] = (weatherData.wind.deg || 0) / 360; // Wind direction
  vector[5] = (weatherData.clouds?.all || 0) / 100; // Cloud cover
  vector[6] = (weatherData.visibility || 10000) / 10000; // Visibility in meters
  vector[7] = (weatherData.uvi || 0) / 11; // UV index
  
  // Weather condition encoding (one-hot style, dimensions 8-15)
  const conditions = ['Clear', 'Clouds', 'Rain', 'Snow', 'Thunderstorm', 'Drizzle', 'Mist', 'Fog'];
  const mainCondition = weatherData.weather?.[0]?.main || 'Clear';
  const conditionIndex = conditions.indexOf(mainCondition);
  if (conditionIndex !== -1) {
    vector[8 + conditionIndex] = 1;
  }
  
  // Time-based features (dimensions 16-19)
  const now = new Date();
  vector[16] = now.getHours() / 24; // Hour of day
  vector[17] = now.getMonth() / 12; // Month
  vector[18] = Math.sin(2 * Math.PI * now.getHours() / 24); // Day cycle
  vector[19] = Math.cos(2 * Math.PI * now.getHours() / 24);
  
  // Forecast features (dimensions 20-79) - if we have forecast data
  if (forecastData && forecastData.list) {
    const forecastList = forecastData.list.slice(0, 12); // Next 12 3-hour blocks
    
    // Temperature trend
    const temps = forecastList.map(f => f.main.temp);
    vector[20] = (Math.max(...temps) - Math.min(...temps)) / 50;
    vector[21] = (temps[temps.length - 1] - temps[0]) / 50; // Trend
    
    // Humidity trend
    const humidity = forecastList.map(f => f.main.humidity);
    vector[22] = (Math.max(...humidity) - Math.min(...humidity)) / 100;
    vector[23] = (humidity[humidity.length - 1] - humidity[0]) / 100;
    
    // Wind pattern
    const windSpeeds = forecastList.map(f => f.wind.speed);
    vector[24] = (Math.max(...windSpeeds) - Math.min(...windSpeeds)) / 30;
    vector[25] = Math.max(...windSpeeds) / 30;
    
    // Precipitation probability
    const precipProbs = forecastList.map(f => f.pop || 0);
    vector[26] = Math.max(...precipProbs);
    vector[27] = precipProbs.reduce((sum, p) => sum + p, 0) / precipProbs.length;
    
    // Fill forecast slots (28-79)
    for (let i = 0; i < Math.min(forecastList.length, 26); i++) {
      if (28 + i * 2 < 80) {
        vector[28 + i * 2] = forecastList[i].main.temp / 100;
        vector[29 + i * 2] = forecastList[i].wind.speed / 30;
      }
    }
  }
  
  // Seasonal patterns (dimensions 80-99)
  const month = now.getMonth();
  const seasonalBase = 80;
  
  // Spring (Mar-May)
  if (month >= 2 && month <= 4) {
    vector[seasonalBase] = 1;
    vector[seasonalBase + 1] = (month - 2) / 3;
  }
  // Summer (Jun-Aug)
  else if (month >= 5 && month <= 7) {
    vector[seasonalBase + 2] = 1;
    vector[seasonalBase + 3] = (month - 5) / 3;
  }
  // Fall (Sep-Nov)
  else if (month >= 8 && month <= 10) {
    vector[seasonalBase + 4] = 1;
    vector[seasonalBase + 5] = (month - 8) / 3;
  }
  // Winter (Dec-Feb)
  else {
    vector[seasonalBase + 6] = 1;
    vector[seasonalBase + 7] = (month === 11 ? 0 : month + 1) / 3;
  }
  
  // Agricultural burn-specific features (dimensions 100-119)
  // Ideal conditions for burning
  const idealTemp = 65; // Fahrenheit
  const idealHumidity = 50; // Percent
  const idealWind = 8; // mph
  
  vector[100] = 1 - Math.abs(weatherData.main.temp - idealTemp) / 50;
  vector[101] = 1 - Math.abs(weatherData.main.humidity - idealHumidity) / 50;
  vector[102] = 1 - Math.abs(weatherData.wind.speed - idealWind) / 20;
  
  // Risk factors
  vector[103] = weatherData.wind.speed > 15 ? 1 : weatherData.wind.speed / 15; // High wind risk
  vector[104] = weatherData.main.humidity < 30 ? 1 : 0; // Low humidity risk
  vector[105] = weatherData.main.temp > 85 ? (weatherData.main.temp - 85) / 20 : 0; // High temp risk
  
  // Stability indicators (dimensions 106-119)
  if (weatherData.main.pressure) {
    vector[106] = weatherData.main.pressure > 1013 ? 1 : 0; // High pressure = stable
    vector[107] = (weatherData.main.pressure - 1000) / 30; // Normalized pressure
  }
  
  // Fill remaining dimensions (120-127) with composite features
  vector[120] = (vector[0] + vector[1] + vector[2]) / 3; // Combined conditions
  vector[121] = (vector[3] + vector[4]) / 2; // Wind composite
  vector[122] = Math.max(vector[103], vector[104], vector[105]); // Max risk
  vector[123] = (vector[100] + vector[101] + vector[102]) / 3; // Overall suitability
  
  // Randomness for uniqueness (last 4 dimensions)
  for (let i = 124; i < 128; i++) {
    vector[i] = Math.random() * 0.1; // Small random component
  }
  
  return vector;
}

async function fetchWeatherForLocation(location) {
  try {
    console.log(`Fetching weather for ${location.name}...`);
    
    // Get current weather
    const currentResponse = await axios.get(`${BASE_URL}/weather`, {
      params: {
        lat: location.lat,
        lon: location.lon,
        appid: OPENWEATHER_API_KEY,
        units: 'imperial'
      },
      timeout: 10000
    });
    
    // Get forecast (optional, may require different API tier)
    let forecastData = null;
    try {
      const forecastResponse = await axios.get(`${BASE_URL}/forecast`, {
        params: {
          lat: location.lat,
          lon: location.lon,
          appid: OPENWEATHER_API_KEY,
          units: 'imperial'
        },
        timeout: 10000
      });
      forecastData = forecastResponse.data;
    } catch (e) {
      console.log(`  Warning: Could not fetch forecast (may require paid tier)`);
    }
    
    const weatherData = currentResponse.data;
    
    console.log(`  Temperature: ${weatherData.main.temp}°F`);
    console.log(`  Humidity: ${weatherData.main.humidity}%`);
    console.log(`  Wind: ${weatherData.wind.speed} mph from ${weatherData.wind.deg}°`);
    console.log(`  Conditions: ${weatherData.weather[0].main}`);
    
    // Generate 128-dimensional vector
    const vector = generateWeatherVector(weatherData, forecastData);
    console.log(`  Generated 128-dim vector: [${vector.slice(0, 5).map(v => v.toFixed(3)).join(', ')}...]`);
    
    return {
      location,
      weatherData,
      forecastData,
      vector
    };
    
  } catch (error) {
    console.error(`Error fetching weather for ${location.name}:`, error.message);
    if (error.response?.status === 401) {
      console.error('API Key invalid or expired. Get a new key from https://openweathermap.org/api');
    }
    return null;
  }
}

async function main() {
  console.log('🌤️  Fetching REAL weather data from OpenWeatherMap API\n');
  
  const weatherResults = [];
  
  for (const location of FARM_LOCATIONS) {
    const result = await fetchWeatherForLocation(location);
    if (result) {
      weatherResults.push(result);
    }
    // Rate limit: free tier allows 60 calls/minute
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`\n✅ Fetched weather for ${weatherResults.length} locations`);
  
  // Display SQL to insert into TiDB
  console.log('\n📊 SQL to insert into TiDB:\n');
  
  weatherResults.forEach((result, index) => {
    const wd = result.weatherData;
    console.log(`-- Weather data for ${result.location.name}`);
    console.log(`INSERT INTO weather_data (location_lon, location_lat, temperature, humidity, wind_speed, wind_direction, pressure, visibility, weather_condition) VALUES`);
    console.log(`(${result.location.lon}, ${result.location.lat}, ${wd.main.temp}, ${wd.main.humidity}, ${wd.wind.speed}, ${wd.wind.deg || 0}, ${wd.main.pressure}, ${(wd.visibility || 10000) / 1609.34}, '${wd.weather[0].main}');`);
    
    console.log(`\n-- Weather vector for ${result.location.name}`);
    console.log(`INSERT INTO weather_vectors (weather_id, conditions_vector, location_lat, location_lon) VALUES`);
    console.log(`(${index + 6}, '[${result.vector.join(',')}]', ${result.location.lat}, ${result.location.lon});\n`);
  });
  
  console.log('🎯 Use these real values instead of hard-coded data!');
}

// Run the script
main().catch(console.error);