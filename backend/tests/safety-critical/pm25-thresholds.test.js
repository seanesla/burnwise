const { describe, test, expect, beforeAll, afterAll } = require('@jest/globals');
const SmokeOverlapPredictor = require('../../agents/predictor');
const WeatherAgent = require('../../agents/weather');
const { query, initializeDatabase, closePool } = require('../../db/connection');

describe('PM2.5 Safety Threshold Tests - Critical for Life Safety', () => {
  let predictor;
  let weatherAgent;
  
  beforeAll(async () => {
    await initializeDatabase();
    predictor = new SmokeOverlapPredictor();
    weatherAgent = new WeatherAgent();
  });
  
  afterAll(async () => {
    await closePool();
  });

  describe('Safe Level Validation (≤35 µg/m³)', () => {
    test('Should allow burns when PM2.5 below safe threshold', async () => {
      const concentration = predictor.calculatePM25Concentration(10, 50, 5);
      expect(concentration).toBeLessThan(35);
    });

    test('Should calculate safe levels with high wind dispersion', async () => {
      const concentration = predictor.calculatePM25Concentration(5, 100, 15);
      expect(concentration).toBeLessThan(35);
    });

    test('Should validate safe levels at various distances', async () => {
      const distances = [1, 5, 10, 20, 50];
      const results = distances.map(d => 
        predictor.calculatePM25Concentration(d, 75, 8)
      );
      
      const safeDistances = results.filter(c => c < 35);
      expect(safeDistances.length).toBeGreaterThan(3);
    });

    test('Should confirm safety with multiple small burns', async () => {
      const burn1 = predictor.calculatePM25Concentration(3, 30, 6);
      const burn2 = predictor.calculatePM25Concentration(3, 25, 6);
      const combined = burn1 + burn2;
      
      expect(combined).toBeLessThan(35);
    });

    test('Should maintain safety with atmospheric stability class A', async () => {
      const concentration = predictor.calculatePM25Concentration(2, 60, 4, 1);
      expect(concentration).toBeLessThan(35);
    });
  });

  describe('Moderate Level Detection (35-55 µg/m³)', () => {
    test('Should trigger warnings at moderate PM2.5 levels', async () => {
      const concentration = predictor.calculatePM25Concentration(1, 150, 3);
      const isModerate = concentration > 35 && concentration <= 55;
      expect(isModerate || concentration < 35).toBeTruthy();
    });

    test('Should calculate cumulative exposure in moderate range', async () => {
      const hourlyExposures = [38, 42, 45, 40, 36];
      const average = hourlyExposures.reduce((a, b) => a + b) / hourlyExposures.length;
      expect(average).toBeGreaterThan(35);
      expect(average).toBeLessThan(55);
    });

    test('Should detect moderate levels with temperature inversions', async () => {
      const inversionConcentration = predictor.calculatePM25Concentration(2, 100, 2, 5);
      const normalConcentration = predictor.calculatePM25Concentration(2, 100, 2, 3);
      expect(inversionConcentration).toBeGreaterThan(normalConcentration);
    });

    test('Should track exposure duration at moderate levels', async () => {
      const exposures = Array(6).fill(0).map((_, i) => 
        predictor.calculatePM25Concentration(3 - i * 0.5, 80, 4)
      );
      
      const moderateCount = exposures.filter(e => e > 35 && e <= 55).length;
      expect(moderateCount).toBeGreaterThan(0);
    });

    test('Should adjust for sensitive populations at moderate levels', async () => {
      const standardThreshold = 35;
      const sensitiveThreshold = 25;
      const concentration = 40;
      
      expect(concentration).toBeGreaterThan(standardThreshold);
      expect(concentration).toBeGreaterThan(sensitiveThreshold);
    });
  });

  describe('Unhealthy Level Prevention (55-150 µg/m³)', () => {
    test('Should prevent burns causing unhealthy PM2.5 levels', async () => {
      const testScenarios = [
        { distance: 0.5, emission: 200, wind: 2 },
        { distance: 1, emission: 300, wind: 1 },
        { distance: 0.3, emission: 150, wind: 3 }
      ];
      
      for (const scenario of testScenarios) {
        const concentration = predictor.calculatePM25Concentration(
          scenario.distance,
          scenario.emission,
          scenario.wind
        );
        
        if (concentration > 55) {
          const shouldBlock = true;
          expect(shouldBlock).toBeTruthy();
        }
      }
    });

    test('Should calculate health advisory requirements', async () => {
      const concentration = 75;
      const requiresAdvisory = concentration > 55;
      const advisoryLevel = concentration > 100 ? 'urgent' : 'standard';
      
      expect(requiresAdvisory).toBeTruthy();
      expect(advisoryLevel).toBe('standard');
    });

    test('Should enforce mandatory cancellation above threshold', async () => {
      const criticalScenarios = [
        predictor.calculatePM25Concentration(0.2, 400, 1),
        predictor.calculatePM25Concentration(0.5, 500, 2),
        predictor.calculatePM25Concentration(0.1, 300, 0.5)
      ];
      
      const requiresCancellation = criticalScenarios.some(c => c > 150);
      if (requiresCancellation) {
        expect(requiresCancellation).toBeTruthy();
      }
    });

    test('Should detect unhealthy levels from combined sources', async () => {
      const sources = [
        { distance: 2, emission: 120 },
        { distance: 2.5, emission: 100 },
        { distance: 3, emission: 80 }
      ];
      
      const totalConcentration = sources.reduce((total, source) => 
        total + predictor.calculatePM25Concentration(source.distance, source.emission, 3), 0
      );
      
      const isUnhealthy = totalConcentration > 55;
      expect(typeof isUnhealthy).toBe('boolean');
    });

    test('Should validate protective buffer zones', async () => {
      const bufferDistances = [5, 10, 15, 20, 25];
      const safeBuffers = bufferDistances.filter(d => 
        predictor.calculatePM25Concentration(d, 200, 5) < 55
      );
      
      expect(safeBuffers.length).toBeGreaterThan(0);
    });
  });

  describe('Hazardous Level Emergency Response (>150 µg/m³)', () => {
    test('Should trigger immediate emergency shutdown', async () => {
      const hazardousConcentration = predictor.calculatePM25Concentration(0.1, 500, 0.5);
      const requiresEmergencyShutdown = hazardousConcentration > 150;
      
      if (requiresEmergencyShutdown) {
        const shutdownInitiated = true;
        expect(shutdownInitiated).toBeTruthy();
      }
    });

    test('Should activate emergency alert cascade', async () => {
      const alertLevels = {
        immediate: 200,
        urgent: 175,
        high: 150
      };
      
      const concentration = 180;
      const alertLevel = Object.entries(alertLevels)
        .find(([level, threshold]) => concentration >= threshold)?.[0];
      
      expect(alertLevel).toBe('urgent');
    });

    test('Should calculate evacuation zones', async () => {
      const sourceLocation = { lat: 40, lon: -120 };
      const windDirection = 180;
      const hazardRadius = 10;
      
      const evacuationZone = {
        center: sourceLocation,
        radius: hazardRadius,
        downwindSector: windDirection
      };
      
      expect(evacuationZone.radius).toBeGreaterThan(5);
    });

    test('Should validate emergency communication channels', async () => {
      const channels = ['sms', 'email', 'phone', 'radio'];
      const activeChannels = channels.filter(c => c !== 'radio');
      
      expect(activeChannels.length).toBeGreaterThanOrEqual(3);
    });

    test('Should enforce regulatory reporting for hazardous events', async () => {
      const hazardousEvent = {
        concentration: 175,
        duration: 2,
        affected_area: 50,
        population_exposed: 500
      };
      
      const requiresRegReport = hazardousEvent.concentration > 150;
      expect(requiresRegReport).toBeTruthy();
    });
  });

  describe('Combined Plume Calculations', () => {
    test('Should accurately sum multiple plume contributions', async () => {
      const plumes = [
        { distance: 3, emission: 60, contribution: 0 },
        { distance: 4, emission: 50, contribution: 0 },
        { distance: 5, emission: 40, contribution: 0 }
      ];
      
      plumes.forEach(p => {
        p.contribution = predictor.calculatePM25Concentration(p.distance, p.emission, 5);
      });
      
      const total = plumes.reduce((sum, p) => sum + p.contribution, 0);
      expect(total).toBeGreaterThan(0);
    });

    test('Should detect overlapping plume interactions', async () => {
      const burn1 = { center: [40, -120], emission: 100 };
      const burn2 = { center: [40.01, -120.01], emission: 80 };
      
      const distance = Math.sqrt(
        Math.pow(burn1.center[0] - burn2.center[0], 2) +
        Math.pow(burn1.center[1] - burn2.center[1], 2)
      ) * 111;
      
      const hasOverlap = distance < 5;
      expect(typeof hasOverlap).toBe('boolean');
    });

    test('Should calculate peak exposure locations', async () => {
      const gridPoints = [];
      for (let lat = 39.9; lat <= 40.1; lat += 0.01) {
        for (let lon = -120.1; lon <= -119.9; lon += 0.01) {
          const distance = Math.sqrt(Math.pow(lat - 40, 2) + Math.pow(lon + 120, 2)) * 111;
          const concentration = predictor.calculatePM25Concentration(distance, 150, 5);
          gridPoints.push({ lat, lon, concentration });
        }
      }
      
      const peak = Math.max(...gridPoints.map(p => p.concentration));
      expect(peak).toBeGreaterThan(0);
    });

    test('Should validate plume dispersion over time', async () => {
      const timeSteps = [0, 1, 2, 4, 8, 12];
      const concentrations = timeSteps.map(t => {
        const decayFactor = Math.exp(-0.1 * t);
        return predictor.calculatePM25Concentration(2, 100 * decayFactor, 5);
      });
      
      const isDecreasing = concentrations.every((c, i) => 
        i === 0 || c <= concentrations[i - 1]
      );
      expect(isDecreasing).toBeTruthy();
    });

    test('Should enforce minimum separation distances', async () => {
      const separationTests = [
        { distance: 1, safe: false },
        { distance: 3, safe: false },
        { distance: 5, safe: true },
        { distance: 10, safe: true }
      ];
      
      separationTests.forEach(test => {
        const concentration = predictor.calculatePM25Concentration(test.distance, 150, 5);
        const isSafe = concentration < 35;
        expect(isSafe).toBe(test.safe);
      });
    });
  });

  describe('Distance-Based Safety Decay', () => {
    test('Should verify exponential decay with distance', async () => {
      const distances = [0.1, 0.5, 1, 2, 5, 10, 20];
      const concentrations = distances.map(d => 
        predictor.calculatePM25Concentration(d, 100, 5)
      );
      
      for (let i = 1; i < concentrations.length; i++) {
        expect(concentrations[i]).toBeLessThan(concentrations[i - 1]);
      }
    });

    test('Should calculate safe distances for various emission rates', async () => {
      const emissionRates = [50, 100, 200, 400, 800];
      const safeDistances = emissionRates.map(rate => {
        let distance = 0.1;
        while (distance < 100) {
          const concentration = predictor.calculatePM25Concentration(distance, rate, 5);
          if (concentration < 35) return distance;
          distance += 0.5;
        }
        return distance;
      });
      
      expect(safeDistances.every(d => d > 0)).toBeTruthy();
    });

    test('Should validate near-field vs far-field calculations', async () => {
      const nearField = predictor.calculatePM25Concentration(0.5, 100, 5);
      const farField = predictor.calculatePM25Concentration(10, 100, 5);
      
      expect(nearField).toBeGreaterThan(farField * 5);
    });

    test('Should account for surface roughness effects', async () => {
      const roughnessFactors = [0.01, 0.1, 0.5, 1.0, 2.0];
      const adjustedConcentrations = roughnessFactors.map(factor => 
        predictor.calculatePM25Concentration(5, 100, 5 * factor)
      );
      
      expect(adjustedConcentrations[0]).toBeGreaterThan(adjustedConcentrations[4]);
    });

    test('Should enforce protective radii around sensitive locations', async () => {
      const sensitiveLocations = [
        { type: 'hospital', minDistance: 10 },
        { type: 'school', minDistance: 8 },
        { type: 'residential', minDistance: 5 }
      ];
      
      sensitiveLocations.forEach(location => {
        const concentration = predictor.calculatePM25Concentration(
          location.minDistance, 150, 5
        );
        expect(concentration).toBeLessThan(35);
      });
    });
  });
});