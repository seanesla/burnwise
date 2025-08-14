const { describe, test, expect, beforeAll, afterAll } = require('@jest/globals');
const WeatherAgent = require('../../agents/weather');
const { initializeDatabase, closePool } = require('../../db/connection');

describe('Weather Agent Tests - Critical Weather Analysis', () => {
  let weatherAgent;
  
  beforeAll(async () => {
    await initializeDatabase();
    weatherAgent = new WeatherAgent();
  });
  
  afterAll(async () => {
    await closePool();
  });

  describe('Weather Vector Generation (128-dimensional)', () => {
    test('Should generate valid 128-dimensional weather vector', () => {
      const weatherData = {
        temperature: 25,
        humidity: 60,
        windSpeed: 10,
        windDirection: 180,
        pressure: 1013,
        visibility: 10
      };
      
      const vector = weatherAgent.createWeatherEmbedding(weatherData);
      
      expect(vector).toHaveLength(128);
      expect(vector.every(v => typeof v === 'number')).toBeTruthy();
      expect(vector.every(v => !isNaN(v) && isFinite(v))).toBeTruthy();
    });

    test('Should encode temperature patterns', () => {
      const temperatures = [0, 15, 25, 35, 45];
      const vectors = temperatures.map(temp => 
        weatherAgent.createWeatherEmbedding({ temperature: temp })
      );
      
      // Different temperatures should produce different vectors
      expect(vectors[0]).not.toEqual(vectors[2]);
      expect(vectors[2]).not.toEqual(vectors[4]);
    });

    test('Should encode humidity levels', () => {
      const humidities = [10, 30, 50, 70, 90];
      const vectors = humidities.map(humidity => 
        weatherAgent.createWeatherEmbedding({ humidity })
      );
      
      // Verify humidity encoding affects vector
      expect(vectors[0][2]).not.toEqual(vectors[4][2]);
    });

    test('Should encode wind components', () => {
      const windConditions = [
        { windSpeed: 5, windDirection: 0 },
        { windSpeed: 15, windDirection: 90 },
        { windSpeed: 25, windDirection: 180 },
        { windSpeed: 35, windDirection: 270 }
      ];
      
      const vectors = windConditions.map(w => 
        weatherAgent.createWeatherEmbedding(w)
      );
      
      // Wind vectors should be directionally dependent
      expect(vectors[0]).not.toEqual(vectors[1]);
      expect(vectors[2]).not.toEqual(vectors[3]);
    });

    test('Should handle missing weather data', () => {
      const vector = weatherAgent.createWeatherEmbedding({});
      
      expect(vector).toHaveLength(128);
      expect(vector.every(v => !isNaN(v) && isFinite(v))).toBeTruthy();
    });

    test('Should normalize extreme weather values', () => {
      const extremeWeather = {
        temperature: 60,
        humidity: 100,
        windSpeed: 50,
        pressure: 950
      };
      
      const vector = weatherAgent.createWeatherEmbedding(extremeWeather);
      expect(vector.every(v => v >= -10 && v <= 10)).toBeTruthy();
    });

    test('Should encode atmospheric pressure', () => {
      const pressures = [980, 1000, 1013, 1025, 1040];
      const vectors = pressures.map(pressure => 
        weatherAgent.createWeatherEmbedding({ pressure })
      );
      
      // Pressure differences should affect vector
      expect(vectors[0]).not.toEqual(vectors[4]);
    });

    test('Should capture diurnal patterns', () => {
      const times = [0, 6, 12, 18];
      const vectors = times.map(hour => {
        const temp = 20 + 10 * Math.sin((hour - 6) * Math.PI / 12);
        return weatherAgent.createWeatherEmbedding({ 
          temperature: temp,
          hour 
        });
      });
      
      // Morning and evening should differ
      expect(vectors[1]).not.toEqual(vectors[3]);
    });

    test('Should encode cloud cover', () => {
      const cloudCovers = [0, 25, 50, 75, 100];
      const vectors = cloudCovers.map(clouds => 
        weatherAgent.createWeatherEmbedding({ cloudCover: clouds })
      );
      
      expect(vectors[0]).not.toEqual(vectors[4]);
    });

    test('Should handle NaN and Infinity gracefully', () => {
      const badData = {
        temperature: NaN,
        humidity: Infinity,
        windSpeed: -Infinity,
        pressure: undefined
      };
      
      const vector = weatherAgent.createWeatherEmbedding(badData);
      expect(vector.every(v => !isNaN(v) && isFinite(v))).toBeTruthy();
    });
  });

  describe('Gaussian Plume Model', () => {
    test('Should calculate PM2.5 concentration at distance', () => {
      const concentration = weatherAgent.calculateGaussianPlume(
        1, // distance in km
        100, // emission rate
        5, // wind speed
        'D' // stability class
      );
      
      expect(concentration).toBeGreaterThan(0);
      expect(concentration).toBeLessThan(1000);
    });

    test('Should show concentration decay with distance', () => {
      const distances = [0.1, 0.5, 1, 2, 5, 10];
      const concentrations = distances.map(d => 
        weatherAgent.calculateGaussianPlume(d, 100, 5, 'D')
      );
      
      // Concentration should decrease with distance
      for (let i = 1; i < concentrations.length; i++) {
        expect(concentrations[i]).toBeLessThan(concentrations[i - 1]);
      }
    });

    test('Should vary with wind speed', () => {
      const windSpeeds = [1, 5, 10, 20];
      const concentrations = windSpeeds.map(w => 
        weatherAgent.calculateGaussianPlume(1, 100, w, 'D')
      );
      
      // Higher wind speeds should dilute concentration
      expect(concentrations[0]).toBeGreaterThan(concentrations[3]);
    });

    test('Should vary with stability class', () => {
      const stabilityClasses = ['A', 'B', 'C', 'D', 'E', 'F'];
      const concentrations = stabilityClasses.map(s => 
        weatherAgent.calculateGaussianPlume(1, 100, 5, s)
      );
      
      // Different stability classes produce different concentrations
      expect(Math.max(...concentrations)).toBeGreaterThan(Math.min(...concentrations));
    });

    test('Should handle emission rate variations', () => {
      const emissionRates = [50, 100, 200, 400];
      const concentrations = emissionRates.map(e => 
        weatherAgent.calculateGaussianPlume(1, e, 5, 'D')
      );
      
      // Concentration should scale with emission rate
      expect(concentrations[3]).toBeGreaterThan(concentrations[0]);
    });

    test('Should calculate plume rise', () => {
      const stackHeight = 10;
      const buoyancyFlux = 50;
      const windSpeed = 5;
      
      const plumeRise = weatherAgent.calculatePlumeRise(
        stackHeight,
        buoyancyFlux,
        windSpeed
      );
      
      expect(plumeRise).toBeGreaterThan(stackHeight);
    });

    test('Should determine dispersion coefficients', () => {
      const distance = 1; // km
      const stabilityClass = 'D';
      
      const { sigmaY, sigmaZ } = weatherAgent.getDispersionCoefficients(
        distance,
        stabilityClass
      );
      
      expect(sigmaY).toBeGreaterThan(0);
      expect(sigmaZ).toBeGreaterThan(0);
    });

    test('Should handle ground-level sources', () => {
      const concentration = weatherAgent.calculateGaussianPlume(
        1,
        100,
        5,
        'D',
        0 // ground level
      );
      
      expect(concentration).toBeGreaterThan(0);
    });

    test('Should calculate reflection from ground', () => {
      const withReflection = weatherAgent.calculateGaussianPlume(
        1, 100, 5, 'D', 10, true
      );
      
      const withoutReflection = weatherAgent.calculateGaussianPlume(
        1, 100, 5, 'D', 10, false
      );
      
      expect(withReflection).toBeGreaterThan(withoutReflection);
    });

    test('Should handle calm wind conditions', () => {
      const concentration = weatherAgent.calculateGaussianPlume(
        1,
        100,
        0.5, // Very low wind
        'F' // Stable conditions
      );
      
      expect(concentration).toBeGreaterThan(0);
      expect(isFinite(concentration)).toBeTruthy();
    });
  });

  describe('Stability Class Determination', () => {
    test('Should determine Pasquill stability class', () => {
      const conditions = [
        { windSpeed: 2, cloudCover: 10, solar: 'strong' },
        { windSpeed: 5, cloudCover: 50, solar: 'moderate' },
        { windSpeed: 10, cloudCover: 90, solar: 'weak' }
      ];
      
      const classes = conditions.map(c => 
        weatherAgent.determineStabilityClass(c)
      );
      
      expect(classes.every(c => ['A', 'B', 'C', 'D', 'E', 'F'].includes(c))).toBeTruthy();
    });

    test('Should handle daytime conditions', () => {
      const dayClass = weatherAgent.determineStabilityClass({
        windSpeed: 3,
        cloudCover: 25,
        solar: 'strong',
        isDaytime: true
      });
      
      expect(['A', 'B', 'C'].includes(dayClass)).toBeTruthy();
    });

    test('Should handle nighttime conditions', () => {
      const nightClass = weatherAgent.determineStabilityClass({
        windSpeed: 2,
        cloudCover: 20,
        isDaytime: false
      });
      
      expect(['D', 'E', 'F'].includes(nightClass)).toBeTruthy();
    });

    test('Should factor in cloud cover', () => {
      const clearSky = weatherAgent.determineStabilityClass({
        windSpeed: 2,
        cloudCover: 0,
        isDaytime: false
      });
      
      const overcast = weatherAgent.determineStabilityClass({
        windSpeed: 2,
        cloudCover: 100,
        isDaytime: false
      });
      
      expect(clearSky).not.toEqual(overcast);
    });

    test('Should consider wind speed', () => {
      const lowWind = weatherAgent.determineStabilityClass({
        windSpeed: 1,
        cloudCover: 50,
        isDaytime: true
      });
      
      const highWind = weatherAgent.determineStabilityClass({
        windSpeed: 15,
        cloudCover: 50,
        isDaytime: true
      });
      
      expect(lowWind).not.toEqual(highWind);
    });

    test('Should handle temperature gradient', () => {
      const inversion = weatherAgent.determineStabilityClass({
        temperatureGradient: -2, // Inversion
        windSpeed: 3
      });
      
      const unstable = weatherAgent.determineStabilityClass({
        temperatureGradient: 2, // Unstable
        windSpeed: 3
      });
      
      expect(['E', 'F'].includes(inversion)).toBeTruthy();
      expect(['A', 'B'].includes(unstable)).toBeTruthy();
    });

    test('Should determine mixing height', () => {
      const stabilityClasses = ['A', 'B', 'C', 'D', 'E', 'F'];
      const mixingHeights = stabilityClasses.map(s => 
        weatherAgent.getMixingHeight(s, 12) // Noon
      );
      
      // Unstable conditions have higher mixing heights
      expect(mixingHeights[0]).toBeGreaterThan(mixingHeights[5]);
    });

    test('Should calculate turbulence intensity', () => {
      const classes = ['A', 'B', 'C', 'D', 'E', 'F'];
      const turbulence = classes.map(c => 
        weatherAgent.getTurbulenceIntensity(c)
      );
      
      // More unstable = more turbulent
      expect(turbulence[0]).toBeGreaterThan(turbulence[5]);
    });

    test('Should adjust for surface roughness', () => {
      const urban = weatherAgent.determineStabilityClass({
        windSpeed: 5,
        cloudCover: 50,
        surfaceRoughness: 'urban'
      });
      
      const rural = weatherAgent.determineStabilityClass({
        windSpeed: 5,
        cloudCover: 50,
        surfaceRoughness: 'rural'
      });
      
      // Urban areas have more mechanical turbulence
      expect(urban).not.toEqual(rural);
    });

    test('Should handle transition periods', () => {
      const sunrise = weatherAgent.determineStabilityClass({
        windSpeed: 3,
        cloudCover: 30,
        hour: 6,
        transitionPeriod: true
      });
      
      expect(['C', 'D'].includes(sunrise)).toBeTruthy();
    });
  });

  describe('Weather API Integration', () => {
    test('Should fetch current weather data', async () => {
      const weather = await weatherAgent.fetchCurrentWeather(40, -120);
      
      expect(weather).toHaveProperty('temperature');
      expect(weather).toHaveProperty('humidity');
      expect(weather).toHaveProperty('windSpeed');
      expect(weather).toHaveProperty('windDirection');
    });

    test('Should handle API errors gracefully', async () => {
      // Test with invalid coordinates
      const weather = await weatherAgent.fetchCurrentWeather(999, 999);
      
      // Should return default or cached data
      expect(weather).toBeDefined();
    });

    test('Should cache weather data', async () => {
      const weather1 = await weatherAgent.fetchCurrentWeather(40, -120);
      const weather2 = await weatherAgent.fetchCurrentWeather(40, -120);
      
      // Second call should be faster (cached)
      expect(weather1).toEqual(weather2);
    });

    test('Should validate weather response', () => {
      const validWeather = {
        temperature: 25,
        humidity: 60,
        windSpeed: 10,
        windDirection: 180
      };
      
      const invalid = {
        temperature: 'hot',
        humidity: 'wet'
      };
      
      expect(weatherAgent.validateWeatherData(validWeather)).toBeTruthy();
      expect(weatherAgent.validateWeatherData(invalid)).toBeFalsy();
    });

    test('Should convert units correctly', () => {
      const kelvin = 298;
      const celsius = weatherAgent.kelvinToCelsius(kelvin);
      
      expect(celsius).toBeCloseTo(25, 1);
    });

    test('Should calculate derived metrics', () => {
      const weather = {
        temperature: 25,
        humidity: 60
      };
      
      const dewPoint = weatherAgent.calculateDewPoint(
        weather.temperature,
        weather.humidity
      );
      
      expect(dewPoint).toBeLessThan(weather.temperature);
    });

    test('Should detect weather alerts', () => {
      const dangerousWeather = {
        windSpeed: 25,
        humidity: 15,
        temperature: 40
      };
      
      const alerts = weatherAgent.checkWeatherAlerts(dangerousWeather);
      expect(alerts.length).toBeGreaterThan(0);
    });

    test('Should forecast weather changes', async () => {
      const current = {
        pressure: 1013,
        pressureTrend: -3
      };
      
      const forecast = weatherAgent.generateSimpleForecast(current);
      expect(forecast).toContain('deteriorating');
    });

    test('Should calculate fire weather index', () => {
      const conditions = {
        temperature: 35,
        humidity: 20,
        windSpeed: 15,
        daysWithoutRain: 7
      };
      
      const fwi = weatherAgent.calculateFireWeatherIndex(conditions);
      expect(fwi).toBeGreaterThan(50);
    });

    test('Should validate burn window conditions', () => {
      const goodConditions = {
        windSpeed: 8,
        humidity: 40,
        temperature: 22,
        visibility: 10
      };
      
      const badConditions = {
        windSpeed: 25,
        humidity: 10,
        temperature: 45,
        visibility: 2
      };
      
      expect(weatherAgent.validateBurnConditions(goodConditions)).toBeTruthy();
      expect(weatherAgent.validateBurnConditions(badConditions)).toBeFalsy();
    });
  });
});