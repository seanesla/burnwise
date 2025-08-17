/**
 * Test GPT-5-mini via /v1/responses API
 * Based on Context7 documentation for GPT-5 models
 * August 15, 2025 - TiDB AgentX Hackathon
 */

require('dotenv').config();
const axios = require('axios');

console.log('🚨 TESTING GPT-5-MINI VIA RESPONSES API');
console.log('=' .repeat(60));
console.log('Using correct parameters from OpenAI docs:');
console.log('- input (not messages)');
console.log('- max_output_tokens (not max_tokens)');
console.log('');

const API_KEY = process.env.OPENAI_API_KEY;

if (!API_KEY) {
  console.error('❌ FATAL: OPENAI_API_KEY not found');
  process.exit(1);
}

async function testGPT5MiniResponses() {
  console.log('Testing GPT-5-mini via /v1/responses endpoint...\n');
  
  try {
    // According to Context7 docs, the responses API uses 'input' parameter
    const response = await axios.post('https://api.openai.com/v1/responses', {
      model: 'gpt-5-mini',
      input: 'You are GPT-5-mini for BURNWISE agricultural burn management. Confirm by saying: GPT-5-MINI ACTIVE',
      max_output_tokens: 50,  // Correct parameter from docs
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    if (response.data) {
      console.log('✅ SUCCESS: GPT-5-mini is working!');
      console.log('Response data:', JSON.stringify(response.data, null, 2));
      
      // Check for output field
      if (response.data.output || response.data.output_text) {
        console.log('\nModel output:', response.data.output || response.data.output_text);
      }
      
      return {
        success: true,
        model: 'gpt-5-mini',
        endpoint: '/v1/responses',
        response: response.data
      };
    }
  } catch (error) {
    console.log('❌ Failed to access GPT-5-mini');
    console.log('Status:', error.response?.status);
    console.log('Error:', error.response?.data?.error || error.message);
    
    // Try with reasoning parameter
    console.log('\nTrying with reasoning parameter...');
    try {
      const response2 = await axios.post('https://api.openai.com/v1/responses', {
        model: 'gpt-5-mini',
        input: 'Say: GPT-5-MINI ACTIVE',
        reasoning: {
          effort: 'low'  // Minimal reasoning from Context7 docs
        },
        max_output_tokens: 20
      }, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });
      
      if (response2.data) {
        console.log('✅ SUCCESS with reasoning parameter!');
        console.log('Response:', JSON.stringify(response2.data, null, 2));
        return {
          success: true,
          model: 'gpt-5-mini',
          endpoint: '/v1/responses',
          params: { reasoning: { effort: 'low' } }
        };
      }
    } catch (error2) {
      console.log('❌ Failed with reasoning parameter');
      console.log('Error:', error2.response?.data?.error || error2.message);
    }
  }
  
  return null;
}

// Create GPT-5-mini client class for use in agents
class GPT5MiniClient {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY required for GPT-5-mini');
    }
  }
  
  async complete(input, maxTokens = 500) {
    const response = await axios.post('https://api.openai.com/v1/responses', {
      model: 'gpt-5-mini',
      input: input,
      max_output_tokens: maxTokens,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    return response.data.output || response.data.output_text || '';
  }
  
  async analyze(prompt) {
    return this.complete(prompt, 1000);
  }
}

// Main execution
async function main() {
  console.log('Date: August 15, 2025');
  console.log('Testing GPT-5-mini as documented in OpenAI API Reference\n');
  
  const result = await testGPT5MiniResponses();
  
  if (!result) {
    console.log('\n💀 FATAL: GPT-5-mini not accessible');
    console.log('NO FALLBACKS - System requires GPT-5-mini');
    process.exit(1);
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('🎉 GPT-5-MINI CONFIGURATION VERIFIED');
  console.log('=' .repeat(60));
  console.log('\nUse this client in all agents:');
  console.log('```javascript');
  console.log('const client = new GPT5MiniClient();');
  console.log('const response = await client.analyze("Your prompt here");');
  console.log('```');
  
  // Test the client class
  console.log('\nTesting GPT5MiniClient class...');
  try {
    const client = new GPT5MiniClient();
    const testResponse = await client.analyze('Test GPT-5-mini client');
    console.log('✅ Client class works!');
    console.log('Response:', testResponse);
  } catch (error) {
    console.log('❌ Client class failed:', error.message);
  }
  
  // Save working configuration
  const fs = require('fs');
  const config = {
    model: 'gpt-5-mini',
    endpoint: '/v1/responses',
    method: 'responses-api',
    parameters: {
      input: 'string or array',
      max_output_tokens: 'number',
      temperature: 'optional',
      reasoning: 'optional'
    },
    timestamp: new Date().toISOString()
  };
  
  fs.writeFileSync('gpt5-mini-working-config.json', JSON.stringify(config, null, 2));
  console.log('\n✅ Configuration saved to gpt5-mini-working-config.json');
}

// Export for use in other files
module.exports = { GPT5MiniClient };

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('\n💀 FATAL:', error.message);
    process.exit(1);
  });
}