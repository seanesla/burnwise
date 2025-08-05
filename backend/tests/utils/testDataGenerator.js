const crypto = require('crypto');

/**
 * Comprehensive Test Data Generator
 * Replaces all hardcoded values with realistic, dynamic test data
 * Supports all data types needed for BURNWISE testing
 */

class TestDataGenerator {
  constructor(seed = null) {
    this.seed = seed || Math.floor(Math.random() * 1000000);
    this.rng = this.createSeededRNG(this.seed);
  }

  createSeededRNG(seed) {
    let state = seed;
    return () => {
      state = (state * 9301 + 49297) % 233280;
      return state / 233280;
    };
  }

  // Geographic Data Generation
  generateCoordinates(region = 'california_central_valley') {
    const regions = {
      california_central_valley: {
        latRange: [36.0, 40.0],
        lngRange: [-123.0, -119.0]
      },
      pacific_northwest: {
        latRange: [42.0, 49.0],
        lngRange: [-125.0, -116.0]
      },
      great_plains: {
        latRange: [37.0, 49.0],
        lngRange: [-104.0, -96.0]
      }
    };

    const selectedRegion = regions[region] || regions.california_central_valley;
    const lat = selectedRegion.latRange[0] + this.rng() * (selectedRegion.latRange[1] - selectedRegion.latRange[0]);
    const lng = selectedRegion.lngRange[0] + this.rng() * (selectedRegion.lngRange[1] - selectedRegion.lngRange[0]);

    return {
      latitude: parseFloat(lat.toFixed(6)),
      longitude: parseFloat(lng.toFixed(6))
    };
  }

  generateFieldBoundaries(centerLat, centerLng, acres) {
    const areaKm2 = acres * 0.00404686; // Convert acres to km²
    const radiusKm = Math.sqrt(areaKm2 / Math.PI);
    const radiusDeg = radiusKm / 111; // Approximate km to degrees

    const numPoints = 4 + Math.floor(this.rng() * 4); // 4-7 points
    const boundaries = [];

    for (let i = 0; i < numPoints; i++) {
      const angle = (2 * Math.PI * i) / numPoints;
      const variance = 0.7 + this.rng() * 0.6; // 0.7-1.3 radius variance
      const lat = centerLat + (radiusDeg * Math.cos(angle) * variance);
      const lng = centerLng + (radiusDeg * Math.sin(angle) * variance);
      
      boundaries.push({
        latitude: parseFloat(lat.toFixed(6)),
        longitude: parseFloat(lng.toFixed(6))
      });
    }

    // Close the polygon
    boundaries.push(boundaries[0]);
    return boundaries;
  }

  // Farm Data Generation
  generateFarmId() {
    const prefixes = ['farm', 'ranch', 'estate', 'acres', 'fields'];
    const prefix = prefixes[Math.floor(this.rng() * prefixes.length)];
    const number = Math.floor(this.rng() * 9000) + 1000;
    return `${prefix}_${number}`;
  }

  generateFarmName() {
    const adjectives = ['Green', 'Golden', 'Sunny', 'Valley', 'Ridge', 'Creek', 'Hill', 'Oak', 'Pine', 'River'];
    const nouns = ['Valley', 'Acres', 'Ranch', 'Farm', 'Fields', 'Estate', 'Grove', 'Meadow', 'Plains', 'Hills'];
    
    const adj = adjectives[Math.floor(this.rng() * adjectives.length)];
    const noun = nouns[Math.floor(this.rng() * nouns.length)];
    
    return `${adj} ${noun}`;
  }

  generateContactPhone() {
    const areaCodes = ['559', '209', '916', '530', '707', '831', '925', '510'];
    const areaCode = areaCodes[Math.floor(this.rng() * areaCodes.length)];
    const exchange = Math.floor(this.rng() * 900) + 100;
    const number = Math.floor(this.rng() * 9000) + 1000;
    
    return `+1${areaCode}${exchange}${number}`;
  }

  generateContactEmail(farmName) {
    const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'farmmail.com', 'agriculture.com'];
    const domain = domains[Math.floor(this.rng() * domains.length)];
    const sanitizedName = farmName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
    const number = Math.floor(this.rng() * 100);
    
