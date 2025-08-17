const { query, executeInTransaction } = require('./connection');

/**
 * Vector Operations Module for TiDB
 * Provides helper functions for working with TiDB vector columns
 */

/**
 * Insert data with vector column
 * @param {string} tableName - Name of the table
 * @param {Object} data - Data to insert (excluding vector)
 * @param {string} vectorColumn - Name of the vector column
 * @param {Array} vector - Vector array to insert
 * @returns {Promise<Object>} Insert result
 */
async function insertWithVector(tableName, data, vectorColumn, vector = null) {
  try {
    // Prepare column names and values
    const columns = Object.keys(data);
    const values = Object.values(data);
    
    // Add vector column if provided
    if (vector && vectorColumn) {
      columns.push(vectorColumn);
      values.push(JSON.stringify(vector));
    }
    
    // Build query
    const placeholders = values.map(() => '?').join(', ');
    const columnNames = columns.join(', ');
    const sql = `INSERT INTO ${tableName} (${columnNames}) VALUES (${placeholders})`;
    
    // Execute query
    const result = await query(sql, values);
    
    return {
      success: true,
      insertId: result.insertId,
      affectedRows: result.affectedRows
    };
  } catch (error) {
    console.error(`Error inserting with vector into ${tableName}:`, error);
    throw error;
  }
}

/**
 * Search for similar vectors using cosine distance
 * @param {string} tableName - Name of the table
 * @param {string} vectorColumn - Name of the vector column
 * @param {Array} searchVector - Vector to search for
 * @param {number} limit - Number of results to return
 * @param {Object} filters - Additional WHERE conditions
 * @returns {Promise<Array>} Similar records
 */
async function searchSimilarVectors(tableName, vectorColumn, searchVector, limit = 10, filters = {}) {
  try {
    // Build WHERE clause from filters
    const whereConditions = [];
    const whereValues = [];
    
    for (const [key, value] of Object.entries(filters)) {
      whereConditions.push(`${key} = ?`);
      whereValues.push(value);
    }
    
    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';
    
    // Build similarity search query
    const sql = `
      SELECT *, 
             1 - VEC_COSINE_DISTANCE(${vectorColumn}, ?) as similarity
      FROM ${tableName}
      ${whereClause}
      ORDER BY similarity DESC
      LIMIT ?
    `;
    
    const params = [JSON.stringify(searchVector), ...whereValues, limit];
    const results = await query(sql, params);
    
    return results;
  } catch (error) {
    console.error(`Error searching similar vectors in ${tableName}:`, error);
    throw error;
  }
}

/**
 * Update vector column for existing record
 * @param {string} tableName - Name of the table
 * @param {string} vectorColumn - Name of the vector column
 * @param {Array} vector - New vector value
 * @param {Object} whereConditions - WHERE conditions for update
 * @returns {Promise<Object>} Update result
 */
async function updateVector(tableName, vectorColumn, vector, whereConditions) {
  try {
    const whereKeys = Object.keys(whereConditions);
    const whereValues = Object.values(whereConditions);
    
    if (whereKeys.length === 0) {
      throw new Error('WHERE conditions are required for vector update');
    }
    
    const whereClause = whereKeys.map(key => `${key} = ?`).join(' AND ');
    
    const sql = `
      UPDATE ${tableName}
      SET ${vectorColumn} = ?
      WHERE ${whereClause}
    `;
    
    const params = [JSON.stringify(vector), ...whereValues];
    const result = await query(sql, params);
    
    return {
      success: true,
      affectedRows: result.affectedRows
    };
  } catch (error) {
    console.error(`Error updating vector in ${tableName}:`, error);
    throw error;
  }
}

/**
 * Calculate vector distance between two records
 * @param {string} tableName - Name of the table
 * @param {string} vectorColumn - Name of the vector column
 * @param {number} id1 - First record ID
 * @param {number} id2 - Second record ID
 * @param {string} distanceType - Distance type: 'cosine' or 'l2'
 * @returns {Promise<number>} Distance between vectors
 */
async function calculateVectorDistance(tableName, vectorColumn, id1, id2, distanceType = 'cosine') {
  try {
    const distanceFunction = distanceType === 'l2' 
      ? 'VEC_L2_DISTANCE' 
      : 'VEC_COSINE_DISTANCE';
    
    const sql = `
      SELECT ${distanceFunction}(
        (SELECT ${vectorColumn} FROM ${tableName} WHERE id = ?),
        (SELECT ${vectorColumn} FROM ${tableName} WHERE id = ?)
      ) as distance
    `;
    
    const [result] = await query(sql, [id1, id2]);
    return result?.distance || null;
  } catch (error) {
    console.error(`Error calculating vector distance in ${tableName}:`, error);
    throw error;
  }
}

/**
 * Batch insert with vectors
 * @param {string} tableName - Name of the table
 * @param {Array} records - Array of records with vectors
 * @param {string} vectorColumn - Name of the vector column
 * @returns {Promise<Object>} Batch insert result
 */
async function batchInsertWithVectors(tableName, records, vectorColumn) {
  try {
    if (records.length === 0) {
      return { success: true, insertedCount: 0 };
    }
    
    // Get column names from first record
    const firstRecord = records[0];
    const dataColumns = Object.keys(firstRecord).filter(col => col !== vectorColumn);
    const allColumns = [...dataColumns, vectorColumn];
    
    // Build values for batch insert
    const valueRows = records.map(record => {
      const values = dataColumns.map(col => record[col]);
      values.push(JSON.stringify(record[vectorColumn]));
      return `(${values.map(v => 
        typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v
      ).join(', ')})`;
    });
    
    const sql = `
      INSERT INTO ${tableName} (${allColumns.join(', ')})
      VALUES ${valueRows.join(', ')}
    `;
    
    const result = await query(sql);
    
    return {
      success: true,
      insertedCount: result.affectedRows
    };
  } catch (error) {
    console.error(`Error batch inserting with vectors into ${tableName}:`, error);
    throw error;
  }
}

