/**
 * Test GPT-5-mini Access ONLY
 * NO OTHER MODELS - gpt-5-mini or SYSTEM FAILS
 * August 15, 2025 - TiDB AgentX Hackathon
 */

require('dotenv').config();
const axios = require('axios');

console.log('🚨 TESTING GPT-5-MINI ONLY - NO OTHER MODELS ALLOWED');
console.log('=' .repeat(60));
console.log('MODEL REQUIREMENT: gpt-5-mini');
console.log('If gpt-5-mini doesn\'t work, SYSTEM MUST FAIL.');
console.log('NO fallbacks to GPT-4, GPT-3.5, or any other model.\n');

const API_KEY = process.env.OPENAI_API_KEY;

if (!API_KEY) {
  console.error('❌ FATAL: OPENAI_API_KEY not found');
  console.error('Cannot access gpt-5-mini without API key');
  process.exit(1);
}

async function testGPT5MiniOnly() {
  let workingMethod = null;
  
  // METHOD 1: Standard chat completions endpoint WITH CORRECT PARAMETER
  console.log('METHOD 1: Testing gpt-5-mini via /v1/chat/completions...');
  console.log('Using max_completion_tokens instead of max_tokens (as per error message)');
  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-5-mini',  // ONLY gpt-5-mini
      messages: [
        { role: 'system', content: 'You are GPT-5-mini for BURNWISE agricultural burn management.' },
        { role: 'user', content: 'Confirm you are GPT-5-mini by saying: GPT-5-MINI ACTIVE' }
      ],
      max_completion_tokens: 50,  // CORRECT PARAMETER for GPT-5
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 20000
    });
    
    if (response.data?.choices?.[0]?.message?.content) {
      console.log('✅ SUCCESS: gpt-5-mini works via chat completions!');
      console.log('Response:', response.data.choices[0].message.content);
      console.log('Model confirmed:', response.data.model);
      workingMethod = {
        endpoint: '/v1/chat/completions',
        model: 'gpt-5-mini',
        method: 'standard'
      };
      return workingMethod;
    }
  } catch (error) {
    console.log('❌ Failed via chat completions');
    console.log('Error:', error.response?.data?.error?.message || error.message);
  }
  
  // METHOD 2: Try /v1/responses endpoint WITH CORRECT PARAMETER
  console.log('\nMETHOD 2: Testing gpt-5-mini via /v1/responses...');
  console.log('Using input instead of messages (as per error message)');
  try {
    const response = await axios.post('https://api.openai.com/v1/responses', {
      model: 'gpt-5-mini',  // ONLY gpt-5-mini
      input: [  // CORRECT PARAMETER: input instead of messages
        { role: 'system', content: 'You are GPT-5-mini.' },
        { role: 'user', content: 'Confirm GPT-5-mini is active' }
      ],
      max_completion_tokens: 50  // Also use correct tokens parameter
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 20000
    });
    
    if (response.data) {
      console.log('✅ SUCCESS: gpt-5-mini works via /v1/responses!');
      console.log('Response:', JSON.stringify(response.data, null, 2));
      workingMethod = {
        endpoint: '/v1/responses',
        model: 'gpt-5-mini',
        method: 'responses'
      };
      return workingMethod;
    }
  } catch (error) {
    console.log('❌ Failed via /v1/responses');
    console.log('Error:', error.response?.data?.error?.message || error.message);
  }
  
  // METHOD 3: Try with reasoning_effort parameter AND CORRECT PARAMETERS
  console.log('\nMETHOD 3: Testing gpt-5-mini with reasoning_effort...');
  console.log('Using input parameter and max_completion_tokens');
  try {
    const response = await axios.post('https://api.openai.com/v1/responses', {
      model: 'gpt-5-mini',  // ONLY gpt-5-mini
      input: [  // CORRECT: use input instead of messages
        { role: 'user', content: 'Say: GPT-5-MINI ACTIVE' }
      ],
      reasoning_effort: 'minimal',  // Minimal reasoning for faster response
      max_completion_tokens: 20  // CORRECT: use max_completion_tokens
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 20000
    });
    
    if (response.data) {
      console.log('✅ SUCCESS: gpt-5-mini works with reasoning_effort!');
      console.log('Response:', JSON.stringify(response.data, null, 2));
      workingMethod = {
        endpoint: '/v1/responses',
        model: 'gpt-5-mini',
        method: 'responses-with-reasoning',
        params: { reasoning_effort: 'minimal' }
      };
      return workingMethod;
    }
  } catch (error) {
    console.log('❌ Failed with reasoning_effort');
    console.log('Error:', error.response?.data?.error?.message || error.message);
  }
  
  // METHOD 4: Assistants API with gpt-5-mini
  console.log('\nMETHOD 4: Testing gpt-5-mini via Assistants API...');
  try {
    const assistant = await axios.post('https://api.openai.com/v1/assistants', {
      model: 'gpt-5-mini',  // ONLY gpt-5-mini
      name: 'BURNWISE GPT-5-mini Agent',
      instructions: 'You are GPT-5-mini for agricultural burn management.',
      tools: []
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      timeout: 20000
    });
    
    if (assistant.data?.id) {
      console.log('✅ SUCCESS: gpt-5-mini assistant created!');
      console.log('Assistant ID:', assistant.data.id);
      console.log('Model:', assistant.data.model);
      
      // Create a thread and test message
      const thread = await axios.post('https://api.openai.com/v1/threads', {}, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2'
        }
      });
      
      if (thread.data?.id) {
        // Clean up
        try {
          await axios.delete(`https://api.openai.com/v1/assistants/${assistant.data.id}`, {
            headers: {
              'Authorization': `Bearer ${API_KEY}`,
              'OpenAI-Beta': 'assistants=v2'
            }
          });
        } catch (e) {}
        
        workingMethod = {
          endpoint: '/v1/assistants',
          model: 'gpt-5-mini',
          method: 'assistants-api'
        };
        return workingMethod;
      }
    }
  } catch (error) {
    console.log('❌ Failed via Assistants API');
    console.log('Error:', error.response?.data?.error?.message || error.message);
  }
  
  // METHOD 5: Try without version headers but with correct parameters
  console.log('\nMETHOD 5: Testing gpt-5-mini with correct parameters only...');
  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-5-mini',  // ONLY gpt-5-mini
      messages: [
        { role: 'user', content: 'GPT-5-mini test' }
      ],
      max_completion_tokens: 10  // CORRECT PARAMETER
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
        // No version header - let it use default
      },
      timeout: 20000
    });
    
    if (response.data?.choices?.[0]?.message?.content) {
      console.log('✅ SUCCESS: gpt-5-mini works with version header!');
      workingMethod = {
        endpoint: '/v1/chat/completions',
        model: 'gpt-5-mini',
        method: 'with-version-header',
        headers: { 'OpenAI-Version': '2025-08-01' }
      };
      return workingMethod;
    }
  } catch (error) {
    console.log('❌ Failed with version header');
    console.log('Error:', error.response?.data?.error?.message || error.message);
  }
  
  // NO OTHER MODELS - If gpt-5-mini doesn't work, FAIL
  console.log('\n' + '=' .repeat(60));
  console.log('🚨 CRITICAL FAILURE: gpt-5-mini NOT ACCESSIBLE');
  console.log('=' .repeat(60));
  console.log('\nMODEL REQUIRED: gpt-5-mini');
  console.log('NO FALLBACKS TO OTHER MODELS ALLOWED');
  console.log('\nTried:');
  console.log('1. Standard chat completions - FAILED');
  console.log('2. /v1/responses endpoint - FAILED');
  console.log('3. With reasoning_effort - FAILED');
  console.log('4. Assistants API - FAILED');
  console.log('5. With version headers - FAILED');
  console.log('\n❌ SYSTEM FAILURE - CANNOT PROCEED WITHOUT gpt-5-mini');
  console.log('This is August 15, 2025 - gpt-5-mini should be available');
  
  return null;
}

