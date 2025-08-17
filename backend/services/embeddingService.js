/**
 * Embedding Service - Centralized Vector Generation
 * Uses OpenAI text-embedding-3-large for semantic embeddings
 * NO MOCKS - Real AI embeddings only (Hackathon requirement)
 */

const OpenAI = require('openai');
const logger = require('../middleware/logger');
const { query } = require('../db/connection');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://api.openai.com/v1'
});

// Embedding dimensions for different use cases
const EMBEDDING_DIMENSIONS = {
  weather: 128,    // Detailed weather patterns
  smoke: 64,       // Smoke dispersion patterns
  burn: 32,        // Burn request characteristics
  decision: 32     // Decision context
};

/**
 * Generate weather pattern embedding (128-dim)
 * Captures temperature, wind, humidity, conditions for pattern matching
 */
async function generateWeatherEmbedding(weatherData) {
  try {
    // Construct comprehensive weather description
    const weatherText = [
      `Temperature: ${weatherData.temperature}°F`,
      `Wind: ${weatherData.wind_speed}mph direction ${weatherData.wind_direction}°`,
      `Humidity: ${weatherData.humidity}%`,
      `Pressure: ${weatherData.pressure}hPa`,
      `Visibility: ${weatherData.visibility}mi`,
      `Conditions: ${weatherData.conditions}`,
      `Cloud coverage: ${weatherData.cloud_coverage}%`,
      weatherData.precipitation ? `Precipitation: ${weatherData.precipitation}mm` : '',
      weatherData.feels_like ? `Feels like: ${weatherData.feels_like}°F` : '',
      weatherData.uv_index ? `UV Index: ${weatherData.uv_index}` : ''
    ].filter(Boolean).join(', ');

    const response = await openai.embeddings.create({
      model: 'text-embedding-3-large',
      input: weatherText,
      dimensions: EMBEDDING_DIMENSIONS.weather
    });

    const embedding = response.data[0].embedding;
    
    // Verify embedding quality
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    logger.info('Generated weather embedding', {
      textLength: weatherText.length,
      dimensions: embedding.length,
      magnitude: magnitude.toFixed(4)
    });

    return embedding;
  } catch (error) {
    logger.error('Failed to generate weather embedding', { error: error.message });
    throw error;
  }
}

/**
 * Generate smoke dispersion embedding (64-dim)
 * Captures plume characteristics and affected areas
 */
async function generateSmokeEmbedding(smokeData) {
  try {
    const smokeText = [
      `Plume height: ${smokeData.plume_height}m`,
      `Plume width: ${smokeData.plume_width}m`,
      `Travel distance: ${smokeData.travel_distance}km`,
      `Max concentration: ${smokeData.max_concentration}µg/m³`,
      `Wind carry direction: ${smokeData.wind_direction}°`,
      `Dispersion rate: ${smokeData.dispersion_rate}`,
      `Affected area: ${smokeData.affected_area_km2}km²`,
      `Duration: ${smokeData.duration_hours}hours`,
      smokeData.inversion_risk ? `Temperature inversion risk: ${smokeData.inversion_risk}` : ''
    ].filter(Boolean).join(', ');

    const response = await openai.embeddings.create({
      model: 'text-embedding-3-large',
      input: smokeText,
      dimensions: EMBEDDING_DIMENSIONS.smoke
    });

    const embedding = response.data[0].embedding;
    
    logger.info('Generated smoke embedding', {
      dimensions: embedding.length,
      concentration: smokeData.max_concentration
    });

    return embedding;
  } catch (error) {
    logger.error('Failed to generate smoke embedding', { error: error.message });
    throw error;
  }
}

/**
 * Generate burn request embedding (32-dim)
 * Captures burn characteristics for pattern matching
 */
async function generateBurnEmbedding(burnData) {
  try {
    const burnText = [
      `Acres to burn: ${burnData.acres}`,
      `Crop type: ${burnData.crop_type}`,
      `Reason: ${burnData.reason || 'agricultural management'}`,
      `Time window: ${burnData.time_window}`,
      `Priority: ${burnData.priority || 'normal'}`,
      `Season: ${burnData.season || 'unknown'}`,
      `Field preparation: ${burnData.field_prep || 'standard'}`,
      burnData.previous_burns ? `Previous burns: ${burnData.previous_burns}` : '',
      burnData.neighboring_farms ? `Nearby farms: ${burnData.neighboring_farms}` : ''
    ].filter(Boolean).join(', ');

    const response = await openai.embeddings.create({
      model: 'text-embedding-3-large',
      input: burnText,
      dimensions: EMBEDDING_DIMENSIONS.burn
    });

    const embedding = response.data[0].embedding;
    
    logger.info('Generated burn embedding', {
      dimensions: embedding.length,
      acres: burnData.acres,
      cropType: burnData.crop_type
    });

    return embedding;
  } catch (error) {
    logger.error('Failed to generate burn embedding', { error: error.message });
    throw error;
  }
}

/**
 * Generate decision context embedding (32-dim)
 * Captures decision reasoning for audit and pattern analysis
 */
