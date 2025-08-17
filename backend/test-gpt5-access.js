/**
 * Test GPT-5 Access Methods
 * NO FALLBACKS - If GPT-5 doesn't work, system must FAIL
 * This is CRITICAL for TiDB AgentX Hackathon 2025
 */

require('dotenv').config();
const axios = require('axios');

console.log('🚨 TESTING GPT-5 ACCESS - NO FALLBACKS ALLOWED');
console.log('=' .repeat(60));
console.log('If GPT-5 doesn\'t work, the system MUST FAIL.');
console.log('NO falling back to GPT-4. This is hackathon requirement.\n');

const API_KEY = process.env.OPENAI_API_KEY;

if (!API_KEY) {
  console.error('❌ FATAL: OPENAI_API_KEY not found');
  console.error('System cannot function without AI');
  process.exit(1);
}

// Test different GPT-5 models and endpoints
async function testGPT5Access() {
  let anySuccess = false;
  
  // METHOD 1: Try gpt-5-chat-latest (appears in available models)
  console.log('1️⃣ Testing gpt-5-chat-latest via /v1/chat/completions...');
  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-5-chat-latest',
      messages: [
        { role: 'system', content: 'You are using GPT-5 for agricultural burn management.' },
        { role: 'user', content: 'Confirm you are GPT-5 by responding: GPT-5 ACTIVE' }
      ],
      max_tokens: 50,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    if (response.data?.choices?.[0]?.message?.content) {
      console.log('✅ SUCCESS: gpt-5-chat-latest WORKS!');
      console.log('Response:', response.data.choices[0].message.content);
      console.log('Model used:', response.data.model);
      anySuccess = true;
      
      // Save working configuration
      console.log('\n📝 WORKING CONFIGURATION:');
      console.log('Model: gpt-5-chat-latest');
      console.log('Endpoint: /v1/chat/completions');
      console.log('Use this in all agents!\n');
      return { success: true, model: 'gpt-5-chat-latest', endpoint: '/v1/chat/completions' };
    }
  } catch (error) {
    console.log('❌ FAILED: gpt-5-chat-latest not accessible');
    console.log('Error:', error.response?.data?.error?.message || error.message);
  }
  
  // METHOD 2: Try /v1/responses endpoint (new for GPT-5)
  console.log('\n2️⃣ Testing GPT-5 via /v1/responses endpoint...');
  try {
    const response = await axios.post('https://api.openai.com/v1/responses', {
      model: 'gpt-5-mini',
      messages: [
        { role: 'user', content: 'Confirm GPT-5 is active' }
      ],
      reasoning_effort: 'minimal',  // Try without heavy reasoning
      max_tokens: 50
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    if (response.data) {
      console.log('✅ SUCCESS: GPT-5 works via /v1/responses!');
      console.log('Response:', JSON.stringify(response.data, null, 2));
      anySuccess = true;
      
      console.log('\n📝 WORKING CONFIGURATION:');
      console.log('Model: gpt-5-mini');
      console.log('Endpoint: /v1/responses');
      console.log('Use this in all agents!\n');
      return { success: true, model: 'gpt-5-mini', endpoint: '/v1/responses' };
    }
  } catch (error) {
    console.log('❌ FAILED: /v1/responses endpoint not accessible');
    console.log('Error:', error.response?.data?.error?.message || error.message);
  }
  
  // METHOD 3: Try Assistants API with GPT-5
  console.log('\n3️⃣ Testing GPT-5 via Assistants API...');
  try {
    // Create an assistant with GPT-5
    const assistant = await axios.post('https://api.openai.com/v1/assistants', {
      model: 'gpt-5-mini',
      name: 'BURNWISE AI Agent',
      instructions: 'You are an agricultural burn management AI using GPT-5.',
      tools: []
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      timeout: 15000
    });
    
    if (assistant.data?.id) {
      console.log('✅ SUCCESS: GPT-5 assistant created!');
      console.log('Assistant ID:', assistant.data.id);
      console.log('Model:', assistant.data.model);
      
      // Clean up - delete the test assistant
      try {
        await axios.delete(`https://api.openai.com/v1/assistants/${assistant.data.id}`, {
          headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'OpenAI-Beta': 'assistants=v2'
          }
        });
      } catch (e) {
        // Ignore cleanup errors
      }
      
      anySuccess = true;
      console.log('\n📝 WORKING CONFIGURATION:');
      console.log('Model: gpt-5-mini');
      console.log('Endpoint: /v1/assistants');
      console.log('Method: Assistants API');
      console.log('Use this in all agents!\n');
      return { success: true, model: 'gpt-5-mini', endpoint: '/v1/assistants' };
    }
  } catch (error) {
    console.log('❌ FAILED: Assistants API with GPT-5 not accessible');
    console.log('Error:', error.response?.data?.error?.message || error.message);
  }
  
  // METHOD 4: Try gpt-5 directly (without -mini or -chat-latest)
  console.log('\n4️⃣ Testing gpt-5 model directly...');
  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-5',
      messages: [
        { role: 'user', content: 'Confirm GPT-5 active' }
      ],
      max_tokens: 10
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    if (response.data?.choices?.[0]?.message?.content) {
      console.log('✅ SUCCESS: gpt-5 model WORKS!');
      console.log('Response:', response.data.choices[0].message.content);
      anySuccess = true;
      return { success: true, model: 'gpt-5', endpoint: '/v1/chat/completions' };
    }
  } catch (error) {
    console.log('❌ FAILED: gpt-5 model not accessible');
    console.log('Error:', error.response?.data?.error?.message || error.message);
  }
  
  // NO FALLBACKS - If GPT-5 doesn't work, FAIL
  if (!anySuccess) {
    console.log('\n' + '=' .repeat(60));
    console.log('🚨 CRITICAL FAILURE: GPT-5 NOT ACCESSIBLE');
    console.log('=' .repeat(60));
    console.log('\nNO FALLBACKS ALLOWED - System cannot function without GPT-5');
    console.log('This is a hackathon requirement. We need REAL AI, not fallbacks.');
    console.log('\nPossible issues:');
    console.log('1. GPT-5 may not be available yet (it\'s August 2025)');
    console.log('2. Your API key may not have GPT-5 access');
    console.log('3. GPT-5 may require special permissions');
    console.log('\n❌ SYSTEM FAILURE - CANNOT PROCEED WITHOUT GPT-5');
    process.exit(1);  // EXIT WITH ERROR - NO FALLBACKS
  }
}

