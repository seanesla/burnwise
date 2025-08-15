const { describe, test, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals');
const { initializeDatabase, query, pool } = require('../../db/connection');
require('dotenv').config();

describe('TiDB Spatial Operations - Critical for Burn Area and Smoke Overlap Calculations', () => {
  let testTableCreated = false;
  
  beforeAll(async () => {
    await initializeDatabase();
    
    // Create test tables with spatial columns
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS test_burn_fields (
          field_id INT PRIMARY KEY AUTO_INCREMENT,
          farm_id INT,
          field_name VARCHAR(100),
          field_geometry GEOMETRY NOT NULL,
          area_hectares DECIMAL(10, 2),
          centroid POINT,
          SPATIAL INDEX idx_geometry (field_geometry),
          SPATIAL INDEX idx_centroid (centroid)
        )
      `);
      
      await query(`
        CREATE TABLE IF NOT EXISTS test_smoke_zones (
          zone_id INT PRIMARY KEY AUTO_INCREMENT,
          burn_request_id INT,
          smoke_polygon POLYGON NOT NULL,
          pm25_level DECIMAL(10, 2),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          SPATIAL INDEX idx_smoke_polygon (smoke_polygon)
        )
      `);
      
      await query(`
        CREATE TABLE IF NOT EXISTS test_population_centers (
          center_id INT PRIMARY KEY AUTO_INCREMENT,
          name VARCHAR(100),
          location POINT NOT NULL,
          population INT,
          buffer_zone GEOMETRY,
          SPATIAL INDEX idx_location (location),
          SPATIAL INDEX idx_buffer (buffer_zone)
        )
      `);
      
      testTableCreated = true;
    } catch (error) {
      console.error('Error creating spatial test tables:', error);
    }
  });
  
  afterAll(async () => {
    // Clean up test tables
    if (testTableCreated) {
      await query('DROP TABLE IF EXISTS test_burn_fields');
      await query('DROP TABLE IF EXISTS test_smoke_zones');
      await query('DROP TABLE IF EXISTS test_population_centers');
    }
    
    const poolInstance = pool();
    if (poolInstance) {
      await poolInstance.end();
    }
  });
  
  beforeEach(async () => {
    // Clear test data
    if (testTableCreated) {
      await query('DELETE FROM test_burn_fields WHERE field_id > 99000');
      await query('DELETE FROM test_smoke_zones WHERE zone_id > 99000');
      await query('DELETE FROM test_population_centers WHERE center_id > 99000');
    }
  });

  describe('Geometric Data Types and Storage', () => {
    test('Should store and retrieve POINT geometries for field centroids', async () => {
      const lat = 40.123456;
      const lon = -120.654321;
      
      const [result] = await query(`
        INSERT INTO test_burn_fields 
        (farm_id, field_name, field_geometry, centroid, area_hectares)
        VALUES (?, ?, ST_GeomFromText('POLYGON((? ?, ? ?, ? ?, ? ?, ? ?))', 4326), 
                ST_GeomFromText('POINT(? ?)', 4326), ?)
      `, [
        1, 'Test Field', 
        lon-0.001, lat-0.001, lon+0.001, lat-0.001, 
        lon+0.001, lat+0.001, lon-0.001, lat+0.001, 
        lon-0.001, lat-0.001,
        lon, lat, 
        100.5
      ]);
      
      expect(result.insertId).toBeGreaterThan(0);
      
      const [retrieved] = await query(`
        SELECT 
          ST_X(centroid) as longitude,
          ST_Y(centroid) as latitude,
          area_hectares
        FROM test_burn_fields 
        WHERE field_id = ?
      `, [result.insertId]);
      
      expect(parseFloat(retrieved[0].longitude)).toBeCloseTo(lon, 5);
      expect(parseFloat(retrieved[0].latitude)).toBeCloseTo(lat, 5);
      expect(parseFloat(retrieved[0].area_hectares)).toBe(100.5);
    });

    test('Should store and retrieve POLYGON geometries for burn fields', async () => {
      // Create rectangular field boundary
      const coords = [
        [-120.5, 40.0], [-120.4, 40.0], 
        [-120.4, 40.1], [-120.5, 40.1], 
        [-120.5, 40.0] // Close polygon
      ];
      
      const wkt = `POLYGON((${coords.map(c => `${c[0]} ${c[1]}`).join(', ')}))`;
      
      const [result] = await query(`
        INSERT INTO test_burn_fields (farm_id, field_geometry)
        VALUES (?, ST_GeomFromText(?, 4326))
      `, [1, wkt]);
      
      const [retrieved] = await query(`
        SELECT ST_AsText(field_geometry) as geometry_wkt
        FROM test_burn_fields
        WHERE field_id = ?
      `, [result.insertId]);
      
      expect(retrieved[0].geometry_wkt).toContain('POLYGON');
      expect(retrieved[0].geometry_wkt).toContain('-120.5 40');
    });

    test('Should validate spatial reference system (SRID 4326)', async () => {
      const [result] = await query(`
        INSERT INTO test_burn_fields (farm_id, field_geometry)
        VALUES (?, ST_GeomFromText('POINT(-120.0 40.0)', 4326))
      `, [1]);
      
      const [srid] = await query(`
        SELECT ST_SRID(field_geometry) as srid
        FROM test_burn_fields
        WHERE field_id = ?
      `, [result.insertId]);
      
      expect(parseInt(srid[0].srid)).toBe(4326);
    });

    test('Should reject invalid geometries', async () => {
      const invalidGeometries = [
        'POLYGON((-120.0 40.0, -119.0 40.0))', // Not closed
        'POINT(200.0 100.0)', // Invalid coordinates
        'POLYGON((-120.0 40.0, -120.0 40.0, -120.0 40.0, -120.0 40.0))', // Degenerate
      ];
      
      for (const wkt of invalidGeometries) {
        try {
          await query(`
            INSERT INTO test_burn_fields (farm_id, field_geometry)
            VALUES (?, ST_GeomFromText(?, 4326))
          `, [1, wkt]);
          expect(true).toBe(false); // Should not succeed
        } catch (error) {
          expect(error.message).toMatch(/geometry|invalid|polygon/i);
        }
      }
    });

    test('Should calculate area for polygon geometries', async () => {
      // 1km x 1km square (approximately 100 hectares)
      const squareWkt = 'POLYGON((-120.0 40.0, -119.991 40.0, -119.991 40.009, -120.0 40.009, -120.0 40.0))';
      
      const [result] = await query(`
        INSERT INTO test_burn_fields (farm_id, field_geometry)
        VALUES (?, ST_GeomFromText(?, 4326))
      `, [1, squareWkt]);
      
      const [area] = await query(`
        SELECT ST_Area(ST_Transform(field_geometry, 3857)) / 10000 as area_hectares
        FROM test_burn_fields
        WHERE field_id = ?
      `, [result.insertId]);
      
      // Should be approximately 100 hectares
      expect(parseFloat(area[0].area_hectares)).toBeCloseTo(100, 0);
    });
  });

  describe('Spatial Indexing and Performance', () => {
    test('Should use spatial index for geometric queries', async () => {
      // Insert multiple fields
      for (let i = 0; i < 10; i++) {
        const lon = -120.0 + i * 0.01;
        const lat = 40.0 + i * 0.01;
        const wkt = `POLYGON((${lon} ${lat}, ${lon+0.005} ${lat}, ${lon+0.005} ${lat+0.005}, ${lon} ${lat+0.005}, ${lon} ${lat}))`;
        
        await query(`
          INSERT INTO test_burn_fields (farm_id, field_geometry)
          VALUES (?, ST_GeomFromText(?, 4326))
        `, [i, wkt]);
      }
      
      // Query using spatial index
      const searchArea = 'POLYGON((-120.02 39.98, -119.98 39.98, -119.98 40.02, -120.02 40.02, -120.02 39.98))';
      
      const [explain] = await query(`
        EXPLAIN SELECT field_id 
        FROM test_burn_fields 
        WHERE ST_Intersects(field_geometry, ST_GeomFromText(?, 4326))
      `, [searchArea]);
      
      // Should show spatial index usage
      const planText = JSON.stringify(explain);
      expect(planText.toLowerCase()).toMatch(/spatial|index/);
    });

    test('Should efficiently find nearby burn fields', async () => {
      // Insert test fields in grid pattern
      const fields = [];
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          const lon = -120.0 + x * 0.01;
          const lat = 40.0 + y * 0.01;
          const wkt = `POINT(${lon} ${lat})`;
          
          const [result] = await query(`
            INSERT INTO test_burn_fields (farm_id, field_geometry)
            VALUES (?, ST_GeomFromText(?, 4326))
          `, [1, wkt]);
          
          fields.push({ id: result.insertId, x, y });
        }
      }
      
      // Find fields within 1.5km of center
      const centerPoint = 'POINT(-119.98 40.02)';
      const startTime = Date.now();
      
      const [nearby] = await query(`
        SELECT 
          field_id,
          ST_Distance_Sphere(field_geometry, ST_GeomFromText(?, 4326)) as distance_meters
        FROM test_burn_fields
        WHERE ST_Distance_Sphere(field_geometry, ST_GeomFromText(?, 4326)) < 1500
        ORDER BY distance_meters
      `, [centerPoint, centerPoint]);
      
      const duration = Date.now() - startTime;
      
      expect(nearby.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100); // Should be fast with spatial index
      
      nearby.forEach(field => {
        expect(parseFloat(field.distance_meters)).toBeLessThan(1500);
      });
    });

    test('Should optimize spatial joins between tables', async () => {
      // Insert burn fields
      await query(`
        INSERT INTO test_burn_fields (farm_id, field_geometry, area_hectares)
        VALUES (?, ST_GeomFromText('POLYGON((-120.0 40.0, -119.99 40.0, -119.99 40.01, -120.0 40.01, -120.0 40.0))', 4326), ?)
      `, [1, 50.0]);
      
      // Insert population center
      await query(`
        INSERT INTO test_population_centers (name, location, population)
        VALUES (?, ST_GeomFromText('POINT(-119.995 40.005)', 4326), ?)
      `, ['Test Town', 5000]);
      
      // Spatial join to find populated areas near burns
      const [joined] = await query(`
        SELECT 
          bf.field_id,
          pc.name,
          pc.population,
          ST_Distance_Sphere(bf.field_geometry, pc.location) as distance_meters
        FROM test_burn_fields bf
        JOIN test_population_centers pc
        ON ST_Distance_Sphere(bf.field_geometry, pc.location) < 2000
      `);
      
      expect(joined.length).toBeGreaterThan(0);
      expect(joined[0].name).toBe('Test Town');
      expect(parseFloat(joined[0].distance_meters)).toBeLessThan(2000);
    });
  });

  describe('Distance and Proximity Calculations', () => {
    test('Should calculate spherical distances between points', async () => {
      // Insert two points 1km apart
      const point1 = 'POINT(-120.0 40.0)';
      const point2 = 'POINT(-120.009 40.0)'; // ~1km east
      
      await query(`
        INSERT INTO test_burn_fields (farm_id, field_geometry) VALUES 
        (?, ST_GeomFromText(?, 4326)),
        (?, ST_GeomFromText(?, 4326))
      `, [1, point1, 2, point2]);
      
      const [distance] = await query(`
        SELECT ST_Distance_Sphere(
          (SELECT field_geometry FROM test_burn_fields WHERE farm_id = 1),
          (SELECT field_geometry FROM test_burn_fields WHERE farm_id = 2)
        ) as distance_meters
      `);
      
      // Should be approximately 1000 meters
      expect(parseFloat(distance[0].distance_meters)).toBeCloseTo(1000, -1);
    });

    test('Should find fields within smoke dispersion radius', async () => {
      // Central burn field
      await query(`
        INSERT INTO test_burn_fields (farm_id, field_name, field_geometry, area_hectares)
        VALUES (?, ?, ST_GeomFromText('POINT(-120.0 40.0)', 4326), ?)
      `, [1, 'Burn Source', 200]);
      
      // Surrounding fields at various distances
      const surroundingFields = [
        { name: 'Near Field', point: 'POINT(-119.995 40.0)', distance: 0.5 }, // ~500m
        { name: 'Medium Field', point: 'POINT(-119.99 40.0)', distance: 1.0 }, // ~1km
        { name: 'Far Field', point: 'POINT(-119.98 40.0)', distance: 2.0 }, // ~2km
      ];
      
      for (let i = 0; i < surroundingFields.length; i++) {
        await query(`
          INSERT INTO test_burn_fields (farm_id, field_name, field_geometry)
          VALUES (?, ?, ST_GeomFromText(?, 4326))
        `, [i + 2, surroundingFields[i].name, surroundingFields[i].point]);
      }
      
      // Find fields within 1.5km smoke dispersion radius
      const smokePlume = 'POINT(-120.0 40.0)';
      const radius = 1500; // meters
      
      const [affected] = await query(`
        SELECT 
          field_name,
          ST_Distance_Sphere(field_geometry, ST_GeomFromText(?, 4326)) as distance_meters
        FROM test_burn_fields
        WHERE ST_Distance_Sphere(field_geometry, ST_GeomFromText(?, 4326)) <= ?
          AND field_name != 'Burn Source'
        ORDER BY distance_meters
      `, [smokePlume, smokePlume, radius]);
      
      expect(affected.length).toBe(2); // Near and Medium fields
      expect(affected[0].field_name).toBe('Near Field');
      expect(affected[1].field_name).toBe('Medium Field');
    });

    test('Should calculate minimum distance between polygon boundaries', async () => {
      // Two adjacent fields
      const field1 = 'POLYGON((-120.0 40.0, -119.99 40.0, -119.99 40.01, -120.0 40.01, -120.0 40.0))';
      const field2 = 'POLYGON((-119.985 40.0, -119.975 40.0, -119.975 40.01, -119.985 40.01, -119.985 40.0))';
      
      await query(`
        INSERT INTO test_burn_fields (farm_id, field_geometry) VALUES 
        (?, ST_GeomFromText(?, 4326)),
        (?, ST_GeomFromText(?, 4326))
      `, [1, field1, 2, field2]);
      
      const [minDistance] = await query(`
        SELECT ST_Distance_Sphere(
          (SELECT field_geometry FROM test_burn_fields WHERE farm_id = 1),
          (SELECT field_geometry FROM test_burn_fields WHERE farm_id = 2)
        ) as min_distance_meters
      `);
      
      // Should be about 500 meters (gap between fields)
      expect(parseFloat(minDistance[0].min_distance_meters)).toBeCloseTo(500, -1);
    });

    test('Should identify fields within safety buffer zones', async () => {
      // Population center with safety buffer
      await query(`
        INSERT INTO test_population_centers (name, location, population, buffer_zone)
        VALUES (
          ?, 
          ST_GeomFromText('POINT(-120.0 40.0)', 4326), 
          ?,
          ST_Buffer(ST_GeomFromText('POINT(-120.0 40.0)', 4326), 0.01)
        )
      `, ['Safety Zone', 10000]);
      
      // Fields at various positions
      const testFields = [
        { name: 'Inside Buffer', point: 'POINT(-119.998 40.0)' },
        { name: 'On Buffer Edge', point: 'POINT(-119.99 40.0)' },
        { name: 'Outside Buffer', point: 'POINT(-119.98 40.0)' },
      ];
      
      for (let i = 0; i < testFields.length; i++) {
        await query(`
          INSERT INTO test_burn_fields (farm_id, field_name, field_geometry)
          VALUES (?, ?, ST_GeomFromText(?, 4326))
        `, [i + 1, testFields[i].name, testFields[i].point]);
      }
      
      // Find fields within buffer zone
      const [withinBuffer] = await query(`
        SELECT bf.field_name
        FROM test_burn_fields bf
        JOIN test_population_centers pc ON ST_Within(bf.field_geometry, pc.buffer_zone)
        WHERE pc.name = 'Safety Zone'
      `);
      
      expect(withinBuffer.length).toBeGreaterThan(0);
      expect(withinBuffer.some(f => f.field_name === 'Inside Buffer')).toBeTruthy();
    });
  });

  describe('Geometric Intersections and Overlaps', () => {
    test('Should detect smoke plume polygon intersections', async () => {
      // Overlapping smoke zones from different burns
      const smoke1 = 'POLYGON((-120.0 40.0, -119.99 40.0, -119.99 40.01, -120.0 40.01, -120.0 40.0))';
      const smoke2 = 'POLYGON((-119.995 39.995, -119.985 39.995, -119.985 40.005, -119.995 40.005, -119.995 39.995))';
      
      await query(`
        INSERT INTO test_smoke_zones (burn_request_id, smoke_polygon, pm25_level) VALUES 
        (?, ST_GeomFromText(?, 4326), ?),
        (?, ST_GeomFromText(?, 4326), ?)
      `, [1, smoke1, 45.0, 2, smoke2, 35.0]);
      
      // Find intersecting smoke zones
      const [intersections] = await query(`
        SELECT 
          s1.burn_request_id as burn1,
          s2.burn_request_id as burn2,
          s1.pm25_level + s2.pm25_level as combined_pm25,
          ST_Area(ST_Intersection(s1.smoke_polygon, s2.smoke_polygon)) as overlap_area
        FROM test_smoke_zones s1
        JOIN test_smoke_zones s2 ON s1.burn_request_id < s2.burn_request_id
        WHERE ST_Intersects(s1.smoke_polygon, s2.smoke_polygon)
      `);
      
      expect(intersections.length).toBe(1);
      expect(intersections[0].burn1).toBe(1);
      expect(intersections[0].burn2).toBe(2);
      expect(parseFloat(intersections[0].combined_pm25)).toBe(80.0);
      expect(parseFloat(intersections[0].overlap_area)).toBeGreaterThan(0);
    });

    test('Should calculate intersection area between burn field and smoke plume', async () => {
      const burnField = 'POLYGON((-120.0 40.0, -119.99 40.0, -119.99 40.01, -120.0 40.01, -120.0 40.0))';
      const smokePlume = 'POLYGON((-119.995 39.995, -119.985 39.995, -119.985 40.015, -119.995 40.015, -119.995 39.995))';
      
      await query(`
        INSERT INTO test_burn_fields (farm_id, field_geometry, area_hectares)
        VALUES (?, ST_GeomFromText(?, 4326), ?)
      `, [1, burnField, 100]);
      
      await query(`
        INSERT INTO test_smoke_zones (burn_request_id, smoke_polygon, pm25_level)
        VALUES (?, ST_GeomFromText(?, 4326), ?)
      `, [1, smokePlume, 50]);
      
      const [intersection] = await query(`
        SELECT 
          ST_Area(ST_Intersection(bf.field_geometry, sz.smoke_polygon)) as intersection_area,
          ST_Area(bf.field_geometry) as field_area,
          (ST_Area(ST_Intersection(bf.field_geometry, sz.smoke_polygon)) / ST_Area(bf.field_geometry)) * 100 as coverage_percent
        FROM test_burn_fields bf
        CROSS JOIN test_smoke_zones sz
        WHERE ST_Intersects(bf.field_geometry, sz.smoke_polygon)
      `);
      
      expect(intersection.length).toBe(1);
      expect(parseFloat(intersection[0].intersection_area)).toBeGreaterThan(0);
      expect(parseFloat(intersection[0].coverage_percent)).toBeGreaterThan(0);
      expect(parseFloat(intersection[0].coverage_percent)).toBeLessThanOrEqual(100);
    });

    test('Should detect complete containment of smaller areas', async () => {
      const largeField = 'POLYGON((-120.01 39.99, -119.98 39.99, -119.98 40.02, -120.01 40.02, -120.01 39.99))';
      const smallField = 'POLYGON((-120.0 40.0, -119.99 40.0, -119.99 40.01, -120.0 40.01, -120.0 40.0))';
      
      await query(`
        INSERT INTO test_burn_fields (farm_id, field_name, field_geometry) VALUES 
        (?, ?, ST_GeomFromText(?, 4326)),
        (?, ?, ST_GeomFromText(?, 4326))
      `, [1, 'Large Field', largeField, 2, 'Small Field', smallField]);
      
      const [containment] = await query(`
        SELECT 
          large.field_name as container,
          small.field_name as contained
        FROM test_burn_fields large
        JOIN test_burn_fields small ON large.farm_id != small.farm_id
        WHERE ST_Contains(large.field_geometry, small.field_geometry)
      `);
      
      expect(containment.length).toBe(1);
      expect(containment[0].container).toBe('Large Field');
      expect(containment[0].contained).toBe('Small Field');
    });

    test('Should identify touching but non-overlapping geometries', async () => {
      // Adjacent fields sharing a boundary
      const field1 = 'POLYGON((-120.0 40.0, -119.99 40.0, -119.99 40.01, -120.0 40.01, -120.0 40.0))';
      const field2 = 'POLYGON((-119.99 40.0, -119.98 40.0, -119.98 40.01, -119.99 40.01, -119.99 40.0))';
      
      await query(`
        INSERT INTO test_burn_fields (farm_id, field_geometry) VALUES 
        (?, ST_GeomFromText(?, 4326)),
        (?, ST_GeomFromText(?, 4326))
      `, [1, field1, 2, field2]);
      
      const [touching] = await query(`
        SELECT 
          f1.farm_id as field1,
          f2.farm_id as field2,
          ST_Touches(f1.field_geometry, f2.field_geometry) as touches,
          ST_Intersects(f1.field_geometry, f2.field_geometry) as intersects,
          ST_Overlaps(f1.field_geometry, f2.field_geometry) as overlaps
        FROM test_burn_fields f1
        JOIN test_burn_fields f2 ON f1.farm_id < f2.farm_id
      `);
      
      expect(touching.length).toBe(1);
      expect(touching[0].touches).toBe(1); // Fields touch
      expect(touching[0].intersects).toBe(1); // Boundary intersection
      expect(touching[0].overlaps).toBe(0); // No area overlap
    });
  });

  describe('Coordinate System Transformations', () => {
    test('Should transform between WGS84 and projected coordinates', async () => {
      const wgs84Point = 'POINT(-120.0 40.0)';
      
      await query(`
        INSERT INTO test_burn_fields (farm_id, field_geometry)
        VALUES (?, ST_GeomFromText(?, 4326))
      `, [1, wgs84Point]);
      
      const [transformed] = await query(`
        SELECT 
          ST_X(field_geometry) as wgs84_x,
          ST_Y(field_geometry) as wgs84_y,
          ST_X(ST_Transform(field_geometry, 3857)) as mercator_x,
          ST_Y(ST_Transform(field_geometry, 3857)) as mercator_y
        FROM test_burn_fields
        WHERE farm_id = 1
      `);
      
      expect(parseFloat(transformed[0].wgs84_x)).toBeCloseTo(-120.0, 5);
      expect(parseFloat(transformed[0].wgs84_y)).toBeCloseTo(40.0, 5);
      expect(Math.abs(parseFloat(transformed[0].mercator_x))).toBeGreaterThan(10000000); // Large Mercator values
      expect(Math.abs(parseFloat(transformed[0].mercator_y))).toBeGreaterThan(1000000);
    });

    test('Should calculate accurate areas using projected coordinates', async () => {
      // 1 hectare field (100m x 100m)
      const fieldWkt = 'POLYGON((-120.0 40.0, -120.0009 40.0, -120.0009 40.0009, -120.0 40.0009, -120.0 40.0))';
      
      await query(`
        INSERT INTO test_burn_fields (farm_id, field_geometry)
        VALUES (?, ST_GeomFromText(?, 4326))
      `, [1, fieldWkt]);
      
      const [areas] = await query(`
        SELECT 
          ST_Area(field_geometry) as wgs84_area,
          ST_Area(ST_Transform(field_geometry, 3857)) as mercator_area_sqm,
          ST_Area(ST_Transform(field_geometry, 3857)) / 10000 as mercator_area_hectares
        FROM test_burn_fields
        WHERE farm_id = 1
      `);
      
      // WGS84 area in degrees² (not meaningful)
      expect(parseFloat(areas[0].wgs84_area)).toBeGreaterThan(0);
      
      // Mercator area should be approximately 1 hectare
      expect(parseFloat(areas[0].mercator_area_hectares)).toBeCloseTo(1.0, 0);
    });

    test('Should handle coordinate precision for small geometries', async () => {
      // Very precise coordinates (6 decimal places = ~0.1m precision)
      const precisePoint = 'POINT(-120.123456 40.654321)';
      
      await query(`
        INSERT INTO test_burn_fields (farm_id, field_geometry)
        VALUES (?, ST_GeomFromText(?, 4326))
      `, [1, precisePoint]);
      
      const [precision] = await query(`
        SELECT 
          ST_X(field_geometry) as longitude,
          ST_Y(field_geometry) as latitude,
          ROUND(ST_X(field_geometry), 6) as rounded_lon,
          ROUND(ST_Y(field_geometry), 6) as rounded_lat
        FROM test_burn_fields
        WHERE farm_id = 1
      `);
      
      expect(parseFloat(precision[0].longitude)).toBe(-120.123456);
      expect(parseFloat(precision[0].latitude)).toBe(40.654321);
      expect(parseFloat(precision[0].rounded_lon)).toBe(-120.123456);
      expect(parseFloat(precision[0].rounded_lat)).toBe(40.654321);
    });
  });

  describe('Spatial Aggregation and Analysis', () => {
    test('Should calculate union of multiple burn field geometries', async () => {
      // Adjacent fields that can be combined
      const fields = [
        'POLYGON((-120.0 40.0, -119.99 40.0, -119.99 40.01, -120.0 40.01, -120.0 40.0))',
        'POLYGON((-119.99 40.0, -119.98 40.0, -119.98 40.01, -119.99 40.01, -119.99 40.0))',
        'POLYGON((-120.0 39.99, -119.99 39.99, -119.99 40.0, -120.0 40.0, -120.0 39.99))',
      ];
      
      for (let i = 0; i < fields.length; i++) {
        await query(`
          INSERT INTO test_burn_fields (farm_id, field_geometry, area_hectares)
          VALUES (?, ST_GeomFromText(?, 4326), ?)
        `, [i + 1, fields[i], 100]);
      }
      
      const [union] = await query(`
        SELECT 
          ST_AsText(ST_Union(field_geometry)) as combined_geometry,
          ST_Area(ST_Transform(ST_Union(field_geometry), 3857)) / 10000 as total_hectares,
          COUNT(*) as field_count
        FROM test_burn_fields
      `);
      
      expect(union[0].combined_geometry).toContain('POLYGON');
      expect(parseFloat(union[0].total_hectares)).toBeCloseTo(300, 0); // 3 fields × 100 hectares
      expect(parseInt(union[0].field_count)).toBe(3);
    });

    test('Should find centroid of complex burn area', async () => {
      // L-shaped burn area
      const complexField = `
        POLYGON((
          -120.0 40.0, -119.99 40.0, -119.99 40.005, 
          -119.995 40.005, -119.995 40.01, -120.0 40.01, 
          -120.0 40.0
        ))
      `;
      
      await query(`
        INSERT INTO test_burn_fields (farm_id, field_geometry)
        VALUES (?, ST_GeomFromText(?, 4326))
      `, [1, complexField]);
      
      const [centroid] = await query(`
        SELECT 
          ST_X(ST_Centroid(field_geometry)) as centroid_lon,
          ST_Y(ST_Centroid(field_geometry)) as centroid_lat,
          ST_AsText(ST_Centroid(field_geometry)) as centroid_wkt
        FROM test_burn_fields
        WHERE farm_id = 1
      `);
      
      expect(parseFloat(centroid[0].centroid_lon)).toBeCloseTo(-119.995, 3);
      expect(parseFloat(centroid[0].centroid_lat)).toBeCloseTo(40.005, 3);
      expect(centroid[0].centroid_wkt).toContain('POINT');
    });

    test('Should calculate convex hull for scattered burn locations', async () => {
      // Scattered points representing burn locations
      const burnPoints = [
        'POINT(-120.0 40.0)',
        'POINT(-119.99 40.01)',
        'POINT(-119.985 39.995)',
        'POINT(-120.005 40.008)',
        'POINT(-119.992 40.003)',
      ];
      
      for (let i = 0; i < burnPoints.length; i++) {
        await query(`
          INSERT INTO test_burn_fields (farm_id, field_geometry)
          VALUES (?, ST_GeomFromText(?, 4326))
        `, [i + 1, burnPoints[i]]);
      }
      
      const [hull] = await query(`
        SELECT 
          ST_AsText(ST_ConvexHull(ST_Collect(field_geometry))) as convex_hull,
          ST_Area(ST_Transform(ST_ConvexHull(ST_Collect(field_geometry)), 3857)) as hull_area_sqm
        FROM test_burn_fields
      `);
      
      expect(hull[0].convex_hull).toContain('POLYGON');
      expect(parseFloat(hull[0].hull_area_sqm)).toBeGreaterThan(0);
    });

    test('Should identify spatial clusters of burn activities', async () => {
      // Two clusters of burn fields
      const cluster1Fields = [
        'POINT(-120.0 40.0)',
        'POINT(-120.001 40.001)',
        'POINT(-119.999 39.999)',
      ];
      
      const cluster2Fields = [
        'POINT(-119.95 40.05)',
        'POINT(-119.951 40.051)',
        'POINT(-119.949 40.049)',
      ];
      
      const allFields = [...cluster1Fields, ...cluster2Fields];
      
      for (let i = 0; i < allFields.length; i++) {
        await query(`
          INSERT INTO test_burn_fields (farm_id, field_geometry)
          VALUES (?, ST_GeomFromText(?, 4326))
        `, [i + 1, allFields[i]]);
      }
      
      // Find fields within 500m clusters
      const clusterRadius = 500; // meters
      
      const [clusters] = await query(`
        SELECT 
          f1.farm_id as center_field,
          COUNT(f2.farm_id) as nearby_fields,
          ST_AsText(ST_Centroid(ST_Collect(f2.field_geometry))) as cluster_center
        FROM test_burn_fields f1
        JOIN test_burn_fields f2 ON ST_Distance_Sphere(f1.field_geometry, f2.field_geometry) <= ?
        GROUP BY f1.farm_id
        HAVING COUNT(f2.farm_id) >= 3
        ORDER BY nearby_fields DESC
      `, [clusterRadius]);
      
      expect(clusters.length).toBeGreaterThanOrEqual(2); // Two cluster centers
      clusters.forEach(cluster => {
        expect(parseInt(cluster.nearby_fields)).toBeGreaterThanOrEqual(3);
        expect(cluster.cluster_center).toContain('POINT');
      });
    });
  });

  describe('Spatial Data Quality and Validation', () => {
    test('Should validate geometry topology', async () => {
      const validPolygon = 'POLYGON((-120.0 40.0, -119.99 40.0, -119.99 40.01, -120.0 40.01, -120.0 40.0))';
      const invalidPolygon = 'POLYGON((-120.0 40.0, -119.99 40.01, -119.99 40.0, -120.0 40.01, -120.0 40.0))'; // Self-intersecting
      
      // Valid polygon should work
      const [validResult] = await query(`
        SELECT ST_IsValid(ST_GeomFromText(?, 4326)) as is_valid
      `, [validPolygon]);
      
      expect(parseInt(validResult[0].is_valid)).toBe(1);
      
      // Invalid polygon check
      const [invalidResult] = await query(`
        SELECT ST_IsValid(ST_GeomFromText(?, 4326)) as is_valid
      `, [invalidPolygon]);
      
      expect(parseInt(invalidResult[0].is_valid)).toBe(0);
    });

    test('Should detect and fix small geometry gaps', async () => {
      // Nearly adjacent polygons with tiny gap
      const poly1 = 'POLYGON((-120.0 40.0, -119.99 40.0, -119.99 40.01, -120.0 40.01, -120.0 40.0))';
      const poly2 = 'POLYGON((-119.9899 40.0, -119.98 40.0, -119.98 40.01, -119.9899 40.01, -119.9899 40.0))';
      
      await query(`
        INSERT INTO test_burn_fields (farm_id, field_geometry) VALUES 
        (?, ST_GeomFromText(?, 4326)),
        (?, ST_GeomFromText(?, 4326))
      `, [1, poly1, 2, poly2]);
      
      // Check if fields are within snapping tolerance
      const tolerance = 0.0002; // ~20 meters
      
      const [snapped] = await query(`
        SELECT 
          f1.farm_id,
          f2.farm_id,
          ST_Distance(f1.field_geometry, f2.field_geometry) as gap_degrees,
          ST_Distance_Sphere(f1.field_geometry, f2.field_geometry) as gap_meters
        FROM test_burn_fields f1
        JOIN test_burn_fields f2 ON f1.farm_id < f2.farm_id
        WHERE ST_Distance(f1.field_geometry, f2.field_geometry) < ?
      `, [tolerance]);
      
      expect(snapped.length).toBe(1);
      expect(parseFloat(snapped[0].gap_meters)).toBeLessThan(50); // Small gap
    });

    test('Should validate coordinate bounds for burn regions', async () => {
      const testPoints = [
        { name: 'Valid California', point: 'POINT(-120.0 40.0)', valid: true },
        { name: 'Invalid Longitude', point: 'POINT(-200.0 40.0)', valid: false },
        { name: 'Invalid Latitude', point: 'POINT(-120.0 100.0)', valid: false },
        { name: 'Valid Oregon', point: 'POINT(-123.0 45.0)', valid: true },
      ];
      
      for (const test of testPoints) {
        try {
          const [result] = await query(`
            SELECT 
              ST_X(ST_GeomFromText(?, 4326)) as longitude,
              ST_Y(ST_GeomFromText(?, 4326)) as latitude,
              (ST_X(ST_GeomFromText(?, 4326)) BETWEEN -180 AND 180) AND
              (ST_Y(ST_GeomFromText(?, 4326)) BETWEEN -90 AND 90) as within_bounds
            FROM DUAL
          `, [test.point, test.point, test.point, test.point]);
          
          if (test.valid) {
            expect(parseInt(result[0].within_bounds)).toBe(1);
          }
        } catch (error) {
          if (!test.valid) {
            expect(error.message).toMatch(/coordinate|range|invalid/i);
          } else {
            throw error;
          }
        }
      }
    });

    test('Should ensure minimum area thresholds for burn fields', async () => {
      // Various field sizes
      const fieldSizes = [
        { name: 'Too Small', size: 0.0001, valid: false }, // < 1 hectare
        { name: 'Minimum Size', size: 0.001, valid: true }, // ~10 hectares
        { name: 'Normal Size', size: 0.01, valid: true }, // ~100 hectares
        { name: 'Large Field', size: 0.1, valid: true }, // ~1000 hectares
      ];
      
      for (const field of fieldSizes) {
        const size = field.size;
        const wkt = `POLYGON((
          -120.0 40.0, 
          ${-120.0 + size} 40.0, 
          ${-120.0 + size} ${40.0 + size}, 
          -120.0 ${40.0 + size}, 
          -120.0 40.0
        ))`;
        
        const [result] = await query(`
          INSERT INTO test_burn_fields (farm_id, field_name, field_geometry)
          VALUES (?, ?, ST_GeomFromText(?, 4326))
        `, [fieldSizes.indexOf(field) + 1, field.name, wkt]);
        
        const [area] = await query(`
          SELECT 
            ST_Area(ST_Transform(field_geometry, 3857)) / 10000 as area_hectares
          FROM test_burn_fields
          WHERE field_id = ?
        `, [result.insertId]);
        
        const areaHectares = parseFloat(area[0].area_hectares);
        
        if (field.valid) {
          expect(areaHectares).toBeGreaterThan(1); // Minimum 1 hectare for burns
        } else {
          expect(areaHectares).toBeLessThan(1);
        }
      }
    });
  });

  describe('Performance Optimization', () => {
    test('Should efficiently process large spatial datasets', async () => {
      // Insert many burn fields
      const fieldCount = 100;
      const startTime = Date.now();
      
      for (let i = 0; i < fieldCount; i++) {
        const lon = -120.0 + (i % 10) * 0.01;
        const lat = 40.0 + Math.floor(i / 10) * 0.01;
        const wkt = `POLYGON((${lon} ${lat}, ${lon+0.005} ${lat}, ${lon+0.005} ${lat+0.005}, ${lon} ${lat+0.005}, ${lon} ${lat}))`;
        
        await query(`
          INSERT INTO test_burn_fields (farm_id, field_geometry, area_hectares)
          VALUES (?, ST_GeomFromText(?, 4326), ?)
        `, [i, wkt, 50]);
      }
      
      const insertTime = Date.now() - startTime;
      
      // Query performance test
      const queryStart = Date.now();
      const searchArea = 'POLYGON((-120.05 39.95, -119.95 39.95, -119.95 40.05, -120.05 40.05, -120.05 39.95))';
      
      const [results] = await query(`
        SELECT 
          COUNT(*) as field_count,
          SUM(area_hectares) as total_area
        FROM test_burn_fields
        WHERE ST_Intersects(field_geometry, ST_GeomFromText(?, 4326))
      `, [searchArea]);
      
      const queryTime = Date.now() - queryStart;
      
      expect(parseInt(results[0].field_count)).toBeGreaterThan(0);
      expect(insertTime).toBeLessThan(10000); // Insert should complete in reasonable time
      expect(queryTime).toBeLessThan(1000); // Query should be fast with spatial index
    });

    test('Should optimize spatial joins with proper indexing', async () => {
      // Create indexed test data
      await query(`
        INSERT INTO test_burn_fields (farm_id, field_geometry, area_hectares) VALUES
        (1, ST_GeomFromText('POLYGON((-120.0 40.0, -119.99 40.0, -119.99 40.01, -120.0 40.01, -120.0 40.0))', 4326), 100),
        (2, ST_GeomFromText('POLYGON((-119.98 40.02, -119.97 40.02, -119.97 40.03, -119.98 40.03, -119.98 40.02))', 4326), 75)
      `);
      
      await query(`
        INSERT INTO test_population_centers (name, location, population) VALUES
        ('Town A', ST_GeomFromText('POINT(-119.995 40.005)', 4326), 5000),
        ('Town B', ST_GeomFromText('POINT(-119.975 40.025)', 4326), 3000)
      `);
      
      const startTime = Date.now();
      
      const [joinResults] = await query(`
        SELECT 
          bf.farm_id,
          pc.name,
          pc.population,
          ST_Distance_Sphere(bf.field_geometry, pc.location) as distance_meters
        FROM test_burn_fields bf
        JOIN test_population_centers pc 
        ON ST_Distance_Sphere(bf.field_geometry, pc.location) < 5000
        ORDER BY distance_meters
      `);
      
      const joinTime = Date.now() - startTime;
      
      expect(joinResults.length).toBeGreaterThan(0);
      expect(joinTime).toBeLessThan(500); // Should be fast with spatial indexes
      
      joinResults.forEach(result => {
        expect(parseFloat(result.distance_meters)).toBeLessThan(5000);
      });
    });
  });
});

module.exports = {
  // Helper functions for spatial testing
  createTestPolygon: (centerLon, centerLat, sizeKm = 1) => {
    const degPerKm = 0.009; // Approximate at mid-latitudes
    const halfSize = (sizeKm * degPerKm) / 2;
    
    return `POLYGON((
      ${centerLon - halfSize} ${centerLat - halfSize},
      ${centerLon + halfSize} ${centerLat - halfSize},
      ${centerLon + halfSize} ${centerLat + halfSize},
      ${centerLon - halfSize} ${centerLat + halfSize},
      ${centerLon - halfSize} ${centerLat - halfSize}
    ))`;
  },
  
  calculateDistance: (lon1, lat1, lon2, lat2) => {
    // Haversine distance in meters
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  },
  
  isValidCoordinate: (lon, lat) => {
    return lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90;
  },
  
  generateSmokePolygon: (centerLon, centerLat, windDirection, windSpeed, burnArea) => {
    // Generate elliptical smoke plume based on wind
    const baseRadius = Math.sqrt(burnArea) * 0.01; // Base on burn area
    const elongation = windSpeed / 10; // Wind stretches plume
    
    const radians = windDirection * Math.PI / 180;
    const longRadius = baseRadius * (1 + elongation);
    const shortRadius = baseRadius;
    
    // Create ellipse points
    const points = [];
    for (let i = 0; i <= 16; i++) {
      const angle = (i * 2 * Math.PI) / 16;
      const x = longRadius * Math.cos(angle);
      const y = shortRadius * Math.sin(angle);
      
      // Rotate by wind direction
      const rotX = x * Math.cos(radians) - y * Math.sin(radians);
      const rotY = x * Math.sin(radians) + y * Math.cos(radians);
      
      points.push(`${centerLon + rotX} ${centerLat + rotY}`);
    }
    
    return `POLYGON((${points.join(', ')}))`;
  }
};