async function generateDecisionEmbedding(decisionData) {
  try {
    const decisionText = [
      `Decision: ${decisionData.decision}`,
      `Confidence: ${decisionData.confidence}`,
      `Primary factors: ${decisionData.reasons?.join(', ')}`,
      `Risk level: ${decisionData.risk_level || 'normal'}`,
      decisionData.requires_approval ? 'Requires human approval' : 'Autonomous decision',
      decisionData.weather_impact ? `Weather impact: ${decisionData.weather_impact}` : '',
      decisionData.conflict_score ? `Conflict score: ${decisionData.conflict_score}` : ''
    ].filter(Boolean).join(', ');

    const response = await openai.embeddings.create({
      model: 'text-embedding-3-large',
      input: decisionText,
      dimensions: EMBEDDING_DIMENSIONS.decision
    });

    const embedding = response.data[0].embedding;
    
    logger.info('Generated decision embedding', {
      dimensions: embedding.length,
      decision: decisionData.decision
    });

    return embedding;
  } catch (error) {
    logger.error('Failed to generate decision embedding', { error: error.message });
    throw error;
  }
}

/**
 * Find similar weather patterns in database
 */
async function findSimilarWeatherPatterns(embedding, limit = 10, thresholdDistance = 0.3) {
  try {
    const results = await query(`
      SELECT 
        wa.*,
        VEC_COSINE_DISTANCE(wa.weather_embedding, ?) as similarity_distance,
        1 - VEC_COSINE_DISTANCE(wa.weather_embedding, ?) as similarity_score
      FROM weather_analyses wa
      WHERE wa.weather_embedding IS NOT NULL
        AND VEC_COSINE_DISTANCE(wa.weather_embedding, ?) < ?
      ORDER BY similarity_distance ASC
      LIMIT ${limit}
    `, [
      JSON.stringify(embedding),
      JSON.stringify(embedding),
      JSON.stringify(embedding),
      thresholdDistance
    ]);

    return results.map(r => ({
      ...r,
      similarity_percentage: (r.similarity_score * 100).toFixed(1)
    }));
  } catch (error) {
    logger.error('Failed to find similar weather patterns', { error: error.message });
    throw error;
  }
}

/**
 * Find potential smoke conflicts using vector similarity
 */
async function findSmokeConflicts(embedding, timeWindow, distanceThreshold = 0.25) {
  try {
    const results = await query(`
      SELECT 
        sp.*,
        br.farm_id,
        br.acres_to_burn,
        f.name as farm_name,
        VEC_COSINE_DISTANCE(sp.smoke_vector, ?) as conflict_distance,
        1 - VEC_COSINE_DISTANCE(sp.smoke_vector, ?) as overlap_score
      FROM smoke_predictions sp
      JOIN burn_requests br ON sp.burn_request_id = br.id
      JOIN farms f ON br.farm_id = f.id
      WHERE sp.smoke_vector IS NOT NULL
        AND sp.prediction_time BETWEEN ? AND ?
        AND VEC_COSINE_DISTANCE(sp.smoke_vector, ?) < ?
      ORDER BY conflict_distance ASC
    `, [
      JSON.stringify(embedding),
      JSON.stringify(embedding),
      timeWindow.start,
      timeWindow.end,
      JSON.stringify(embedding),
      distanceThreshold
    ]);

    return results.map(r => ({
      ...r,
      conflict_severity: r.conflict_distance < 0.1 ? 'HIGH' :
                        r.conflict_distance < 0.2 ? 'MEDIUM' : 'LOW',
      overlap_percentage: (r.overlap_score * 100).toFixed(1)
    }));
  } catch (error) {
    logger.error('Failed to find smoke conflicts', { error: error.message });
    throw error;
  }
}

/**
 * Calculate similarity between two embeddings
 */
function calculateSimilarity(embedding1, embedding2) {
  if (embedding1.length !== embedding2.length) {
    throw new Error('Embeddings must have the same dimensions');
  }

  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;

  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    magnitude1 += embedding1[i] * embedding1[i];
    magnitude2 += embedding2[i] * embedding2[i];
  }

  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);

  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }

  const cosineSimilarity = dotProduct / (magnitude1 * magnitude2);
  return Math.max(0, Math.min(1, cosineSimilarity)); // Clamp to [0, 1]
}

/**
 * Batch generate embeddings for multiple texts
 */
async function batchGenerateEmbeddings(texts, dimensions = 128) {
  try {
    // OpenAI supports batch embedding generation
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-large',
      input: texts,
      dimensions: dimensions
    });

    const embeddings = response.data.map(d => d.embedding);
    
    logger.info('Generated batch embeddings', {
      count: embeddings.length,
      dimensions: dimensions
    });

    return embeddings;
  } catch (error) {
    logger.error('Failed to generate batch embeddings', { error: error.message });
    throw error;
  }
}

/**
 * Store embedding in database
 */
async function storeEmbedding(table, id, columnName, embedding) {
  try {
    await query(`
      UPDATE ${table}
      SET ${columnName} = ?
      WHERE id = ?
    `, [JSON.stringify(embedding), id]);
    
    logger.info('Stored embedding', { table, id, column: columnName });
    return true;
  } catch (error) {
    logger.error('Failed to store embedding', { 
      error: error.message,
      table,
      id 
    });
    throw error;
  }
}

module.exports = {
  generateWeatherEmbedding,
  generateSmokeEmbedding,
  generateBurnEmbedding,
  generateDecisionEmbedding,
  findSimilarWeatherPatterns,
  findSmokeConflicts,
  calculateSimilarity,
  batchGenerateEmbeddings,
  storeEmbedding,
  EMBEDDING_DIMENSIONS
};