const { test, expect } = require('@playwright/test');
const axios = require('axios');
const mysql = require('mysql2/promise');

const API_URL = 'http://localhost:5000/api';

test.describe('TiDB Vector Search Tests', () => {
  let connection;

  test.beforeAll(async () => {
    // Direct database connection for vector operations
    // IMPORTANT: Always use environment variables for credentials!
    if (!process.env.TIDB_HOST || !process.env.TIDB_PASSWORD) {
      throw new Error('Database credentials not configured. Please set TIDB_HOST, TIDB_USER, and TIDB_PASSWORD environment variables.');
    }
    
    connection = await mysql.createConnection({
      host: process.env.TIDB_HOST,
      port: process.env.TIDB_PORT || 4000,
      user: process.env.TIDB_USER,
      password: process.env.TIDB_PASSWORD,
      database: process.env.TIDB_DATABASE || 'test',
      ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true
      }
    });
  });

  test.afterAll(async () => {
    if (connection) {
      await connection.end();
    }
  });

  test('Weather Vector Storage and Retrieval (128-dim)', async () => {
    // Generate a 128-dimensional weather vector
    const weatherVector = Array(128).fill(0).map((_, i) => Math.sin(i * 0.1) * 0.5 + 0.5);
    
    // Store weather data with vector
    const [result] = await connection.execute(
      `INSERT INTO weather_conditions (
        location_lat, location_lon, temperature, humidity, wind_speed, 
        wind_direction, pressure, weather_pattern_embedding, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [45.5152, -122.6784, 22.5, 65, 5.2, 180, 1013, JSON.stringify(weatherVector)]
    );

    expect(result.insertId).toBeGreaterThan(0);

    // Search for similar patterns using cosine distance
    const searchVector = weatherVector.map(v => v + (Math.random() - 0.5) * 0.1);
    const [rows] = await connection.execute(
      `SELECT id, 
              VEC_Cosine_Distance(weather_pattern_embedding, ?) AS distance,
              temperature, humidity, wind_speed
       FROM weather_conditions 
       WHERE VEC_Cosine_Distance(weather_pattern_embedding, ?) < 0.3
       ORDER BY distance
       LIMIT 5`,
      [JSON.stringify(searchVector), JSON.stringify(searchVector)]
    );

    expect(rows).toBeInstanceOf(Array);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].distance).toBeLessThan(0.3);

    console.log('Weather vector search results:', {
      matches: rows.length,
      topDistance: rows[0]?.distance,
      temperature: rows[0]?.temperature
    });
  });

  test('Smoke Plume Vector Storage and Retrieval (64-dim)', async () => {
    // Generate a 64-dimensional smoke plume vector
    const smokeVector = Array(64).fill(0).map((_, i) => {
      // Simulate plume dispersion pattern
      const distance = i / 64;
      return Math.exp(-distance * 5) * (1 + Math.random() * 0.2);
    });

    // Store smoke prediction with vector
    const [result] = await connection.execute(
      `INSERT INTO smoke_predictions (
        burn_request_id, plume_vector, max_concentration, 
        affected_area_km2, wind_speed, stability_class, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [1, JSON.stringify(smokeVector), 45.2, 125.5, 5.2, 'C']
    );

    expect(result.insertId).toBeGreaterThan(0);

    // Find similar smoke patterns
    const [rows] = await connection.execute(
      `SELECT id,
              VEC_Cosine_Distance(plume_vector, ?) AS similarity,
              max_concentration,
              affected_area_km2
       FROM smoke_predictions
       WHERE VEC_Cosine_Distance(plume_vector, ?) < 0.25
       ORDER BY similarity
       LIMIT 3`,
      [JSON.stringify(smokeVector), JSON.stringify(smokeVector)]
    );

    expect(rows).toBeInstanceOf(Array);
    expect(rows.length).toBeGreaterThan(0);
    
    console.log('Smoke plume vector search:', {
      matches: rows.length,
      similarities: rows.map(r => r.similarity?.toFixed(3))
    });
  });

  test('Terrain Pattern Vector Storage (32-dim)', async () => {
    // Generate a 32-dimensional terrain vector
    const terrainVector = Array(32).fill(0).map((_, i) => {
      // Simulate terrain features (elevation, slope, vegetation)
      if (i < 8) return Math.random() * 100; // Elevation features
      if (i < 16) return Math.random() * 30; // Slope features
      if (i < 24) return Math.random(); // Vegetation indices
      return Math.random() * 0.5; // Other features
    });

    // Store historical burn with terrain vector
    const [result] = await connection.execute(
      `INSERT INTO historical_burns (
        farm_id, burn_date, duration_hours, fuel_consumed_tons,
        pattern_vector, outcome_score, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [1, new Date().toISOString().split('T')[0], 4.5, 250, JSON.stringify(terrainVector), 0.85]
    );

    expect(result.insertId).toBeGreaterThan(0);

    // Find burns with similar terrain patterns
    const [rows] = await connection.execute(
      `SELECT id,
              VEC_Cosine_Distance(pattern_vector, ?) AS distance,
              outcome_score,
              fuel_consumed_tons
       FROM historical_burns
       WHERE VEC_Cosine_Distance(pattern_vector, ?) < 0.4
       ORDER BY distance
       LIMIT 10`,
      [JSON.stringify(terrainVector), JSON.stringify(terrainVector)]
    );

    expect(rows).toBeInstanceOf(Array);
    
    console.log('Terrain pattern search:', {
      matches: rows.length,
      avgOutcome: rows.reduce((sum, r) => sum + (r.outcome_score || 0), 0) / rows.length
    });
  });

  test('Combined Vector Search - Multi-dimensional query', async () => {
    // Test searching across multiple vector types simultaneously
    const weatherVector = Array(128).fill(0).map(() => Math.random());
    const targetLocation = { lat: 45.5152, lon: -122.6784 };

    // Complex query combining vector search with spatial operations
    const [rows] = await connection.execute(
      `SELECT 
        wc.id,
        wc.temperature,
        wc.wind_speed,
        VEC_Cosine_Distance(wc.weather_pattern_embedding, ?) AS weather_similarity,
        ST_Distance_Sphere(
          POINT(wc.location_lon, wc.location_lat),
          POINT(?, ?)
        ) AS distance_meters
       FROM weather_conditions wc
       WHERE VEC_Cosine_Distance(wc.weather_pattern_embedding, ?) < 0.5
         AND ST_Distance_Sphere(
           POINT(wc.location_lon, wc.location_lat),
           POINT(?, ?)
         ) < 50000
       ORDER BY weather_similarity
       LIMIT 5`,
      [
        JSON.stringify(weatherVector),
        targetLocation.lon, targetLocation.lat,
        JSON.stringify(weatherVector),
        targetLocation.lon, targetLocation.lat
      ]
    );

    console.log('Combined vector-spatial search:', {
      results: rows.length,
      nearestDistance: rows[0]?.distance_meters,
      bestSimilarity: rows[0]?.weather_similarity
    });
  });

  test('Vector Dimension Validation', async () => {
    // Test that incorrect vector dimensions are rejected
    const wrongDimVector = Array(100).fill(0.5); // Wrong dimension (should be 128)

    try {
      await connection.execute(
        `INSERT INTO weather_conditions (
          location_lat, location_lon, weather_pattern_embedding, created_at
        ) VALUES (?, ?, ?, NOW())`,
        [45.5, -122.6, JSON.stringify(wrongDimVector)]
      );
      
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      // Expected to fail with dimension mismatch
      expect(error.message).toContain('dimension');
      console.log('Vector dimension validation working correctly');
    }
  });

  test('Vector Search Performance', async () => {
    // Insert multiple vectors and test search performance
    const vectors = [];
    for (let i = 0; i < 100; i++) {
      const vector = Array(128).fill(0).map(() => Math.random());
      vectors.push(vector);
      
      await connection.execute(
        `INSERT INTO weather_conditions (
          location_lat, location_lon, weather_pattern_embedding, created_at
        ) VALUES (?, ?, ?, NOW())`,
        [45.5 + i * 0.001, -122.6 + i * 0.001, JSON.stringify(vector)]
      );
    }

    // Measure search performance
    const searchVector = Array(128).fill(0).map(() => Math.random());
    const startTime = Date.now();

    const [rows] = await connection.execute(
      `SELECT id, VEC_Cosine_Distance(weather_pattern_embedding, ?) AS distance
       FROM weather_conditions
       WHERE VEC_Cosine_Distance(weather_pattern_embedding, ?) < 0.6
       ORDER BY distance
       LIMIT 20`,
      [JSON.stringify(searchVector), JSON.stringify(searchVector)]
    );

    const searchTime = Date.now() - startTime;

    expect(searchTime).toBeLessThan(1000); // Should complete within 1 second
    expect(rows.length).toBeGreaterThan(0);

    console.log('Vector search performance:', {
      totalVectors: vectors.length,
      searchTimeMs: searchTime,
      resultsFound: rows.length
    });
  });

  test('API Vector Search Endpoints', async () => {
    // Test weather vector search API
    const weatherResponse = await axios.post(`${API_URL}/weather/vector-search`, {
      referenceVector: Array(128).fill(0).map(() => Math.random()),
      limit: 5,
      maxDistance: 0.5
    });

    expect(weatherResponse.status).toBe(200);
    expect(weatherResponse.data.results).toBeInstanceOf(Array);

    // Test smoke plume vector search API
    const smokeResponse = await axios.post(`${API_URL}/smoke/vector-search`, {
      referenceVector: Array(64).fill(0).map(() => Math.random()),
      limit: 3,
      maxDistance: 0.3
    });

    expect(smokeResponse.status).toBe(200);
    expect(smokeResponse.data.results).toBeInstanceOf(Array);

    console.log('API vector search results:', {
      weatherMatches: weatherResponse.data.results.length,
      smokeMatches: smokeResponse.data.results.length
    });
  });
});