/**
 * Find nearest neighbors using vector index
 * @param {string} tableName - Name of the table
 * @param {string} vectorColumn - Name of the vector column
 * @param {Array} queryVector - Query vector
 * @param {number} k - Number of nearest neighbors
 * @param {Object} options - Additional options
 * @returns {Promise<Array>} K nearest neighbors
 */
async function findNearestNeighbors(tableName, vectorColumn, queryVector, k = 5, options = {}) {
  try {
    const { 
      selectColumns = '*',
      whereClause = '',
      distanceThreshold = null 
    } = options;
    
    let sql = `
      SELECT ${selectColumns},
             VEC_COSINE_DISTANCE(${vectorColumn}, ?) as distance
      FROM ${tableName}
    `;
    
    const params = [JSON.stringify(queryVector)];
    
    if (whereClause) {
      sql += ` WHERE ${whereClause}`;
    }
    
    if (distanceThreshold !== null) {
      const whereKeyword = whereClause ? 'AND' : 'WHERE';
      sql += ` ${whereKeyword} VEC_COSINE_DISTANCE(${vectorColumn}, ?) < ?`;
      params.push(JSON.stringify(queryVector), distanceThreshold);
    }
    
    sql += ` ORDER BY distance ASC LIMIT ?`;
    params.push(k);
    
    const results = await query(sql, params);
    return results;
  } catch (error) {
    console.error(`Error finding nearest neighbors in ${tableName}:`, error);
    throw error;
  }
}

/**
 * Generate REAL embedding vector using OpenAI GPT-5 API
 * NO FALLBACKS - Real AI or fail (Hackathon requirement)
 * @param {string} text - Text to embed
 * @param {number} dimensions - Vector dimensions (128, 256, 512, 1024, etc.)
 * @returns {Array} REAL embedding vector from OpenAI
 */
async function generateEmbedding(text, dimensions = 128) {
  const axios = require('axios');
  const logger = require('../middleware/logger');
  
  // REQUIRED: OpenAI API key - NO FALLBACKS
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is REQUIRED for real AI embeddings - No fake vectors allowed');
  }
  
  // Call OpenAI embeddings API with text-embedding-3-large for best quality
  const response = await axios.post('https://api.openai.com/v1/embeddings', {
    model: 'text-embedding-3-large', // Best quality model (better than text-embedding-3-small)
    input: text,
    dimensions: dimensions // Custom dimensions supported
  }, {
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    timeout: 15000
  });
  
  if (!response.data?.data?.[0]?.embedding) {
    throw new Error('Invalid OpenAI response - no embedding received');
  }
  
  const embedding = response.data.data[0].embedding;
  
  // Verify it's a real embedding (normalized vectors have magnitude ~1.0)
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (Math.abs(magnitude - 1.0) > 0.2) {
    logger.warn(`Embedding magnitude ${magnitude.toFixed(4)} (expected ~1.0)`);
  }
  
  logger.info('✅ Generated REAL OpenAI embedding', { 
    model: 'text-embedding-3-large',
    textLength: text.length, 
    dimensions: embedding.length,
    magnitude: magnitude.toFixed(4)
  });
  
  return embedding;
}

/**
 * Validate vector dimensions
 * @param {Array} vector - Vector to validate
 * @param {number} expectedDimensions - Expected dimensions
 * @returns {boolean} True if valid
 */
function validateVectorDimensions(vector, expectedDimensions) {
  if (!Array.isArray(vector)) {
    return false;
  }
  
  if (vector.length !== expectedDimensions) {
    return false;
  }
  
  // Check all elements are numbers
  return vector.every(val => typeof val === 'number' && !isNaN(val) && isFinite(val));
}

/**
 * Calculate cosine similarity between two vectors
 * @param {Array} vector1 - First vector
 * @param {Array} vector2 - Second vector
 * @returns {number} Cosine similarity (0 to 1)
 */
function cosineSimilarity(vector1, vector2) {
  if (vector1.length !== vector2.length) {
    throw new Error('Vectors must have the same dimensions');
  }
  
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;
  
  for (let i = 0; i < vector1.length; i++) {
    dotProduct += vector1[i] * vector2[i];
    magnitude1 += vector1[i] * vector1[i];
    magnitude2 += vector2[i] * vector2[i];
  }
  
  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);
  
  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }
  
  return dotProduct / (magnitude1 * magnitude2);
}

/**
 * Optimize vector storage by quantization
 * @param {Array} vector - Vector to quantize
 * @param {number} bits - Number of bits for quantization (8, 16, 32)
 * @returns {Array} Quantized vector
 */
function quantizeVector(vector, bits = 16) {
  const maxVal = Math.max(...vector.map(Math.abs));
  const scale = (Math.pow(2, bits - 1) - 1) / maxVal;
  
  return vector.map(val => {
    const quantized = Math.round(val * scale);
    return quantized / scale;
  });
}

module.exports = {
  insertWithVector,
  searchSimilarVectors,
  updateVector,
  calculateVectorDistance,
  batchInsertWithVectors,
  findNearestNeighbors,
  generateEmbedding,
  validateVectorDimensions,
  cosineSimilarity,
  quantizeVector
};