// Test embeddings (these should work)
async function testEmbeddings() {
  console.log('\n5️⃣ Testing embeddings (text-embedding-3-large)...');
  try {
    const response = await axios.post('https://api.openai.com/v1/embeddings', {
      model: 'text-embedding-3-large',
      input: 'Agricultural burn safety analysis',
      dimensions: 128
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data?.data?.[0]?.embedding) {
      const embedding = response.data.data[0].embedding;
      console.log('✅ Embeddings working!');
      console.log(`Dimensions: ${embedding.length}`);
      console.log(`Sample: [${embedding.slice(0, 3).map(v => v.toFixed(4)).join(', ')}...]`);
      return true;
    }
  } catch (error) {
    console.log('❌ Embeddings FAILED - this is critical!');
    console.log('Error:', error.response?.data?.error?.message || error.message);
    return false;
  }
}

// Main execution
async function main() {
  console.log('Starting GPT-5 access tests...\n');
  
  // Test GPT-5 access - MUST WORK OR FAIL
  const gpt5Result = await testGPT5Access();
  
  // Test embeddings
  const embeddingsWork = await testEmbeddings();
  
  if (!embeddingsWork) {
    console.log('\n❌ EMBEDDINGS NOT WORKING - SYSTEM FAILURE');
    process.exit(1);
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('✅ AI SYSTEM VERIFIED');
  console.log('GPT-5: ACCESSIBLE');
  console.log('Embeddings: WORKING');
  console.log('NO FALLBACKS NEEDED - REAL AI ACTIVE');
  console.log('=' .repeat(60));
  
  return gpt5Result;
}

// Run the test
main().then(result => {
  if (result.success) {
    console.log('\n🎉 SUCCESS: Use this configuration in all agents:');
    console.log(`Model: ${result.model}`);
    console.log(`Endpoint: ${result.endpoint}`);
  }
}).catch(error => {
  console.error('\n❌ FATAL ERROR:', error.message);
  console.error('SYSTEM CANNOT FUNCTION - NO FALLBACKS ALLOWED');
  process.exit(1);
});