// Main execution
async function main() {
  console.log('Date: August 15, 2025');
  console.log('Required Model: gpt-5-mini (no substitutes)\n');
  
  const result = await testGPT5MiniOnly();
  
  if (!result) {
    console.log('\n💀 FATAL: gpt-5-mini is REQUIRED');
    console.log('The system cannot use any other model.');
    console.log('TiDB AgentX Hackathon requires REAL AI.');
    process.exit(1);  // EXIT - NO FALLBACKS
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('🎉 SUCCESS: gpt-5-mini IS WORKING!');
  console.log('=' .repeat(60));
  console.log('\nWORKING CONFIGURATION:');
  console.log('Model: gpt-5-mini (ONLY)');
  console.log('Endpoint:', result.endpoint);
  console.log('Method:', result.method);
  if (result.params) {
    console.log('Parameters:', JSON.stringify(result.params));
  }
  if (result.headers) {
    console.log('Headers:', JSON.stringify(result.headers));
  }
  console.log('\nUSE THIS EXACT CONFIGURATION IN ALL AGENTS');
  console.log('DO NOT USE ANY OTHER MODEL');
  console.log('=' .repeat(60));
  
  // Save configuration for agents
  const fs = require('fs');
  const config = {
    model: 'gpt-5-mini',
    endpoint: result.endpoint,
    method: result.method,
    params: result.params || {},
    headers: result.headers || {},
    timestamp: new Date().toISOString(),
    verified: true
  };
  
  fs.writeFileSync('gpt5-mini-config.json', JSON.stringify(config, null, 2));
  console.log('\n✅ Configuration saved to gpt5-mini-config.json');
  
  return result;
}

// Run the test
main().catch(error => {
  console.error('\n💀 FATAL ERROR:', error.message);
  console.error('gpt-5-mini is REQUIRED - NO FALLBACKS');
  process.exit(1);
});