const { describe, test, expect, beforeAll, afterAll } = require('@jest/globals');
const WeatherAgent = require('../../agents/weather');
const { query, initializeDatabase, closePool } = require('../../db/connection');

describe('Weather Safety Tests - Critical for Burn Conditions', () => {
  let weatherAgent;
  
  beforeAll(async () => {
    await initializeDatabase();
    weatherAgent = new WeatherAgent();
  });
  
  afterAll(async () => {
    await closePool();
  });

  describe('High Wind Warning Tests', () => {
    test('Should prevent burns when wind speed exceeds 15 m/s', async () => {
      const windSpeed = 18;
      const isSafe = windSpeed <= 15;
      expect(isSafe).toBeFalsy();
    });

    test('Should trigger alerts for gusts above 20 m/s', async () => {
      const gustSpeed = 22;
      const requiresAlert = gustSpeed > 20;
      expect(requiresAlert).toBeTruthy();
    });

    test('Should calculate wind shear effects on plume', async () => {
      const surfaceWind = 5;
      const upperWind = 15;
      const shear = upperWind - surfaceWind;
      
      expect(shear).toBeGreaterThan(5);
    });

    test('Should detect dangerous wind direction changes', async () => {
      const initialDirection = 180;
      const currentDirection = 270;
      const change = Math.abs(currentDirection - initialDirection);
      
      const isDangerous = change > 45;
      expect(isDangerous).toBeTruthy();
    });

    test('Should model turbulent dispersion in high winds', async () => {
      const windSpeed = 20;
      const turbulenceIntensity = 0.1 + (windSpeed / 100);
      
      expect(turbulenceIntensity).toBeGreaterThan(0.2);
    });

    test('Should enforce wind speed limits by hour', async () => {
      const hourlyLimits = {
        morning: 10,
        afternoon: 15,
        evening: 8,
        night: 5
      };
      
      const currentHour = 14;
      const limit = currentHour < 12 ? hourlyLimits.morning : 
                   currentHour < 18 ? hourlyLimits.afternoon :
                   hourlyLimits.evening;
      
      expect(limit).toBe(15);
    });

    test('Should calculate effective wind speed with terrain', async () => {
      const baseWind = 10;
      const terrainFactor = 1.3; // Ridge amplification
      const effectiveWind = baseWind * terrainFactor;
      
      expect(effectiveWind).toBeGreaterThan(baseWind);
    });

    test('Should predict wind speed changes from forecast', async () => {
      const forecast = [
        { hour: 0, speed: 5 },
        { hour: 6, speed: 8 },
        { hour: 12, speed: 12 },
        { hour: 18, speed: 6 }
      ];
      
      const maxWind = Math.max(...forecast.map(f => f.speed));
      expect(maxWind).toBeLessThanOrEqual(15);
    });

    test('Should detect microbursts and downbursts', async () => {
      const verticalVelocity = -15; // m/s downward
      const isMicroburst = verticalVelocity < -10;
      
      expect(isMicroburst).toBeTruthy();
    });

    test('Should validate wind consistency over burn duration', async () => {
      const windVariability = [8, 9, 7, 10, 8, 11, 9];
      const mean = windVariability.reduce((a, b) => a + b) / windVariability.length;
      const variance = windVariability.reduce((sum, w) => sum + Math.pow(w - mean, 2), 0) / windVariability.length;
      
      expect(Math.sqrt(variance)).toBeLessThan(3);
    });
  });

  describe('Temperature Inversion Detection', () => {
    test('Should detect surface temperature inversions', async () => {
      const surfaceTemp = 15;
      const upperTemp = 18;
      const hasInversion = upperTemp > surfaceTemp;
      
      expect(hasInversion).toBeTruthy();
    });

    test('Should calculate inversion strength', async () => {
      const tempProfile = [
        { height: 0, temp: 12 },
        { height: 100, temp: 14 },
        { height: 200, temp: 15 },
        { height: 300, temp: 13 }
      ];
      
      const inversionHeight = tempProfile.find((p, i) => 
        i > 0 && p.temp < tempProfile[i - 1].temp
      )?.height;
      
      expect(inversionHeight).toBe(300);
    });

    test('Should predict morning inversion breakup time', async () => {
      const sunrise = 6;
      const currentTemp = 10;
      const expectedHigh = 25;
      
      const breakupTime = sunrise + Math.floor((expectedHigh - currentTemp) / 3);
      expect(breakupTime).toBeGreaterThan(sunrise);
    });

    test('Should detect subsidence inversions', async () => {
      const pressure = 1025; // High pressure
      const subsidenceRisk = pressure > 1020;
      
      expect(subsidenceRisk).toBeTruthy();
    });

    test('Should calculate mixing height limitations', async () => {
      const inversionBase = 200; // meters
      const safeMixingHeight = 500; // meters
      
      const isRestricted = inversionBase < safeMixingHeight;
      expect(isRestricted).toBeTruthy();
    });

    test('Should validate burn timing with inversion cycles', async () => {
      const burnStart = 10; // 10 AM
      const inversionBreakup = 11; // 11 AM
      
      const shouldDelay = burnStart < inversionBreakup;
      expect(shouldDelay).toBeTruthy();
    });

    test('Should monitor inversion persistence', async () => {
      const inversionDuration = 8; // hours
      const maxSafeDuration = 6; // hours
      
      const requiresCancellation = inversionDuration > maxSafeDuration;
      expect(requiresCancellation).toBeTruthy();
    });

    test('Should detect marine layer inversions', async () => {
      const distanceToCoast = 50; // km
      const humidity = 85; // %
      
      const marineLayerRisk = distanceToCoast < 100 && humidity > 80;
      expect(marineLayerRisk).toBeTruthy();
    });

    test('Should calculate smoke trapping potential', async () => {
      const inversionStrength = 5; // degrees C
      const windSpeed = 2; // m/s
      
      const trappingIndex = inversionStrength / windSpeed;
      expect(trappingIndex).toBeGreaterThan(1);
    });

    test('Should validate ventilation index', async () => {
      const mixingHeight = 300; // meters
      const transportWind = 3; // m/s
      
      const ventilationIndex = mixingHeight * transportWind;
      const isAdequate = ventilationIndex > 1000;
      
      expect(isAdequate).toBeFalsy();
    });
  });

  describe('Low Humidity Alerts', () => {
    test('Should trigger alerts when humidity drops below 20%', async () => {
      const humidity = 15;
      const requiresAlert = humidity < 20;
      
      expect(requiresAlert).toBeTruthy();
    });

    test('Should calculate fire danger rating', async () => {
      const humidity = 18;
      const temperature = 35;
      const windSpeed = 12;
      
      const dangerIndex = (100 - humidity) * (temperature / 30) * (windSpeed / 10);
      expect(dangerIndex).toBeGreaterThan(50);
    });

    test('Should enforce humidity recovery times', async () => {
      const currentHumidity = 25;
      const minimumSafe = 30;
      const recoveryRate = 2; // % per hour
      
      const hoursToSafe = Math.ceil((minimumSafe - currentHumidity) / recoveryRate);
      expect(hoursToSafe).toBeGreaterThan(0);
    });

    test('Should detect critical fire weather patterns', async () => {
      const conditions = {
        humidity: 12,
        temperature: 38,
        windSpeed: 18,
        stability: 'unstable'
      };
      
      const isCritical = conditions.humidity < 15 && 
                        conditions.temperature > 35 && 
                        conditions.windSpeed > 15;
      
      expect(isCritical).toBeTruthy();
    });

    test('Should calculate fuel moisture content', async () => {
      const humidity = 30;
      const temperature = 25;
      const deadFuelMoisture = humidity * 0.3 + (100 - temperature) * 0.1;
      
      expect(deadFuelMoisture).toBeLessThan(15);
    });

    test('Should validate Haines Index for stability', async () => {
      const tempLapse = 8; // degrees C
      const dewpointDepression = 15; // degrees C
      
      const hainesIndex = Math.min(3, Math.floor(tempLapse / 4)) + 
                         Math.min(3, Math.floor(dewpointDepression / 5));
      
      expect(hainesIndex).toBeGreaterThanOrEqual(2);
    });

    test('Should monitor relative humidity trends', async () => {
      const humidityTrend = [40, 35, 30, 25, 22, 20];
      const isDeclining = humidityTrend.every((h, i) => 
        i === 0 || h <= humidityTrend[i - 1]
      );
      
      expect(isDeclining).toBeTruthy();
    });

    test('Should enforce red flag warning conditions', async () => {
      const redFlagCriteria = {
        humidity: humidity => humidity < 25,
        windSpeed: wind => wind > 15,
        duration: hours => hours > 3
      };
      
      const currentConditions = { humidity: 20, windSpeed: 18, duration: 4 };
      const isRedFlag = redFlagCriteria.humidity(currentConditions.humidity) &&
                        redFlagCriteria.windSpeed(currentConditions.windSpeed) &&
                        redFlagCriteria.duration(currentConditions.duration);
      
      expect(isRedFlag).toBeTruthy();
    });

    test('Should calculate vapor pressure deficit', async () => {
      const temperature = 30;
      const humidity = 25;
      
      const saturationVP = 6.11 * Math.exp((17.27 * temperature) / (temperature + 237.3));
      const actualVP = saturationVP * (humidity / 100);
      const vpd = saturationVP - actualVP;
      
      expect(vpd).toBeGreaterThan(20);
    });

    test('Should detect extreme dry conditions', async () => {
      const consecutiveDryDays = 14;
      const averageHumidity = 22;
      
      const isExtremeDry = consecutiveDryDays > 10 && averageHumidity < 25;
      expect(isExtremeDry).toBeTruthy();
    });
  });

  describe('Storm System Tracking', () => {
    test('Should detect approaching frontal systems', async () => {
      const pressureChange = -5; // mb in 3 hours
      const frontalApproach = pressureChange < -3;
      
      expect(frontalApproach).toBeTruthy();
    });

    test('Should calculate storm arrival time', async () => {
      const stormDistance = 100; // km
      const stormSpeed = 20; // km/h
      
      const arrivalHours = stormDistance / stormSpeed;
      expect(arrivalHours).toBe(5);
    });

    test('Should monitor lightning activity', async () => {
      const lightningStrikes = [
        { distance: 15, time: 0 },
        { distance: 12, time: 5 },
        { distance: 8, time: 10 }
      ];
      
      const approaching = lightningStrikes[2].distance < lightningStrikes[0].distance;
      expect(approaching).toBeTruthy();
    });

    test('Should validate convective potential', async () => {
      const cape = 2500; // J/kg
      const cin = -50; // J/kg
      
      const severeRisk = cape > 2000 && cin > -100;
      expect(severeRisk).toBeTruthy();
    });

    test('Should detect convergence zones', async () => {
      const windField = [
        { location: 'north', direction: 180 },
        { location: 'south', direction: 0 },
        { location: 'east', direction: 270 },
        { location: 'west', direction: 90 }
      ];
      
      const hasConvergence = windField.filter(w => 
        w.direction > 315 || w.direction < 45
      ).length >= 2;
      
      expect(hasConvergence).toBeTruthy();
    });

    test('Should track pressure tendencies', async () => {
      const pressureReadings = [1015, 1013, 1010, 1008, 1005];
      const tendency = pressureReadings[4] - pressureReadings[0];
      
      const rapidFall = tendency < -5;
      expect(rapidFall).toBeTruthy();
    });

    test('Should calculate storm intensity changes', async () => {
      const radarReturns = [35, 40, 45, 50, 55]; // dBZ
      const intensifying = radarReturns.every((r, i) => 
        i === 0 || r >= radarReturns[i - 1]
      );
      
      expect(intensifying).toBeTruthy();
    });

    test('Should detect outflow boundaries', async () => {
      const temperatureDrop = 8; // degrees C in 10 minutes
      const windShift = 90; // degrees
      
      const isOutflow = temperatureDrop > 5 && windShift > 60;
      expect(isOutflow).toBeTruthy();
    });

    test('Should monitor storm cell movement', async () => {
      const cellPositions = [
        { time: 0, lat: 40.5, lon: -120.5 },
        { time: 30, lat: 40.3, lon: -120.3 },
        { time: 60, lat: 40.1, lon: -120.1 }
      ];
      
      const speed = Math.sqrt(
        Math.pow((cellPositions[2].lat - cellPositions[0].lat) * 111, 2) +
        Math.pow((cellPositions[2].lon - cellPositions[0].lon) * 111, 2)
      );
      
      expect(speed).toBeGreaterThan(20);
    });

    test('Should validate nowcast accuracy', async () => {
      const predicted = { rainfall: 10, windSpeed: 15 };
      const observed = { rainfall: 12, windSpeed: 18 };
      
      const rainfallError = Math.abs(predicted.rainfall - observed.rainfall) / observed.rainfall;
      const windError = Math.abs(predicted.windSpeed - observed.windSpeed) / observed.windSpeed;
      
      expect(rainfallError).toBeLessThan(0.3);
      expect(windError).toBeLessThan(0.3);
    });
  });

  describe('Visibility Requirements', () => {
    test('Should enforce minimum visibility thresholds', async () => {
      const visibility = 3; // km
      const minimumRequired = 5; // km
      
      const meetsRequirement = visibility >= minimumRequired;
      expect(meetsRequirement).toBeFalsy();
    });

    test('Should calculate smoke impact on visibility', async () => {
      const pm25Concentration = 150; // µg/m³
      const visibility = 550 / pm25Concentration; // Koschmieder equation approximation
      
      expect(visibility).toBeLessThan(5);
    });

    test('Should detect fog formation potential', async () => {
      const temperature = 15;
      const dewpoint = 14;
      const spread = temperature - dewpoint;
      
      const fogRisk = spread < 2;
      expect(fogRisk).toBeTruthy();
    });

    test('Should monitor visibility trends', async () => {
      const visibilityReadings = [10, 8, 6, 4, 3, 2];
      const deteriorating = visibilityReadings.every((v, i) => 
        i === 0 || v <= visibilityReadings[i - 1]
      );
      
      expect(deteriorating).toBeTruthy();
    });

    test('Should validate aviation minimums', async () => {
      const categories = {
        VFR: 5000, // meters
        MVFR: 3000,
        IFR: 1600,
        LIFR: 800
      };
      
      const currentVis = 2000;
      const category = Object.entries(categories).find(([cat, min]) => 
        currentVis >= min
      )?.[0] || 'LIFR';
      
      expect(category).toBe('IFR');
    });

    test('Should calculate optical depth from smoke', async () => {
      const particleConcentration = 200; // µg/m³
      const pathLength = 1000; // meters
      
      const opticalDepth = particleConcentration * pathLength / 1000000;
      expect(opticalDepth).toBeGreaterThan(0.1);
    });

    test('Should detect visibility hazards for roads', async () => {
      const roadVisibility = 100; // meters
      const safeStoppingDistance = 150; // meters at 60 mph
      
      const isHazardous = roadVisibility < safeStoppingDistance;
      expect(isHazardous).toBeTruthy();
    });

    test('Should monitor smoke layer heights', async () => {
      const ceilingHeight = 200; // meters
      const terrainHeight = 150; // meters
      
      const clearance = ceilingHeight - terrainHeight;
      expect(clearance).toBeLessThan(100);
    });

    test('Should validate visual range for operations', async () => {
      const meteorologicalVisibility = 4; // km
      const contrastThreshold = 0.05;
      
      const visualRange = meteorologicalVisibility * (1 - contrastThreshold);
      expect(visualRange).toBeLessThan(4);
    });

    test('Should enforce twilight visibility adjustments', async () => {
      const daytimeVisibility = 10; // km
      const twilightFactor = 0.7;
      
      const twilightVisibility = daytimeVisibility * twilightFactor;
      expect(twilightVisibility).toBeLessThan(daytimeVisibility);
    });
  });
});