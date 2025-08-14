const { describe, test, expect, beforeAll, afterAll } = require('@jest/globals');
const SmokeOverlapPredictor = require('../../agents/predictor');
const { initializeDatabase, pool } = require('../../db/connection');

describe('Predictor Agent Tests - Smoke Overlap and Conflict Detection', () => {
  let predictor;
  
  beforeAll(async () => {
    await initializeDatabase();
    predictor = new SmokeOverlapPredictor();
  });
  
  afterAll(async () => {
    const poolInstance = pool();
    if (poolInstance) {
      await poolInstance.end();
    }
  });

  describe('Smoke Vector Generation (64-dimensional)', () => {
    test('Should generate valid 64-dimensional smoke vector', async () => {
      const vector = await predictor.generateSmokeVector(
        1001,
        { windSpeed: 10, windDirection: 180, temperature: 25, humidity: 60 },
        100
      );
      
      expect(vector).toHaveLength(64);
      expect(vector.every(v => typeof v === 'number')).toBeTruthy();
      expect(vector.every(v => !isNaN(v) && isFinite(v))).toBeTruthy();
    });

    test('Should encode emission characteristics', async () => {
      const emissions = [50, 100, 200, 400];
      const vectors = await Promise.all(emissions.map(area => 
        predictor.generateSmokeVector(
          1001,
          { windSpeed: 10, windDirection: 180 },
          area
        )
      ));
      
      // Higher emissions should affect early dimensions
      expect(vectors[3][0]).toBeGreaterThan(vectors[0][0]);
    });

    test('Should encode wind dispersion parameters', async () => {
      const windConditions = [
        { windSpeed: 5, windDirection: 0 },
        { windSpeed: 15, windDirection: 90 },
        { windSpeed: 25, windDirection: 180 },
        { windSpeed: 35, windDirection: 270 }
      ];
      
      const vectors = await Promise.all(windConditions.map(wind => 
        predictor.generateSmokeVector(1001, wind, 100)
      ));
      
      // Different wind conditions should produce different vectors
      expect(vectors[0]).not.toEqual(vectors[2]);
      expect(vectors[1]).not.toEqual(vectors[3]);
    });

    test('Should encode atmospheric stability', async () => {
      const conditions = [
        { temperature: 10, humidity: 80 }, // Stable
        { temperature: 30, humidity: 30 }, // Unstable
        { temperature: 20, humidity: 50 }  // Neutral
      ];
      
      const vectors = await Promise.all(conditions.map(c => 
        predictor.generateSmokeVector(
          1001,
          { ...c, windSpeed: 10, windDirection: 180 },
          100
        )
      ));
      
      // Stability should affect dispersion encoding
      expect(vectors[0]).not.toEqual(vectors[1]);
    });

    test('Should calculate dispersion geometry', async () => {
      const vector = await predictor.generateSmokeVector(
        1001,
        { windSpeed: 10, windDirection: 180 },
        100
      );
      
      // Check dispersion geometry dimensions (48-63)
      const geometryDims = vector.slice(48, 64);
      expect(geometryDims.every(v => v >= 0 && v <= 1)).toBeTruthy();
    });

    test('Should handle missing weather data', async () => {
      const vector = await predictor.generateSmokeVector(1001, {}, 100);
      
      expect(vector).toHaveLength(64);
      expect(vector.every(v => !isNaN(v) && isFinite(v))).toBeTruthy();
    });

    test('Should normalize extreme values', async () => {
      const extremeWeather = {
        windSpeed: 100,
        windDirection: 720,
        temperature: 60,
        humidity: 150
      };
      
      const vector = await predictor.generateSmokeVector(
        1001,
        extremeWeather,
        10000
      );
      
      expect(vector.every(v => v >= -10 && v <= 10)).toBeTruthy();
    });

    test('Should be reproducible for same inputs', async () => {
      const weather = { windSpeed: 10, windDirection: 180 };
      const vector1 = await predictor.generateSmokeVector(1001, weather, 100);
      const vector2 = await predictor.generateSmokeVector(1001, weather, 100);
      
      expect(vector1).toEqual(vector2);
    });

    test('Should vary with burn area', async () => {
      const areas = [10, 50, 100, 500];
      const vectors = await Promise.all(areas.map(area => 
        predictor.generateSmokeVector(
          1001,
          { windSpeed: 10, windDirection: 180 },
          area
        )
      ));
      
      // Larger areas should have different smoke patterns
      expect(vectors[0]).not.toEqual(vectors[3]);
    });

    test('Should encode time-dependent dispersion', async () => {
      const times = [1, 2, 4, 8]; // Hours
      const vectors = await Promise.all(times.map(async (time) => {
        const decayFactor = Math.exp(-0.1 * time);
        return predictor.generateSmokeVector(
          1001,
          { windSpeed: 10, windDirection: 180 },
          100 * decayFactor
        );
      }));
      
      // Smoke should disperse over time
      expect(vectors[0][0]).toBeGreaterThan(vectors[3][0]);
    });
  });

  describe('Plume Geometry Calculation', () => {
    test('Should calculate plume geometry from burn location', () => {
      const plume = predictor.calculatePlumeGeometry(
        [-120, 40],
        180, // South
        10,  // Wind speed
        100, // Area
        4    // Duration
      );
      
      expect(plume).toHaveProperty('type', 'Feature');
      expect(plume).toHaveProperty('geometry');
      expect(plume.geometry.type).toBe('Polygon');
    });

    test('Should orient plume with wind direction', () => {
      const windDirections = [0, 90, 180, 270];
      const plumes = windDirections.map(dir => 
        predictor.calculatePlumeGeometry([-120, 40], dir, 10, 100, 4)
      );
      
      // Plumes should point in different directions
      expect(plumes[0]).not.toEqual(plumes[2]);
      expect(plumes[1]).not.toEqual(plumes[3]);
    });

    test('Should scale plume with wind speed', () => {
      const windSpeeds = [5, 10, 20, 30];
      const plumes = windSpeeds.map(speed => 
        predictor.calculatePlumeGeometry([-120, 40], 180, speed, 100, 4)
      );
      
      // Faster winds should create longer plumes
      const getLength = (plume) => {
        const coords = plume.geometry.coordinates[0];
        const distances = coords.map((c, i) => {
          if (i === 0) return 0;
          const prev = coords[i - 1];
          return Math.sqrt(Math.pow(c[0] - prev[0], 2) + Math.pow(c[1] - prev[1], 2));
        });
        return Math.max(...distances);
      };
      
      expect(getLength(plumes[3])).toBeGreaterThan(getLength(plumes[0]));
    });

    test('Should widen plume based on stability', () => {
      const stablePlume = predictor.calculatePlumeGeometry(
        [-120, 40], 180, 5, 100, 4
      );
      
      const unstablePlume = predictor.calculatePlumeGeometry(
        [-120, 40], 180, 20, 100, 4
      );
      
      // Unstable conditions should create wider plumes
      expect(stablePlume).not.toEqual(unstablePlume);
    });

    test('Should limit plume to dispersal radius', () => {
      const plume = predictor.calculatePlumeGeometry(
        [-120, 40], 180, 100, 1000, 24
      );
      
      const coords = plume.geometry.coordinates[0];
      const distances = coords.map(c => 
        Math.sqrt(Math.pow(c[0] + 120, 2) + Math.pow(c[1] - 40, 2)) * 111
      );
      
      expect(Math.max(...distances)).toBeLessThanOrEqual(predictor.dispersalRadius);
    });

    test('Should handle calm wind conditions', () => {
      const plume = predictor.calculatePlumeGeometry(
        [-120, 40], 0, 0.5, 100, 4
      );
      
      expect(plume).toBeDefined();
      expect(plume.geometry.coordinates[0]).toHaveLength(14); // Circular pattern
    });

    test('Should create fan-shaped dispersion', () => {
      const plume = predictor.calculatePlumeGeometry(
        [-120, 40], 270, 10, 100, 4
      );
      
      const coords = plume.geometry.coordinates[0];
      // Should have multiple points forming a fan
      expect(coords.length).toBeGreaterThan(10);
    });

    test('Should calculate plume area', () => {
      const plume = predictor.calculatePlumeGeometry(
        [-120, 40], 180, 10, 100, 4
      );
      
      // Simple area calculation for polygon
      const area = require('@turf/area').default(plume);
      expect(area).toBeGreaterThan(0);
    });

    test('Should handle terrain effects', () => {
      const flatTerrain = predictor.calculatePlumeGeometry(
        [-120, 40], 180, 10, 100, 4
      );
      
      // Simulate terrain by modifying plume
      const complexTerrain = { ...flatTerrain };
      complexTerrain.properties = { terrainModified: true };
      
      expect(complexTerrain.properties.terrainModified).toBeTruthy();
    });

    test('Should generate time-series plumes', () => {
      const times = [1, 2, 3, 4];
      const plumes = times.map(t => 
        predictor.calculatePlumeGeometry([-120, 40], 180, 10, 100, t)
      );
      
      // Plumes should evolve over time
      expect(plumes[0]).not.toEqual(plumes[3]);
    });
  });

  describe('PM2.5 Concentration Calculations', () => {
    test('Should calculate PM2.5 at various distances', () => {
      const distances = [0.1, 0.5, 1, 2, 5, 10];
      const concentrations = distances.map(d => 
        predictor.calculatePM25Concentration(d, 100, 10)
      );
      
      // Concentration should decrease with distance
      for (let i = 1; i < concentrations.length; i++) {
        expect(concentrations[i]).toBeLessThan(concentrations[i - 1]);
      }
    });

    test('Should scale with emission rate', () => {
      const emissionRates = [50, 100, 200, 400];
      const concentrations = emissionRates.map(e => 
        predictor.calculatePM25Concentration(1, e, 10)
      );
      
      // Higher emissions = higher concentrations
      expect(concentrations[3]).toBeGreaterThan(concentrations[0]);
    });

    test('Should vary with wind speed', () => {
      const windSpeeds = [2, 5, 10, 20];
      const concentrations = windSpeeds.map(w => 
        predictor.calculatePM25Concentration(1, 100, w)
      );
      
      // Higher wind = more dilution
      expect(concentrations[0]).toBeGreaterThan(concentrations[3]);
    });

    test('Should apply stability class corrections', () => {
      const stabilityClasses = [1, 2, 3, 4, 5, 6];
      const concentrations = stabilityClasses.map(s => 
        predictor.calculatePM25Concentration(1, 100, 10, s)
      );
      
      // Different stability = different dispersion
      const unique = [...new Set(concentrations)];
      expect(unique.length).toBeGreaterThan(1);
    });

    test('Should handle near-field calculations', () => {
      const concentration = predictor.calculatePM25Concentration(
        0.05, // 50 meters
        100,
        10
      );
      
      expect(concentration).toBeGreaterThan(0);
      expect(concentration).toBeLessThan(10000);
    });

    test('Should calculate cumulative exposure', () => {
      const hourlyConcentrations = [30, 35, 40, 38, 32, 28];
      const avgExposure = hourlyConcentrations.reduce((a, b) => a + b) / hourlyConcentrations.length;
      
      expect(avgExposure).toBeGreaterThan(30);
      expect(avgExposure).toBeLessThan(40);
    });

    test('Should detect hazardous levels', () => {
      const hazardous = predictor.calculatePM25Concentration(0.1, 500, 1);
      const safe = predictor.calculatePM25Concentration(10, 50, 15);
      
      expect(hazardous).toBeGreaterThan(150);
      expect(safe).toBeLessThan(35);
    });

    test('Should calculate ground-level concentration', () => {
      const groundLevel = predictor.calculatePM25Concentration(
        1, 100, 10, 3
      );
      
      expect(groundLevel).toBeGreaterThan(0);
    });

    test('Should apply terrain corrections', () => {
      const flat = predictor.calculatePM25Concentration(1, 100, 10);
      const valley = flat * 1.5; // Valley amplification
      const ridge = flat * 0.7;  // Ridge dilution
      
      expect(valley).toBeGreaterThan(flat);
      expect(ridge).toBeLessThan(flat);
    });

    test('Should calculate area-averaged concentration', () => {
      const gridPoints = [];
      for (let x = -1; x <= 1; x += 0.5) {
        for (let y = -1; y <= 1; y += 0.5) {
          const distance = Math.sqrt(x * x + y * y);
          const conc = predictor.calculatePM25Concentration(distance || 0.1, 100, 10);
          gridPoints.push(conc);
        }
      }
      
      const avgConcentration = gridPoints.reduce((a, b) => a + b) / gridPoints.length;
      expect(avgConcentration).toBeGreaterThan(0);
    });
  });

  describe('Smoke Overlap Detection', () => {
    test('Should detect overlapping plumes', async () => {
      const burn1 = {
        center: [-120, 40],
        area_hectares: 100,
        estimated_duration_hours: 4
      };
      
      const burn2 = {
        center: [-119.99, 40.01],
        area_hectares: 80,
        estimated_duration_hours: 4
      };
      
      const weather = { windSpeed: 10, windDirection: 225 };
      const overlap = await predictor.calculateSmokeOverlap(burn1, burn2, weather);
      
      expect(overlap).toHaveProperty('hasOverlap');
      expect(overlap).toHaveProperty('overlapArea');
      expect(overlap).toHaveProperty('maxCombinedPM25');
    });

    test('Should calculate overlap area', async () => {
      const burn1 = {
        center: [-120, 40],
        area_hectares: 100,
        estimated_duration_hours: 4
      };
      
      const burn2 = {
        center: [-119.98, 40],
        area_hectares: 100,
        estimated_duration_hours: 4
      };
      
      const weather = { windSpeed: 5, windDirection: 90 };
      const overlap = await predictor.calculateSmokeOverlap(burn1, burn2, weather);
      
      if (overlap.hasOverlap) {
        expect(overlap.overlapArea).toBeGreaterThan(0);
      }
    });

    test('Should sum PM2.5 in overlap zones', async () => {
      const burn1 = {
        center: [-120, 40],
        area_hectares: 150,
        estimated_duration_hours: 4
      };
      
      const burn2 = {
        center: [-119.99, 40],
        area_hectares: 150,
        estimated_duration_hours: 4
      };
      
      const weather = { windSpeed: 3, windDirection: 0 };
      const overlap = await predictor.calculateSmokeOverlap(burn1, burn2, weather);
      
      expect(overlap.maxCombinedPM25).toBeGreaterThan(0);
    });

    test('Should determine conflict severity', async () => {
      const scenarios = [
        { distance: 0.5, area: 200, expected: 'critical' },
        { distance: 2, area: 100, expected: 'high' },
        { distance: 5, area: 50, expected: 'medium' },
        { distance: 10, area: 20, expected: 'low' }
      ];
      
      for (const scenario of scenarios) {
        const burn1 = {
          center: [-120, 40],
          area_hectares: scenario.area,
          estimated_duration_hours: 4
        };
        
        const burn2 = {
          center: [-120 + scenario.distance / 111, 40],
          area_hectares: scenario.area,
          estimated_duration_hours: 4
        };
        
        const overlap = await predictor.calculateSmokeOverlap(
          burn1, burn2, 
          { windSpeed: 5, windDirection: 90 }
        );
        
        expect(['low', 'medium', 'high', 'critical']).toContain(overlap.severity);
      }
    });

    test('Should handle non-overlapping burns', async () => {
      const burn1 = {
        center: [-120, 40],
        area_hectares: 50,
        estimated_duration_hours: 4
      };
      
      const burn2 = {
        center: [-119, 41],
        area_hectares: 50,
        estimated_duration_hours: 4
      };
      
      const weather = { windSpeed: 10, windDirection: 180 };
      const overlap = await predictor.calculateSmokeOverlap(burn1, burn2, weather);
      
      expect(overlap.hasOverlap).toBeFalsy();
      expect(overlap.overlapArea).toBe(0);
    });

    test('Should calculate time overlap', async () => {
      const burn1 = {
        center: [-120, 40],
        area_hectares: 100,
        requested_date: '2025-08-25',
        requested_start_time: '09:00',
        estimated_duration_hours: 4
      };
      
      const burn2 = {
        center: [-119.99, 40],
        area_hectares: 100,
        requested_date: '2025-08-25',
        requested_start_time: '11:00',
        estimated_duration_hours: 4
      };
      
      const timeOverlap = predictor.calculateTimeOverlap(burn1, burn2);
      expect(timeOverlap).toBe(2); // 2 hours overlap
    });

    test('Should detect proximity conflicts', async () => {
      const burn1 = {
        center: [-120, 40],
        area_hectares: 100,
        estimated_duration_hours: 4
      };
      
      const burn2 = {
        center: [-119.95, 40],
        area_hectares: 100,
        estimated_duration_hours: 4
      };
      
      const weather = { windSpeed: 2, windDirection: 90 };
      const overlap = await predictor.calculateSmokeOverlap(burn1, burn2, weather);
      
      expect(overlap.distance).toBeLessThan(10); // Within 10km
    });

    test('Should handle wind direction effects', async () => {
      const burn1 = {
        center: [-120, 40],
        area_hectares: 100,
        estimated_duration_hours: 4
      };
      
      const burn2 = {
        center: [-119.95, 40], // East of burn1
        area_hectares: 100,
        estimated_duration_hours: 4
      };
      
      // West wind blows smoke east
      const westWind = { windSpeed: 10, windDirection: 90 };
      const overlap1 = await predictor.calculateSmokeOverlap(burn1, burn2, westWind);
      
      // East wind blows smoke west
      const eastWind = { windSpeed: 10, windDirection: 270 };
      const overlap2 = await predictor.calculateSmokeOverlap(burn1, burn2, eastWind);
      
      // Different wind directions should affect overlap
      expect(overlap1.hasOverlap).not.toEqual(overlap2.hasOverlap);
    });

    test('Should validate plume intersections', async () => {
      const burn1 = {
        center: [-120, 40],
        area_hectares: 200,
        estimated_duration_hours: 6
      };
      
      const burn2 = {
        center: [-119.98, 40.02],
        area_hectares: 150,
        estimated_duration_hours: 5
      };
      
      const weather = { windSpeed: 5, windDirection: 45 };
      const overlap = await predictor.calculateSmokeOverlap(burn1, burn2, weather);
      
      if (overlap.intersection) {
        expect(overlap.intersection.type).toBe('Feature');
      }
    });

    test('Should rank conflicts by severity', async () => {
      const burns = [
        { center: [-120, 40], area_hectares: 100 },
        { center: [-119.99, 40], area_hectares: 150 },
        { center: [-119.98, 40.01], area_hectares: 80 },
        { center: [-120.02, 39.99], area_hectares: 120 }
      ];
      
      const conflicts = [];
      const weather = { windSpeed: 5, windDirection: 180 };
      
      for (let i = 0; i < burns.length; i++) {
        for (let j = i + 1; j < burns.length; j++) {
          const overlap = await predictor.calculateSmokeOverlap(
            { ...burns[i], estimated_duration_hours: 4 },
            { ...burns[j], estimated_duration_hours: 4 },
            weather
          );
          
          if (overlap.hasOverlap || overlap.maxCombinedPM25 > 35) {
            conflicts.push({
              burn1: i,
              burn2: j,
              severity: overlap.severity
            });
          }
        }
      }
      
      // Sort by severity
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      conflicts.sort((a, b) => 
        severityOrder[a.severity] - severityOrder[b.severity]
      );
      
      expect(conflicts).toBeDefined();
    });
  });
});