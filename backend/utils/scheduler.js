const cron = require('node-cron');
const AlertSystem = require('../agents/alerts');
const SmokeOverlapPredictor = require('../agents/predictor');
const ScheduleOptimizer = require('../agents/optimizer');
const WeatherAnalysisAgent = require('../agents/weather');
const { query } = require('../db/connection');

const alertSystem = new AlertSystem();
const predictor = new SmokeOverlapPredictor();
const optimizer = new ScheduleOptimizer();
const weatherAgent = new WeatherAnalysisAgent();

function startScheduledJobs(io, logger) {
  
  cron.schedule('0 6 * * *', async () => {
    logger.info('Running daily conflict detection job');
    try {
      const today = new Date().toISOString().split('T')[0];
      const conflicts = await predictor.detectAllConflicts(today);
      
      if (conflicts.length > 0) {
        logger.info(`Detected ${conflicts.length} conflicts for ${today}`);
        
        for (const conflict of conflicts) {
          await alertSystem.sendConflictDetectedAlert(conflict);
        }
        
        io.emit('conflicts-detected', {
          date: today,
          count: conflicts.length,
          conflicts
        });
      }
    } catch (error) {
      logger.error('Error in conflict detection job:', error);
    }
  });
  
  cron.schedule('0 */2 * * *', async () => {
    logger.info('Running weather update job');
    try {
      const activeFarmsSql = `
        SELECT DISTINCT
          f.farm_id,
          f.longitude,
          f.latitude
        FROM farms f
        JOIN burn_fields bf ON f.farm_id = bf.farm_id
        JOIN burn_requests br ON bf.field_id = br.field_id
        WHERE br.requested_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
          AND br.status IN ('pending', 'approved', 'scheduled')
      `;
      
      const farms = await query(activeFarmsSql);
      
      for (const farm of farms) {
        const weather = await weatherAgent.fetchCurrentWeather(
          farm.latitude,
          farm.longitude
        );
        
        await weatherAgent.storeWeatherData(
          farm.latitude,
          farm.longitude,
          weather
        );
      }
      
      logger.info(`Updated weather for ${farms.length} farms`);
    } catch (error) {
      logger.error('Error in weather update job:', error);
    }
  });
  
  cron.schedule('0 5 * * *', async () => {
    logger.info('Running burn reminder job');
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      
      const upcomingBurnsSql = `
        SELECT 
          br.*,
          bf.field_name,
          f.farm_id,
          f.contact_phone,
          f.contact_email
        FROM burn_requests br
        JOIN burn_fields bf ON br.field_id = bf.field_id
        JOIN farms f ON bf.farm_id = f.farm_id
        WHERE br.requested_date = ?
          AND br.status IN ('approved', 'scheduled')
      `;
      
      const burns = await query(upcomingBurnsSql, [tomorrowStr]);
      
      for (const burn of burns) {
        const message = `BURNWISE Reminder: Your scheduled burn for ${burn.field_name || 'your field'} is tomorrow at ${burn.requested_start_time}. Weather conditions are being monitored. You'll receive updates if conditions change.`;
        
        await alertSystem.createAlert({
          farmId: burn.farm_id,
          burnRequestId: burn.request_id,
          alertType: 'burn_scheduled',
          severity: 'info',
          message,
          deliveryMethod: 'sms',
          recipientContact: burn.contact_phone
        });
        
        if (burn.contact_phone) {
          await alertSystem.sendSMS(
            alertSystem.formatPhoneNumber(burn.contact_phone),
            message
          );
        }
      }
      
      logger.info(`Sent reminders for ${burns.length} burns scheduled tomorrow`);
    } catch (error) {
      logger.error('Error in burn reminder job:', error);
    }
  });
  
  cron.schedule('0 7,15 * * *', async () => {
    logger.info('Running air quality monitoring job');
    try {
      const activeBurnsSql = `
        SELECT 
          br.request_id,
          br.requested_date,
          bf.field_id,
          ST_X(ST_Centroid(bf.field_geometry)) as longitude,
          ST_Y(ST_Centroid(bf.field_geometry)) as latitude,
          bf.area_hectares
        FROM burn_requests br
        JOIN burn_fields bf ON br.field_id = bf.field_id
        WHERE br.requested_date = CURDATE()
          AND br.status = 'active'
      `;
      
      const activeBurns = await query(activeBurnsSql);
      
      for (const burn of activeBurns) {
        const airQuality = await weatherAgent.fetchAirQuality(
          burn.latitude,
          burn.longitude
        );
        
        if (airQuality && airQuality.pm25 > 55) {
          const nearbyFarmsSql = `
            SELECT 
              f.farm_id,
              f.contact_phone,
              ST_Distance_Sphere(
                ST_GeomFromText(CONCAT('POINT(', f.longitude, ' ', f.latitude, ')'), 4326),
                ST_GeomFromText('POINT(? ?)', 4326)
              ) / 1000 as distance_km
            FROM farms f
            WHERE ST_Distance_Sphere(
              ST_GeomFromText(CONCAT('POINT(', f.longitude, ' ', f.latitude, ')'), 4326),
              ST_GeomFromText('POINT(? ?)', 4326)
            ) <= 20000
          `;
          
          const nearbyFarms = await query(nearbyFarmsSql, [
            burn.longitude, burn.latitude,
            burn.longitude, burn.latitude
          ]);
          
          for (const farm of nearbyFarms) {
            const hazardLevel = weatherAgent.getHazardLevel(airQuality.pm25);
            const message = `BURNWISE Air Quality Alert: ${hazardLevel} air quality detected ${farm.distance_km.toFixed(1)}km from your location. PM2.5: ${airQuality.pm25}µg/m³. Take appropriate precautions.`;
            
            await alertSystem.createAlert({
              farmId: farm.farm_id,
              burnRequestId: burn.request_id,
              alertType: 'smoke_warning',
              severity: airQuality.pm25 > 150 ? 'critical' : 'warning',
              message,
              deliveryMethod: 'sms',
              recipientContact: farm.contact_phone
            });
          }
        }
      }
      
      logger.info(`Monitored air quality for ${activeBurns.length} active burns`);
    } catch (error) {
      logger.error('Error in air quality monitoring job:', error);
    }
  });
  
  cron.schedule('*/5 * * * *', async () => {
    logger.info('Processing pending alerts');
    try {
      const processed = await alertSystem.processPendingAlerts();
      if (processed > 0) {
        logger.info(`Processed ${processed} pending alerts`);
      }
    } catch (error) {
      logger.error('Error processing pending alerts:', error);
    }
  });
  
  cron.schedule('0 2 * * 0', async () => {
    logger.info('Running weekly optimization job');
    try {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7);
      
      const result = await optimizer.optimizeSchedule(
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );
      
      if (result.success) {
        logger.info(`Weekly optimization complete: ${JSON.stringify(result.improvements)}`);
        
        io.emit('schedule-optimized', {
          optimizationRunId: result.optimizationRunId,
          improvements: result.improvements
        });
      }
    } catch (error) {
      logger.error('Error in weekly optimization job:', error);
    }
  });
  
  cron.schedule('0 * * * *', async () => {
    logger.info('Checking for burns starting soon');
    try {
      const nextHour = new Date();
      nextHour.setHours(nextHour.getHours() + 1);
      
      const startingSoonSql = `
        SELECT 
          br.*,
          bf.field_name,
          f.farm_id
        FROM burn_requests br
        JOIN burn_fields bf ON br.field_id = bf.field_id
        JOIN farms f ON bf.farm_id = f.farm_id
        WHERE br.requested_date = CURDATE()
          AND br.status = 'scheduled'
          AND TIME(br.requested_start_time) BETWEEN TIME(NOW()) AND TIME(?)
      `;
      
      const startingSoon = await query(startingSoonSql, [
        nextHour.toTimeString().split(' ')[0]
      ]);
      
      for (const burn of startingSoon) {
        await alertSystem.sendBurnStartingAlert(burn);
        
        await query(
          'UPDATE burn_requests SET status = "active" WHERE request_id = ?',
          [burn.request_id]
        );
        
        io.to(`farm-${burn.farm_id}`).emit('burn-starting', {
          requestId: burn.request_id,
          fieldName: burn.field_name,
          startTime: burn.requested_start_time
        });
      }
      
      logger.info(`${startingSoon.length} burns starting in the next hour`);
    } catch (error) {
      logger.error('Error checking for starting burns:', error);
    }
  });
  
  cron.schedule('0 0 * * *', async () => {
    logger.info('Running daily cleanup job');
    try {
      const cleanupSql = `
        UPDATE burn_requests 
        SET status = 'completed'
        WHERE requested_date < CURDATE()
          AND status = 'active'
      `;
      
      const result = await query(cleanupSql);
      logger.info(`Marked ${result.affectedRows} burns as completed`);
      
      const expiredAlertsSql = `
        DELETE FROM alerts 
        WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
          AND delivery_status IN ('delivered', 'failed')
      `;
      
      const alertResult = await query(expiredAlertsSql);
      logger.info(`Deleted ${alertResult.affectedRows} old alerts`);
    } catch (error) {
      logger.error('Error in daily cleanup job:', error);
    }
  });
  
  logger.info('All scheduled jobs started successfully');
}

module.exports = {
  startScheduledJobs
};