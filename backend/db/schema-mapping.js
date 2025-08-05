// Schema mapping for existing TiDB tables
// Maps our application schema to the actual database schema

module.exports = {
  // Table mappings
  tables: {
    farms: 'farms',
    burnRequests: 'burn_requests',
    burnFields: 'burn_fields',
    weatherData: 'weather_conditions',
    smokePredictions: 'smoke_predictions',
    schedules: 'optimized_schedules',
    alerts: 'alerts',
    conflicts: 'schedule_conflicts'
  },
  
  // Column mappings
  columns: {
    farms: {
      id: 'farm_id',
      name: 'farm_name',
      ownerName: 'owner_name',
      email: 'contact_email',
      phone: 'contact_phone',
      longitude: 'longitude',
      latitude: 'latitude',
      totalAcres: 'total_area_hectares',
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    },
    burnRequests: {
      id: 'request_id',
      fieldId: 'field_id',
      burnDate: 'requested_date',
      timeWindowStart: 'requested_start_time',
      timeWindowEnd: 'requested_end_time',
      burnType: 'burn_type',
      purpose: 'purpose',
      status: 'status',
      priorityScore: 'priority_score',
      terrainVector: 'terrain_vector',
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    },
    burnFields: {
      id: 'field_id',
      farmId: 'farm_id',
      fieldName: 'field_name',
      fieldBoundary: 'field_geometry',
      acres: 'area_hectares',
      cropType: 'crop_type',
      lastBurnDate: 'last_burn_date',
      fuelLoad: 'fuel_load_tons_per_hectare',
      terrainSlope: 'terrain_slope',
      elevation: 'elevation_meters',
      createdAt: 'created_at'
    },
    weatherData: {
      id: 'weather_id',
      longitude: 'longitude',
      latitude: 'latitude',
      timestamp: 'observation_time',
      temperature: 'temperature_celsius',
      humidity: 'humidity_percent',
      windSpeed: 'wind_speed_mps',
      windDirection: 'wind_direction_degrees',
      windVector: 'wind_vector',
      pressure: 'pressure_hpa',
      precipitation: 'precipitation_mm',
      visibility: 'visibility_km',
      cloudCover: 'cloud_cover_percent',
      weatherPatternEmbedding: 'weather_pattern_embedding',
      source: 'source',
      createdAt: 'created_at'
    },
    smokePredictions: {
      id: 'prediction_id',
      burnRequestId: 'burn_request_id',
      predictionTimestamp: 'prediction_time',
      affectedArea: 'plume_geometry',
      plumeVector: 'plume_vector',
      maxPM25: 'max_pm25_ugm3',
      affectedAreaKm2: 'affected_area_km2',
      maxDispersionRadius: 'dispersion_radius_km',
      peakConcentrationTime: 'peak_concentration_time',
      durationHours: 'duration_hours',
      affectedPopulation: 'affected_population_estimate',
      confidenceScore: 'confidence_score',
      modelVersion: 'model_version',
      createdAt: 'created_at'
    },
    schedules: {
      id: 'schedule_id',
      optimizationRunId: 'optimization_run_id',
      burnRequestId: 'burn_request_id',
      originalDate: 'original_date',
      date: 'optimized_date',
      assignedTimeStart: 'optimized_start_time',
      assignedTimeEnd: 'optimized_end_time',
      optimizationScore: 'optimization_score',
      constraintsSatisfied: 'constraints_satisfied',
      tradeOffs: 'trade_offs',
      createdAt: 'created_at'
    },
    alerts: {
      id: 'alert_id',
      type: 'alert_type',
      farmId: 'farm_id',
      burnRequestId: 'burn_request_id',
      title: 'alert_title',
      message: 'alert_message',
      severity: 'severity',
      status: 'alert_status',
      sentVia: 'delivery_method',
      recipientCount: 'recipient_count',
      sentAt: 'sent_at',
      acknowledgedAt: 'acknowledged_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  },
  
  // Helper functions to map between schemas
  mapToDb(table, data) {
    const mapping = this.columns[table];
    if (!mapping) return data;
    
    const mapped = {};
    for (const [appKey, dbKey] of Object.entries(mapping)) {
      if (data.hasOwnProperty(appKey)) {
        mapped[dbKey] = data[appKey];
      }
    }
    return mapped;
  },
  
  mapFromDb(table, data) {
    const mapping = this.columns[table];
    if (!mapping) return data;
    
    const mapped = {};
    for (const [appKey, dbKey] of Object.entries(mapping)) {
      if (data.hasOwnProperty(dbKey)) {
        mapped[appKey] = data[dbKey];
      }
    }
    // Also include any unmapped fields
    for (const [key, value] of Object.entries(data)) {
      if (!Object.values(mapping).includes(key)) {
        mapped[key] = value;
      }
    }
    return mapped;
  }
};