/**
 * Test GPT-5-mini Raw Response
 * See what GPT-5-mini actually returns
 */

require('dotenv').config();
const axios = require('axios');

async function testRawResponse() {
  console.log('Testing GPT-5-mini Raw Response Structure');
  console.log('=' .repeat(60));
  
  const API_KEY = process.env.OPENAI_API_KEY;
  
  try {
    // Test 1: Simple prompt
    console.log('\nTest 1: Simple completion...');
    const response1 = await axios.post('https://api.openai.com/v1/responses', {
      model: 'gpt-5-mini',
      input: 'Say exactly: GPT-5-MINI ACTIVE',
      reasoning: { effort: 'low' },
      max_output_tokens: 50
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Full response:', JSON.stringify(response1.data, null, 2));
    
    // Test 2: Try with different parameters
    console.log('\n\nTest 2: With text format...');
    const response2 = await axios.post('https://api.openai.com/v1/responses', {
      model: 'gpt-5-mini',
      input: 'What is 2+2? Answer with just the number.',
      reasoning: { effort: 'minimal' },
      text: {
        format: { type: 'text' },
        verbosity: 'high'
      },
      max_output_tokens: 50
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Full response:', JSON.stringify(response2.data, null, 2));
    
    // Test 3: Try without reasoning
    console.log('\n\nTest 3: Without reasoning parameter...');
    const response3 = await axios.post('https://api.openai.com/v1/responses', {
      model: 'gpt-5-mini',
      input: 'Hello, respond with: Hi there!',
      max_output_tokens: 20
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Full response:', JSON.stringify(response3.data, null, 2));
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testRawResponse();