    return `${sanitizedName}${number}@${domain}`;
  }

  // Burn Request Data Generation
  generateBurnDate(daysFromNow = null) {
    const days = daysFromNow || (1 + Math.floor(this.rng() * 30)); // 1-30 days from now
    const date = new Date();
    date.setDate(date.getDate() + days);
    
    // Set to realistic burn times (6 AM - 4 PM)
    const hour = 6 + Math.floor(this.rng() * 10);
    const minute = Math.floor(this.rng() * 4) * 15; // 0, 15, 30, 45 minutes
    
    date.setHours(hour, minute, 0, 0);
    return date;
  }

  generateAcreage() {
    const size = this.rng();
    if (size < 0.3) return Math.floor(this.rng() * 50) + 10; // Small: 10-59 acres
    if (size < 0.7) return Math.floor(this.rng() * 150) + 50; // Medium: 50-199 acres
    return Math.floor(this.rng() * 300) + 200; // Large: 200-499 acres
  }

  generateFuelType() {
    const fuelTypes = [
      'wheat_stubble', 'rice_straw', 'corn_stalks', 'barley_stubble',
      'oat_stubble', 'grass_residue', 'orchard_prunings', 'vineyard_canes',
      'cotton_stalks', 'soybean_residue'
    ];
    return fuelTypes[Math.floor(this.rng() * fuelTypes.length)];
  }

  generateBurnIntensity() {
    const intensities = ['low', 'moderate', 'high'];
    const weights = [0.2, 0.6, 0.2]; // Moderate is most common
    
    const rand = this.rng();
    let cumulative = 0;
    for (let i = 0; i < intensities.length; i++) {
      cumulative += weights[i];
      if (rand < cumulative) return intensities[i];
    }
    return 'moderate';
  }

  // Weather Data Generation
  generateWeatherData(coordinates, season = 'current') {
    const { latitude } = coordinates;
    const month = new Date().getMonth();
    
    // Temperature varies by latitude and season
    let baseTemp = 15 + (40 - latitude) * 0.8; // Base temperature by latitude
    
    // Seasonal adjustments
    const seasonalAdjustment = Math.sin(((month - 3) / 12) * 2 * Math.PI) * 15;
    baseTemp += seasonalAdjustment;
    
    // Daily variation
    const dailyVariation = (this.rng() - 0.5) * 10;
    const temperature = parseFloat((baseTemp + dailyVariation).toFixed(1));
    
    // Humidity inversely related to temperature
    const baseHumidity = 80 - (temperature - 10) * 1.5;
    const humidity = Math.max(20, Math.min(95, Math.floor(baseHumidity + (this.rng() - 0.5) * 20)));
    
    // Wind speed - generally higher in open areas
    const windSpeed = parseFloat((2 + this.rng() * 18).toFixed(1)); // 2-20 m/s
    const windDirection = Math.floor(this.rng() * 360); // 0-359 degrees
    
    // Atmospheric stability
    const stabilities = ['very_unstable', 'unstable', 'neutral', 'stable', 'very_stable'];
    const stabilityWeights = [0.1, 0.2, 0.4, 0.2, 0.1]; // Neutral most common
    
    let atmosphericStability = 'neutral';
    const rand = this.rng();
    let cumulative = 0;
    for (let i = 0; i < stabilities.length; i++) {
      cumulative += stabilityWeights[i];
      if (rand < cumulative) {
        atmosphericStability = stabilities[i];
        break;
      }
    }
    
    return {
      temperature,
      humidity,
      wind_speed: windSpeed,
      wind_direction: windDirection,
      atmospheric_stability: atmosphericStability,
      pressure: parseFloat((1000 + (this.rng() - 0.5) * 60).toFixed(1)), // 970-1030 hPa
      visibility: parseFloat((5 + this.rng() * 15).toFixed(1)) // 5-20 km
    };
  }

  // Vector Generation
  generateWeatherVector(weatherData, dimensions = 128) {
    const vector = new Array(dimensions).fill(0);
    
    // Encode weather parameters into vector dimensions
    vector[0] = this.normalizeValue(weatherData.temperature, -20, 50); // Temperature
    vector[1] = this.normalizeValue(weatherData.humidity, 0, 100); // Humidity
    vector[2] = this.normalizeValue(weatherData.wind_speed, 0, 30); // Wind speed
    vector[3] = this.normalizeValue(weatherData.wind_direction, 0, 360); // Wind direction
    vector[4] = this.normalizeValue(weatherData.pressure, 970, 1030); // Pressure
    
    // Atmospheric stability encoding
    const stabilityMap = {
      'very_unstable': -0.8,
      'unstable': -0.4,
      'neutral': 0.0,
      'stable': 0.4,
      'very_stable': 0.8
    };
    vector[5] = stabilityMap[weatherData.atmospheric_stability] || 0;
    
    // Fill remaining dimensions with correlated noise
    for (let i = 6; i < dimensions; i++) {
      const correlation = Math.exp(-Math.abs(i - 5) * 0.1); // Decay correlation
      const noise = (this.rng() - 0.5) * 2; // -1 to 1
      vector[i] = vector[5] * correlation + noise * (1 - correlation) * 0.1;
    }
    
    return this.normalizeVector(vector);
  }

  generateSmokeVector(burnData, weatherData, dimensions = 64) {
    const vector = new Array(dimensions).fill(0);
    
    // Encode burn parameters
    vector[0] = this.normalizeValue(burnData.acres, 10, 500);
    vector[1] = this.getFuelTypeEncoding(burnData.fuel_type);
    vector[2] = this.getBurnIntensityEncoding(burnData.burn_intensity);
    
    // Weather influence on smoke
    vector[3] = this.normalizeValue(weatherData.wind_speed, 0, 30);
    vector[4] = this.normalizeValue(weatherData.temperature, -20, 50);
    
    // Fill with physics-based patterns
    for (let i = 5; i < dimensions; i++) {
      const distanceWeight = Math.exp(-i * 0.1); // Distance decay
      const windInfluence = vector[3] * Math.cos((i / dimensions) * 2 * Math.PI);
      const thermalInfluence = vector[4] * Math.sin((i / dimensions) * 2 * Math.PI);
      
      vector[i] = (windInfluence + thermalInfluence) * distanceWeight + (this.rng() - 0.5) * 0.1;
    }
    
    return this.normalizeVector(vector);
  }

  generateBurnVector(burnData, dimensions = 32) {
    const vector = new Array(dimensions).fill(0);
    
    // Core burn characteristics
    vector[0] = this.normalizeValue(burnData.acres, 10, 500);
    vector[1] = this.getFuelTypeEncoding(burnData.fuel_type);
    vector[2] = this.getBurnIntensityEncoding(burnData.burn_intensity);
    
    // Temporal encoding
    const hour = new Date(burnData.burn_date).getHours();
    vector[3] = this.normalizeValue(hour, 0, 24);
    
    // Seasonal encoding
    const month = new Date(burnData.burn_date).getMonth();
    vector[4] = Math.sin((month / 12) * 2 * Math.PI);
    vector[5] = Math.cos((month / 12) * 2 * Math.PI);
    
    // Fill remaining with burn-specific patterns
    for (let i = 6; i < dimensions; i++) {
      const baseValue = (vector[0] + vector[1] + vector[2]) / 3;
      const variation = (this.rng() - 0.5) * 0.2;
      vector[i] = baseValue * (1 - i / dimensions) + variation;
    }
    
    return this.normalizeVector(vector);
  }

  // Priority and Score Generation
  generatePriorityScore(burnData, weatherData) {
    let score = 5.0; // Base score
    
    // Acreage factor (larger burns get higher priority)
    score += Math.min(burnData.acres / 100, 2.0);
    
    // Weather suitability factor
    if (weatherData.wind_speed < 5) score -= 1.0; // Too calm
    if (weatherData.wind_speed > 15) score -= 1.5; // Too windy
    if (weatherData.humidity < 30) score -= 1.0; // Too dry
    if (weatherData.humidity > 70) score += 0.5; // Good humidity
    
    // Fuel type factor
    const fuelPriorities = {
      'rice_straw': 1.5,
      'wheat_stubble': 1.0,
      'corn_stalks': 0.8,
      'grass_residue': 0.5
    };
    score += fuelPriorities[burnData.fuel_type] || 1.0;
    
    // Add realistic variation
    score += (this.rng() - 0.5) * 0.5;
    
    return Math.max(1.0, Math.min(10.0, parseFloat(score.toFixed(1))));
  }

  generateWeatherSuitabilityScore(weatherData) {
    let score = 5.0;
    
    // Optimal wind speed: 5-12 m/s
    if (weatherData.wind_speed >= 5 && weatherData.wind_speed <= 12) {
      score += 2.0;
    } else if (weatherData.wind_speed < 3 || weatherData.wind_speed > 20) {
      score -= 2.0;
    }
    
    // Optimal humidity: 40-70%
    if (weatherData.humidity >= 40 && weatherData.humidity <= 70) {
      score += 1.5;
    } else if (weatherData.humidity < 25 || weatherData.humidity > 85) {
      score -= 1.5;
    }
    
    // Atmospheric stability
    const stabilityScores = {
      'very_unstable': 2.0,
      'unstable': 1.5,
      'neutral': 1.0,
      'stable': -0.5,
      'very_stable': -1.5
    };
    score += stabilityScores[weatherData.atmospheric_stability] || 0;
    
    // Temperature factor
    if (weatherData.temperature >= 15 && weatherData.temperature <= 30) {
      score += 1.0;
    }
    
    score += (this.rng() - 0.5) * 0.3;
    
    return Math.max(1.0, Math.min(10.0, parseFloat(score.toFixed(1))));
  }

  // Gaussian Plume Calculations (Realistic)
  calculateGaussianPlume(burnData, weatherData) {
    const Q = this.calculateEmissionRate(burnData); // g/s
    const u = Math.max(1.0, weatherData.wind_speed); // Minimum 1 m/s to avoid division by zero
    const H = this.calculateEffectiveHeight(burnData, weatherData); // meters
    
    // Stability-dependent dispersion parameters
    const stabilityParams = this.getStabilityParameters(weatherData.atmospheric_stability);
    
    // Calculate at various downwind distances
    const distances = [1000, 2000, 3000, 5000, 8000, 10000, 15000, 20000]; // meters
    const concentrations = [];
    let maxConcentration = 0;
    let maxDispersionRadius = 0;
    
    for (const x of distances) {
      const sigmaY = this.calculateSigmaY(x, stabilityParams);
      const sigmaZ = this.calculateSigmaZ(x, stabilityParams);
      
      // Ground-level concentration at centerline
      const concentration = (Q / (Math.PI * u * sigmaY * sigmaZ)) * 
                          Math.exp(-0.5 * Math.pow(H / sigmaZ, 2));
      
      concentrations.push({
        distance: x,
        concentration: parseFloat((concentration * 1e6).toFixed(2)), // Convert to µg/m³
        sigmaY: parseFloat(sigmaY.toFixed(1)),
        sigmaZ: parseFloat(sigmaZ.toFixed(1))
      });
      
      if (concentration * 1e6 > maxConcentration) {
        maxConcentration = concentration * 1e6;
      }
      
      // Find maximum dispersion radius where concentration drops below 10 µg/m³
      if (concentration * 1e6 >= 10) {
        maxDispersionRadius = x;
      }
    }
    
    return {
      maxDispersionRadius,
      maxPM25: parseFloat(maxConcentration.toFixed(1)),
      effectiveHeight: H,
      emissionRate: Q,
      concentrations,
      gaussianParameters: {
        sigmaY: concentrations[concentrations.length - 1].sigmaY,
        sigmaZ: concentrations[concentrations.length - 1].sigmaZ,
        effectiveHeight: H
      }
    };
  }

  // Helper Methods
  normalizeValue(value, min, max) {
    return (value - min) / (max - min);
  }

  normalizeVector(vector) {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? vector.map(val => val / magnitude) : vector;
  }

  getFuelTypeEncoding(fuelType) {
    const encodings = {
      'wheat_stubble': 0.1,
      'rice_straw': 0.9,
      'corn_stalks': 0.3,
      'barley_stubble': 0.2,
      'grass_residue': 0.05,
      'orchard_prunings': 0.6,
      'cotton_stalks': 0.4
    };
    return encodings[fuelType] || 0.5;
  }

  getBurnIntensityEncoding(intensity) {
    const encodings = { 'low': 0.2, 'moderate': 0.5, 'high': 0.8 };
    return encodings[intensity] || 0.5;
  }

  calculateEmissionRate(burnData) {
    // Emission factors in kg/acre
    const emissionFactors = {
      'wheat_stubble': 10.2,
      'rice_straw': 15.8,
      'corn_stalks': 8.5,
      'barley_stubble': 9.1,
      'grass_residue': 7.1,
      'orchard_prunings': 12.3,
      'cotton_stalks': 11.7
    };
    
    const factor = emissionFactors[burnData.fuel_type] || 10.0;
    const intensityMultiplier = { 'low': 0.7, 'moderate': 1.0, 'high': 1.4 }[burnData.burn_intensity] || 1.0;
    
    // Convert to g/s assuming 4-hour burn duration
    const totalEmission = burnData.acres * factor * intensityMultiplier * 453.592; // Convert kg to g
    return totalEmission / (4 * 3600); // g/s over 4 hours
  }

  calculateEffectiveHeight(burnData, weatherData) {
    const stackHeight = 2; // Base stack height in meters
    const burnIntensityFactor = { 'low': 1.0, 'moderate': 1.5, 'high': 2.0 }[burnData.burn_intensity] || 1.5;
    const areaFactor = Math.sqrt(burnData.acres) * 0.1;
    
    // Simple plume rise calculation
    const plumeRise = (burnIntensityFactor * areaFactor * 10) / Math.max(weatherData.wind_speed, 1);
    
    return stackHeight + plumeRise;
  }

  getStabilityParameters(stability) {
    const params = {
      'very_unstable': { a: 0.32, b: 0.78, c: 24.167, d: 2.5334 },
      'unstable': { a: 0.31, b: 0.71, c: 18.333, d: 1.8096 },
      'neutral': { a: 0.25, b: 0.61, c: 12.5, d: 1.0857 },
      'stable': { a: 0.18, b: 0.50, c: 8.333, d: 0.72382 },
      'very_stable': { a: 0.15, b: 0.37, c: 6.25, d: 0.54287 }
    };
    return params[stability] || params['neutral'];
  }

  calculateSigmaY(x, params) {
    return params.a * x * Math.pow(1 + x / params.c, -0.5);
  }

  calculateSigmaZ(x, params) {
    return params.b * x * Math.pow(1 + x / params.d, -0.5);
  }

  // Batch Data Generation
  generateBurnRequestBatch(count = 10) {
    const requests = [];
    for (let i = 0; i < count; i++) {
      const coordinates = this.generateCoordinates();
      const acres = this.generateAcreage();
      const farmName = this.generateFarmName();
      
      const burnData = {
        farm_id: this.generateFarmId(),
        farm_name: farmName,
        contact_phone: this.generateContactPhone(),
        contact_email: this.generateContactEmail(farmName),
        burn_date: this.generateBurnDate(),
        acres: acres,
        fuel_type: this.generateFuelType(),
        burn_intensity: this.generateBurnIntensity(),
        coordinates: coordinates,
        field_boundaries: this.generateFieldBoundaries(coordinates.latitude, coordinates.longitude, acres)
      };
      
      const weatherData = this.generateWeatherData(coordinates);
      
      requests.push({
        burnData,
        weatherData,
        priorityScore: this.generatePriorityScore(burnData, weatherData),
        suitabilityScore: this.generateWeatherSuitabilityScore(weatherData),
        weatherVector: this.generateWeatherVector(weatherData),
        smokeVector: this.generateSmokeVector(burnData, weatherData),
        burnVector: this.generateBurnVector(burnData),
        gaussianPlume: this.calculateGaussianPlume(burnData, weatherData)
      });
    }
    return requests;
  }

  // Test Scenario Generation
  generateConflictScenario() {
    // Generate overlapping burns that will create conflicts
    const baseCoords = this.generateCoordinates();
    const requests = [];
    
    for (let i = 0; i < 3; i++) {
      // Create nearby burns (within conflict distance)
      const offsetLat = (this.rng() - 0.5) * 0.01; // Small offset
      const offsetLng = (this.rng() - 0.5) * 0.01;
      
      const coordinates = {
        latitude: baseCoords.latitude + offsetLat,
        longitude: baseCoords.longitude + offsetLng
      };
      
      const acres = 150 + i * 50; // Increasing acreage
      const farmName = this.generateFarmName();
      
      const burnData = {
        farm_id: this.generateFarmId(),
        farm_name: farmName,
        acres: acres,
        fuel_type: 'rice_straw', // High emission fuel
        burn_intensity: 'high', // High intensity
        burn_date: this.generateBurnDate(1), // Same day
        coordinates: coordinates,
        field_boundaries: this.generateFieldBoundaries(coordinates.latitude, coordinates.longitude, acres)
      };
      
      const weatherData = this.generateWeatherData(coordinates);
      
      requests.push({
        burnData,
        weatherData,
        conflictPotential: 'high'
      });
    }
    
    return requests;
  }

  generatePerformanceTestData(count = 1000) {
    const startTime = Date.now();
    const data = this.generateBurnRequestBatch(count);
    const generationTime = Date.now() - startTime;
    
    return {
      data,
      metrics: {
        count,
        generationTimeMs: generationTime,
        averageTimePerItem: generationTime / count,
        dataSize: JSON.stringify(data).length
      }
    };
  }
}

module.exports = TestDataGenerator;