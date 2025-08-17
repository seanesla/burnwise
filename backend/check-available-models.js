/**
 * Check which OpenAI models are actually available
 */

require('dotenv').config();
const axios = require('axios');

async function checkModels() {
  try {
    const response = await axios.get('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      }
    });
    
    const models = response.data.data.map(m => m.id).sort();
    
    console.log('Available OpenAI Models:');
    console.log('=' .repeat(60));
    
    // Check for GPT-5 models
    const gpt5Models = models.filter(m => m.includes('gpt-5'));
    if (gpt5Models.length > 0) {
      console.log('\n✅ GPT-5 Models:');
      gpt5Models.forEach(m => console.log(`  - ${m}`));
    }
    
    // Check for GPT-4 models
    const gpt4Models = models.filter(m => m.includes('gpt-4'));
    if (gpt4Models.length > 0) {
      console.log('\n✅ GPT-4 Models:');
      gpt4Models.forEach(m => console.log(`  - ${m}`));
    }
    
    // Check for embedding models
    const embeddingModels = models.filter(m => m.includes('embedding'));
    if (embeddingModels.length > 0) {
      console.log('\n✅ Embedding Models:');
      embeddingModels.forEach(m => console.log(`  - ${m}`));
    }
    
    // Test which chat completion models work
    console.log('\n\nTesting Chat Completion Models:');
    console.log('=' .repeat(60));
    
    const testModels = ['gpt-5-mini', 'gpt-5', 'gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'];
    
    for (const model of testModels) {
      try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
          model: model,
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1
        }, {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        console.log(`✅ ${model}: WORKS`);
      } catch (error) {
        if (error.response?.status === 404 || error.response?.status === 400) {
          console.log(`❌ ${model}: NOT AVAILABLE`);
        } else {
          console.log(`⚠️ ${model}: ERROR - ${error.response?.data?.error?.message || error.message}`);
        }
      }
    }
    
  } catch (error) {
    console.error('Failed to check models:', error.message);
  }
}

checkModels();