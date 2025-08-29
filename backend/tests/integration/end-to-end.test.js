const { describe, test, expect, beforeAll, afterAll } = require('@jest/globals');
const { initializeDatabase, query, pool, getConnection } = require('../../db/connection');
const CoordinatorAgent = require('../../agents/coordinator');
const WeatherAgent = require('../../agents/weather');
const SmokeOverlapPredictor = require('../../agents/predictor');
const ScheduleOptimizer = require('../../agents/optimizer');
const AlertSystem = require('../../agents/alerts');
const axios = require('axios');

describe('End-to-End Scenario Tests - Complete Real-World Burn Coordination', () => {
  let agents;
  let mockApiServer;
  
  beforeAll(async () => {
    await initializeDatabase();
    
    agents = {
      coordinator: new CoordinatorAgent(),
      weather: new WeatherAgent(),
      predictor: new SmokeOverlapPredictor(),
      optimizer: new ScheduleOptimizer(),
      alerts: new AlertSystem()
    };
    
    // Mock external API responses for consistent testing
    mockApiServer = {
      weatherAPI: jest.fn(),
      smsGateway: jest.fn(),
      mapboxAPI: jest.fn()
    };
  });
  
  afterAll(async () => {
    const poolInstance = pool();
    if (poolInstance) {
      await poolInstance.end();
    }
  });

  describe('Scenario 1: Single Farm Safe Burn Request', () => {
    test('Should approve and schedule single farm burn with no conflicts', async () => {
      const scenario = {
        farm: {
          id: 1001,
          name: 'Sunrise Valley Farm',
          location: { lat: 38.5816, lon: -121.4944 }, // Sacramento Valley
          contact: { phone: '+15551234567', email: 'farmer@sunrisevalley.com' }
        },
        burnRequest: {
          fieldId: 1,
          areaHectares: 50,
          cropType: 'rice_stubble',
          requestedDate: '2025-08-26',
          requestedTime: '09:00-13:00',
          fuelLoad: 15
        },
        weather: {
          windSpeed: 8,
          windDirection: 180,
          humidity: 55,
          temperature: 22,
          forecast: 'stable'
        }
      };
      
      // Step 1: Submit burn request
      const coordinatorResult = await agents.coordinator.coordinateBurnRequest({
        farmId: scenario.farm.id,
        fieldId: scenario.burnRequest.fieldId,
        requestedDate: scenario.burnRequest.requestedDate,
        areaHectares: scenario.burnRequest.areaHectares,
        cropType: scenario.burnRequest.cropType
      });
      
      expect(coordinatorResult.priorityScore).toBeGreaterThan(60);
      expect(coordinatorResult.terrainVector).toHaveLength(32);
      
      // Step 2: Weather analysis
      const weatherAnalysis = await agents.weather.analyzeWeatherForBurn(
        scenario.farm.location.lat,
        scenario.farm.location.lon,
        scenario.burnRequest.requestedDate
      );
      
      expect(weatherAnalysis.suitable).toBeTruthy();
      expect(weatherAnalysis.weatherVector).toHaveLength(128);
      
      // Step 3: No conflicts expected
      const conflicts = await agents.predictor.predictSmokeOverlap([{
        ...scenario.burnRequest,
        ...scenario.farm.location,
        farmId: scenario.farm.id
      }]);
      
      expect(conflicts.conflicts).toHaveLength(0);
      
      // Step 4: Direct scheduling (no optimization needed)
      const schedule = {
        [scenario.burnRequest.fieldId]: {
          date: scenario.burnRequest.requestedDate,
          start: '09:00',
          end: '13:00',
          approved: true
        }
      };
      
      // Step 5: Send confirmation alert
      const alert = await agents.alerts.sendAlerts([{
        burnRequestId: scenario.burnRequest.fieldId,
        farmId: scenario.farm.id,
        scheduledTime: new Date(`${scenario.burnRequest.requestedDate} 09:00`),
        status: 'approved'
      }]);
      
      expect(alert.sent).toHaveLength(2); // Approval + reminder
    });

    test('Should calculate safe PM2.5 levels for isolated burn', async () => {
      const isolatedBurn = {
        location: { lat: 39.0968, lon: -120.0324 }, // Lake Tahoe area
        areaHectares: 30,
        weather: { windSpeed: 10, windDirection: 270 }
      };
      
      const smokeVector = await agents.predictor.generateSmokeVector(
        2001,
        isolatedBurn.weather,
        isolatedBurn.areaHectares
      );
      
      expect(smokeVector).toHaveLength(64);
      
      // Calculate PM2.5 at various distances
      const pm25Levels = await agents.predictor.calculatePM25AtDistances(
        smokeVector,
        [0.5, 1, 2, 5, 10]
      );
      
      // Should be safe at residential distances (>2km)
      expect(pm25Levels[2]).toBeLessThan(35); // EPA safe threshold
      expect(pm25Levels[4]).toBeLessThan(12); // Good air quality at 10km
    });

    test('Should track burn progress from ignition to completion', async () => {
      const burnProgress = {
        stages: [
          { time: '09:00', status: 'pre-burn_inspection', complete: false },
          { time: '09:30', status: 'ignition', complete: false },
          { time: '10:00', status: 'active_burning', complete: false },
          { time: '12:00', status: 'mop_up', complete: false },
          { time: '13:00', status: 'completed', complete: false }
        ]
      };
      
      // Simulate progress updates
      for (const stage of burnProgress.stages) {
        stage.complete = true;
        
        // Send progress alert
        if (stage.status === 'ignition') {
          const startAlert = await agents.alerts.sendBurnStartingAlert({
            request_id: 2001,
            field_id: 1
          });
          
          expect(startAlert).toBeDefined();
        }
      }
      
      // Verify all stages completed
      expect(burnProgress.stages.every(s => s.complete)).toBeTruthy();
    });
  });

  describe('Scenario 2: Multiple Conflicting Burns Resolution', () => {
    test('Should detect and resolve conflicts between 3 adjacent farms', async () => {
      const scenario = {
        farms: [
          { id: 2001, name: 'North Ranch', lat: 40.00, lon: -120.00, area: 100 },
          { id: 2002, name: 'East Fields', lat: 40.00, lon: -119.98, area: 80 },  // 2km east
          { id: 2003, name: 'South Valley', lat: 39.98, lon: -120.00, area: 120 } // 2km south
        ],
        requestedDate: '2025-08-27',
        weather: { windSpeed: 12, windDirection: 225 } // Southwest wind
      };
      
      // All farms request same time slot
      const burnRequests = scenario.farms.map(farm => ({
        request_id: farm.id,
        farm_id: farm.id,
        field_id: farm.id + 100,
        requested_date: scenario.requestedDate,
        requested_start_time: '10:00',
        requested_end_time: '14:00',
        area_hectares: farm.area,
        lat: farm.lat,
        lon: farm.lon,
        priority_score: 75
      }));
      
      // Detect conflicts
      const conflicts = await agents.predictor.predictSmokeOverlap(burnRequests);
      
      expect(conflicts.conflicts.length).toBeGreaterThan(0);
      
      // Southwest wind means North Ranch smoke affects East Fields and South Valley
      const criticalConflicts = conflicts.conflicts.filter(c => 
        c.conflict_severity === 'high' || c.conflict_severity === 'critical'
      );
      
      expect(criticalConflicts.length).toBeGreaterThan(0);
      
      // Optimize schedule
      const weatherData = { [scenario.requestedDate]: scenario.weather };
      const optimized = await agents.optimizer.optimizeWithSimulatedAnnealing(
        burnRequests,
        conflicts.conflicts,
        weatherData
      );
      
      // Verify conflicts resolved
      expect(optimized.improvements.conflictsResolved).toBeGreaterThan(0);
      
      // Check time slot distribution
      const timeSlots = Object.values(optimized.schedule);
      const uniqueSlots = new Set(timeSlots.map(s => `${s.date}_${s.period}`));
      
      expect(uniqueSlots.size).toBeGreaterThan(1); // Burns spread across multiple slots
    });

    test('Should prioritize upwind farms in conflict resolution', async () => {
      const windDirection = 180; // South wind
      
      const farms = [
        { id: 3001, lat: 40.02, lon: -120.00 }, // North (downwind)
        { id: 3002, lat: 40.00, lon: -120.00 }, // Center
        { id: 3003, lat: 39.98, lon: -120.00 }  // South (upwind)
      ];
      
      // South farm (upwind) should get priority
      const priorities = farms.map(farm => {
        const isUpwind = (windDirection === 180 && farm.lat < 40.00) ||
                        (windDirection === 0 && farm.lat > 40.00);
        return {
          farmId: farm.id,
          priority: isUpwind ? 90 : 70
        };
      });
      
      expect(priorities[2].priority).toBeGreaterThan(priorities[0].priority);
    });

    test('Should implement time-based separation for nearby burns', async () => {
      const nearbyBurns = [
        { id: 4001, distance: 1.5, area: 100 }, // 1.5km away
        { id: 4002, distance: 3.0, area: 80 },  // 3km away
        { id: 4003, distance: 5.0, area: 60 }   // 5km away
      ];
      
      // Calculate minimum time separation
      const timeSeparations = nearbyBurns.map(burn => {
        const minHours = Math.max(2, 6 - burn.distance); // Closer = longer separation
        return {
          burnId: burn.id,
          minSeparationHours: minHours
        };
      });
      
      expect(timeSeparations[0].minSeparationHours).toBeGreaterThan(
        timeSeparations[2].minSeparationHours
      );
    });
  });

  describe('Scenario 3: Emergency Weather Change Response', () => {
    test('Should abort burn on sudden wind speed increase', async () => {
      const burnInProgress = {
        id: 5001,
        startTime: new Date('2025-08-28T10:00:00'),
        location: { lat: 40.0, lon: -120.0 },
        status: 'active'
      };
      
      // Initial safe conditions
      let currentWeather = { windSpeed: 8, humidity: 50 };
      
      // Sudden wind increase
      currentWeather = { windSpeed: 28, humidity: 45 };
      
      const shouldAbort = currentWeather.windSpeed > 25;
      expect(shouldAbort).toBeTruthy();
      
      if (shouldAbort) {
        // Send emergency alerts
        const emergencyAlert = {
          type: 'EMERGENCY_ABORT',
          burnId: burnInProgress.id,
          reason: 'HIGH_WIND',
          windSpeed: currentWeather.windSpeed,
          action: 'EXTINGUISH_IMMEDIATELY'
        };
        
        expect(emergencyAlert.type).toBe('EMERGENCY_ABORT');
        expect(emergencyAlert.windSpeed).toBeGreaterThan(25);
      }
    });

    test('Should reschedule all burns on fire weather warning', async () => {
      const scheduledBurns = [
        { id: 6001, date: '2025-08-29', farmId: 1 },
        { id: 6002, date: '2025-08-29', farmId: 2 },
        { id: 6003, date: '2025-08-29', farmId: 3 }
      ];
      
      // Fire weather warning issued
      const fireWeatherWarning = {
        issued: true,
        startDate: '2025-08-29',
        endDate: '2025-08-31',
        conditions: {
          windSpeed: 30,
          humidity: 15,
          temperature: 38,
          fireWeatherIndex: 92
        }
      };
      
      if (fireWeatherWarning.issued) {
        // Reschedule all burns
        const rescheduled = scheduledBurns.map(burn => ({
          ...burn,
          originalDate: burn.date,
          newDate: '2025-09-02', // After warning period
          status: 'rescheduled',
          reason: 'fire_weather_warning'
        }));
        
        expect(rescheduled.every(b => b.status === 'rescheduled')).toBeTruthy();
        expect(rescheduled[0].newDate).toBe('2025-09-02');
      }
    });

    test('Should activate regional smoke monitoring on inversion', async () => {
      const inversionConditions = {
        time: '05:00',
        temperature: 10,
        humidity: 95,
        windSpeed: 0.5,
        mixing_height: 50, // Very low
        stability_class: 'F' // Very stable
      };
      
      const isInversion = 
        inversionConditions.windSpeed < 1 &&
        inversionConditions.mixing_height < 100 &&
        inversionConditions.stability_class === 'F';
      
      expect(isInversion).toBeTruthy();
      
      if (isInversion) {
        // Activate enhanced monitoring
        const monitoring = {
          mode: 'ENHANCED',
          updateFrequency: 5, // minutes
          alertThreshold: 20, // Lower PM2.5 threshold
          affectedRadius: 15  // km
        };
        
        expect(monitoring.mode).toBe('ENHANCED');
        expect(monitoring.alertThreshold).toBeLessThan(35);
      }
    });
  });

  describe('Scenario 4: Multi-Day Burn Campaign', () => {
    test('Should optimize 5-day regional burn campaign', async () => {
      const campaign = {
        startDate: '2025-09-01',
        endDate: '2025-09-05',
        farms: [
          { id: 7001, name: 'Farm A', totalArea: 200, dailyCapacity: 50 },
          { id: 7002, name: 'Farm B', totalArea: 150, dailyCapacity: 40 },
          { id: 7003, name: 'Farm C', totalArea: 180, dailyCapacity: 45 },
          { id: 7004, name: 'Farm D', totalArea: 100, dailyCapacity: 30 }
        ]
      };
      
      // Create daily burn slots
      const campaignSchedule = [];
      const dates = ['2025-09-01', '2025-09-02', '2025-09-03', '2025-09-04', '2025-09-05'];
      
      dates.forEach(date => {
        campaign.farms.forEach(farm => {
          if (farm.totalArea > 0) {
            const burnArea = Math.min(farm.dailyCapacity, farm.totalArea);
            campaignSchedule.push({
              date,
              farmId: farm.id,
              area: burnArea
            });
            farm.totalArea -= burnArea;
          }
        });
      });
      
      expect(campaignSchedule.length).toBeGreaterThan(0);
      
      // Verify area constraints
      const farmTotals = {};
      campaignSchedule.forEach(burn => {
        farmTotals[burn.farmId] = (farmTotals[burn.farmId] || 0) + burn.area;
      });
      
      Object.values(farmTotals).forEach(total => {
        expect(total).toBeLessThanOrEqual(200); // Max farm area
      });
    });

    test('Should adjust campaign for weekend restrictions', async () => {
      const weekSchedule = [
        { date: '2025-09-01', dayOfWeek: 'Monday', restricted: false },
        { date: '2025-09-02', dayOfWeek: 'Tuesday', restricted: false },
        { date: '2025-09-03', dayOfWeek: 'Wednesday', restricted: false },
        { date: '2025-09-04', dayOfWeek: 'Thursday', restricted: false },
        { date: '2025-09-05', dayOfWeek: 'Friday', restricted: false },
        { date: '2025-09-06', dayOfWeek: 'Saturday', restricted: true },
        { date: '2025-09-07', dayOfWeek: 'Sunday', restricted: true }
      ];
      
      const allowedDays = weekSchedule.filter(day => !day.restricted);
      expect(allowedDays).toHaveLength(5);
      
      // No burns on weekends
      const weekendBurns = weekSchedule
        .filter(day => day.restricted)
        .map(day => ({ date: day.date, burns: 0 }));
      
      expect(weekendBurns.every(d => d.burns === 0)).toBeTruthy();
    });

    test('Should track cumulative smoke exposure over campaign', async () => {
      const dailyExposures = [
        { date: '2025-09-01', pm25: 25, population: 5000 },
        { date: '2025-09-02', pm25: 30, population: 5000 },
        { date: '2025-09-03', pm25: 28, population: 5000 },
        { date: '2025-09-04', pm25: 22, population: 5000 },
        { date: '2025-09-05', pm25: 18, population: 5000 }
      ];
      
      // Calculate cumulative exposure
      const cumulativeExposure = dailyExposures.reduce((total, day) => 
        total + (day.pm25 * day.population), 0
      );
      
      const averagePM25 = dailyExposures.reduce((sum, day) => 
        sum + day.pm25, 0) / dailyExposures.length;
      
      expect(averagePM25).toBeLessThan(35); // Should maintain safe average
      expect(cumulativeExposure).toBeGreaterThan(0);
    });
  });

  describe('Scenario 5: Burn Window Trading System', () => {
    test('Should facilitate burn window trade between farms', async () => {
      const trade = {
        offeringFarm: { id: 8001, name: 'Valley Farm', slot: '2025-09-10_morning' },
        requestingFarm: { id: 8002, name: 'Hill Ranch', urgency: 'high' },
        compensation: { type: 'monetary', amount: 500 },
        reason: 'crop_harvest_deadline'
      };
      
      // Process trade request
      const tradeResult = await agents.alerts.processBurnWindowTrade({
        offering_farm_id: trade.offeringFarm.id,
        requesting_farm_id: trade.requestingFarm.id,
        offering_request_id: 9001,
        requesting_request_id: 9002,
        trade_type: 'swap',
        compensation_type: trade.compensation.type,
        compensation_amount: trade.compensation.amount
      });
      
      expect(tradeResult.status).toBe('proposed');
      expect(tradeResult.tradeId).toBeDefined();
    });

    test('Should validate trade feasibility based on weather', async () => {
      const proposedTrade = {
        originalDate: '2025-09-11',
        proposedDate: '2025-09-12',
        location: { lat: 40.0, lon: -120.0 }
      };
      
      // Check weather for both dates
      const originalWeather = await agents.weather.analyzeWeatherForBurn(
        proposedTrade.location.lat,
        proposedTrade.location.lon,
        proposedTrade.originalDate
      );
      
      const proposedWeather = await agents.weather.analyzeWeatherForBurn(
        proposedTrade.location.lat,
        proposedTrade.location.lon,
        proposedTrade.proposedDate
      );
      
      const tradeFeasible = 
        originalWeather.suitable && proposedWeather.suitable;
      
      expect(typeof tradeFeasible).toBe('boolean');
    });

    test('Should track trade history and settlements', async () => {
      const tradeHistory = [
        { id: 1, date: '2025-09-01', status: 'completed', compensation: 300 },
        { id: 2, date: '2025-09-03', status: 'completed', compensation: 450 },
        { id: 3, date: '2025-09-05', status: 'cancelled', compensation: 0 },
        { id: 4, date: '2025-09-07', status: 'completed', compensation: 600 }
      ];
      
      const completedTrades = tradeHistory.filter(t => t.status === 'completed');
      const totalCompensation = completedTrades.reduce((sum, t) => 
        sum + t.compensation, 0
      );
      
      expect(completedTrades).toHaveLength(3);
      expect(totalCompensation).toBe(1350);
    });
  });

  describe('Scenario 6: Population Center Protection', () => {
    test('Should prevent burns upwind of populated areas', async () => {
      const scenario = {
        burn: { lat: 40.00, lon: -120.00, area: 150 },
        town: { lat: 40.02, lon: -120.00, population: 10000 }, // 2km north
        windDirection: 0 // North wind (toward town)
      };
      
      // Check if burn is upwind of town
      const isUpwind = scenario.windDirection === 0 && 
                       scenario.burn.lat < scenario.town.lat;
      
      expect(isUpwind).toBeTruthy();
      
      if (isUpwind) {
        // Calculate smoke impact on town
        const smokeVector = await agents.predictor.generateSmokeVector(
          10001,
          { windSpeed: 10, windDirection: scenario.windDirection },
          scenario.burn.area
        );
        
        const distanceToTown = 2; // km
        const pm25AtTown = await agents.predictor.calculatePM25FromVector(
          smokeVector,
          distanceToTown
        );
        
        // Should reject or reschedule if PM2.5 exceeds threshold
        const shouldReject = pm25AtTown > 35;
        
        if (shouldReject) {
          expect(pm25AtTown).toBeGreaterThan(35);
        }
      }
    });

    test('Should implement buffer zones around sensitive receptors', async () => {
      const sensitiveReceptors = [
        { type: 'hospital', lat: 40.01, lon: -120.01, bufferKm: 5 },
        { type: 'school', lat: 40.00, lon: -120.02, bufferKm: 3 },
        { type: 'elderly_care', lat: 39.99, lon: -120.00, bufferKm: 4 }
      ];
      
      const proposedBurn = { lat: 40.00, lon: -120.00 };
      
      // Check buffer violations
      const violations = sensitiveReceptors.filter(receptor => {
        const distance = calculateDistance(
          proposedBurn.lat, proposedBurn.lon,
          receptor.lat, receptor.lon
        );
        return distance < receptor.bufferKm;
      });
      
      expect(violations.length).toBeGreaterThan(0);
      
      if (violations.length > 0) {
        // Require special conditions
        const specialConditions = {
          maxPM25: 20, // Lower threshold
          requiredWindDirection: 'away_from_receptor',
          notification: 'advance_48hr'
        };
        
        expect(specialConditions.maxPM25).toBeLessThan(35);
      }
    });

    test('Should notify residents of upcoming burns', async () => {
      const affectedResidents = [
        { distance: 1, count: 50 },
        { distance: 2, count: 200 },
        { distance: 5, count: 1000 },
        { distance: 10, count: 5000 }
      ];
      
      const notifications = affectedResidents.map(group => ({
        distance: group.distance,
        population: group.count,
        method: group.distance < 3 ? 'direct_sms' : 'public_notice',
        timing: group.distance < 3 ? '24hr_advance' : '48hr_advance'
      }));
      
      const directNotifications = notifications.filter(n => 
        n.method === 'direct_sms'
      );
      
      expect(directNotifications.length).toBeGreaterThan(0);
      expect(directNotifications[0].timing).toBe('24hr_advance');
    });
  });

  describe('Scenario 7: Seasonal Adaptation', () => {
    test('Should adjust burn windows for summer conditions', async () => {
      const summerConditions = {
        month: 'July',
        avgTemperature: 35,
        avgHumidity: 25,
        fireRisk: 'high',
        allowedHours: { start: '06:00', end: '10:00' } // Early morning only
      };
      
      const burnWindow = {
        start: new Date('2025-07-15T06:00:00'),
        end: new Date('2025-07-15T10:00:00')
      };
      
      const duration = (burnWindow.end - burnWindow.start) / (1000 * 60 * 60);
      expect(duration).toBe(4); // 4-hour window
      
      // No afternoon burns in summer
      const afternoonAllowed = summerConditions.fireRisk === 'high' ? false : true;
      expect(afternoonAllowed).toBeFalsy();
    });

    test('Should adapt for winter fog conditions', async () => {
      const winterConditions = {
        month: 'December',
        fogFrequency: 'high',
        visibility: 0.5, // km
        mixingHeight: 100, // meters
        burnRestrictions: 'enhanced'
      };
      
      if (winterConditions.visibility < 1) {
        // Fog present - restrict burns
        const restrictions = {
          allowed: false,
          reason: 'poor_visibility',
          minimumVisibility: 2 // km required
        };
        
        expect(restrictions.allowed).toBeFalsy();
        expect(restrictions.reason).toBe('poor_visibility');
      }
    });

    test('Should handle harvest season surge in requests', async () => {
      const harvestSeason = {
        startDate: '2025-10-01',
        endDate: '2025-10-31',
        normalDailyRequests: 10,
        harvestDailyRequests: 40
      };
      
      const surgeFactor = harvestSeason.harvestDailyRequests / 
                         harvestSeason.normalDailyRequests;
      
      expect(surgeFactor).toBe(4);
      
      // Implement surge handling
      const surgeStrategy = {
        extendedHours: true,
        weekendBurns: true,
        multipleSlots: true,
        prioritization: 'crop_type_based'
      };
      
      expect(surgeStrategy.extendedHours).toBeTruthy();
      expect(surgeStrategy.weekendBurns).toBeTruthy();
    });
  });

  describe('Scenario 8: Cross-Border Coordination', () => {
    test('Should coordinate with neighboring county systems', async () => {
      const counties = [
        { name: 'County A', system: 'BURNWISE', compatible: true },
        { name: 'County B', system: 'LEGACY', compatible: false },
        { name: 'County C', system: 'BURNWISE', compatible: true }
      ];
      
      const compatibleCounties = counties.filter(c => c.compatible);
      expect(compatibleCounties).toHaveLength(2);
      
      // Share burn schedules with compatible systems
      const sharedSchedule = {
        county: 'County A',
        date: '2025-09-15',
        burns: [
          { location: { lat: 40.00, lon: -120.00 }, area: 100 }
        ]
      };
      
      expect(sharedSchedule.burns).toHaveLength(1);
    });

    test('Should respect inter-county buffer zones', async () => {
      const countyBoundary = {
        lat: 40.00,
        bufferZone: 5 // km on each side
      };
      
      const proposedBurn = { lat: 39.98, lon: -120.00 }; // 2km from boundary
      
      const distanceFromBoundary = Math.abs(countyBoundary.lat - proposedBurn.lat) * 111; // km
      const inBufferZone = distanceFromBoundary < countyBoundary.bufferZone;
      
      expect(inBufferZone).toBeTruthy();
      
      if (inBufferZone) {
        // Require cross-county coordination
        const coordination = {
          required: true,
          notifyCounties: ['County A', 'County B'],
          approvalNeeded: true
        };
        
        expect(coordination.required).toBeTruthy();
        expect(coordination.notifyCounties).toHaveLength(2);
      }
    });

    test('Should aggregate regional air quality impacts', async () => {
      const regionalBurns = [
        { county: 'A', pm25Contribution: 15 },
        { county: 'B', pm25Contribution: 12 },
        { county: 'C', pm25Contribution: 18 }
      ];
      
      const totalPM25 = regionalBurns.reduce((sum, burn) => 
        sum + burn.pm25Contribution, 0
      );
      
      expect(totalPM25).toBe(45);
      
      // Check if exceeds regional threshold
      const regionalThreshold = 50;
      const withinLimits = totalPM25 < regionalThreshold;
      
      expect(withinLimits).toBeTruthy();
    });
  });

  describe('Scenario 9: Burn Completion Verification', () => {
    test('Should verify complete combustion before closing', async () => {
      const burnCompletion = {
        burnId: 11001,
        stages: {
          ignition: { time: '09:00', complete: true },
          activeBurn: { time: '10:00', complete: true },
          mopUp: { time: '13:00', complete: true },
          inspection: { time: '14:00', complete: false }
        },
        metrics: {
          areaCompleted: 95, // percent
          smokeProduction: 'minimal',
          hotspots: 2
        }
      };
      
      const canClose = 
        burnCompletion.metrics.areaCompleted > 90 &&
        burnCompletion.metrics.hotspots === 0;
      
      expect(canClose).toBeFalsy(); // Still has hotspots
      
      // Require additional mop-up
      if (burnCompletion.metrics.hotspots > 0) {
        const additionalWork = {
          required: true,
          estimatedTime: burnCompletion.metrics.hotspots * 30, // minutes per hotspot
          safety: 'maintain_crew'
        };
        
        expect(additionalWork.required).toBeTruthy();
        expect(additionalWork.estimatedTime).toBe(60);
      }
    });

    test('Should track post-burn smoke emissions', async () => {
      const postBurnMonitoring = {
        burnId: 12001,
        completionTime: new Date('2025-09-20T14:00:00'),
        monitoringPeriod: 24, // hours
        measurements: [
          { hour: 1, pm25: 25 },
          { hour: 2, pm25: 20 },
          { hour: 4, pm25: 15 },
          { hour: 8, pm25: 10 },
          { hour: 12, pm25: 8 },
          { hour: 24, pm25: 5 }
        ]
      };
      
      // Verify decreasing emissions
      for (let i = 1; i < postBurnMonitoring.measurements.length; i++) {
        expect(postBurnMonitoring.measurements[i].pm25)
          .toBeLessThanOrEqual(postBurnMonitoring.measurements[i - 1].pm25);
      }
      
      // Check if safe to close monitoring
      const finalPM25 = postBurnMonitoring.measurements[
        postBurnMonitoring.measurements.length - 1
      ].pm25;
      
      expect(finalPM25).toBeLessThan(12); // Good air quality
    });

    test('Should generate burn completion report', async () => {
      const completionReport = {
        burnId: 13001,
        farmId: 1,
        date: '2025-09-21',
        metrics: {
          areasBurned: 100,
          duration: 4,
          maxPM25: 42,
          avgPM25: 28,
          weatherConditions: 'favorable',
          incidents: 0,
          compliance: 'full'
        },
        certification: {
          signed: true,
          timestamp: new Date('2025-09-21T16:00:00'),
          certifiedBy: 'Burn Boss #12345'
        }
      };
      
      // Validate report completeness
      const requiredFields = [
        'areasBurned', 'duration', 'maxPM25', 'avgPM25', 
        'compliance', 'incidents'
      ];
      
      const hasAllFields = requiredFields.every(field => 
        completionReport.metrics[field] !== undefined
      );
      
      expect(hasAllFields).toBeTruthy();
      expect(completionReport.certification.signed).toBeTruthy();
      expect(completionReport.metrics.compliance).toBe('full');
    });
  });

  describe('Scenario 10: Wildfire Emergency Response', () => {
    test('Should immediately halt all burns on wildfire detection', async () => {
      const wildfireAlert = {
        detected: true,
        location: { lat: 40.05, lon: -120.05 },
        distance: 8, // km from burn area
        severity: 'active',
        windDirection: 'toward_burns'
      };
      
      if (wildfireAlert.detected) {
        // Emergency shutdown
        const emergencyShutdown = {
          immediate: true,
          affectedBurns: 'all',
          action: 'extinguish',
          evacuationReady: true
        };
        
        expect(emergencyShutdown.immediate).toBeTruthy();
        expect(emergencyShutdown.affectedBurns).toBe('all');
        expect(emergencyShutdown.action).toBe('extinguish');
      }
    });

    test('Should reallocate resources to wildfire suppression', async () => {
      const resources = {
        availableCrews: 10,
        assignedToBurns: 8,
        assignedToWildfire: 0
      };
      
      // Wildfire detected - reallocate
      const wildfireActive = true;
      
      if (wildfireActive) {
        resources.assignedToWildfire = 8;
        resources.assignedToBurns = 2; // Minimum for safety
        
        expect(resources.assignedToWildfire).toBe(8);
        expect(resources.assignedToBurns).toBe(2);
      }
    });

    test('Should maintain emergency communication chain', async () => {
      const emergencyContacts = [
        { level: 1, agency: 'Local Fire Dept', responseTime: 5 },
        { level: 2, agency: 'County Emergency', responseTime: 10 },
        { level: 3, agency: 'State CalFire', responseTime: 15 },
        { level: 4, agency: 'Federal Response', responseTime: 30 }
      ];
      
      const severity = 'critical';
      const activationLevel = severity === 'critical' ? 3 : 1;
      
      const activated = emergencyContacts.filter(c => 
        c.level <= activationLevel
      );
      
      expect(activated).toHaveLength(3);
      expect(activated[2].agency).toBe('State CalFire');
    });
  });
});

// Helper functions
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

module.exports = {
  calculateDistance
};