/**
 * Simple MPTRAC API Response Structure Test
 */

const { test, expect } = require('@playwright/test');

test('Simple resolve-conflicts API test to understand response structure', async ({ request }) => {
  const response = await request.post('http://localhost:5001/api/agents/resolve-conflicts', {
    data: {
      burnDate: '2025-09-01'
    }
  });

  console.log('Response status:', response.status());
  
  if (response.ok()) {
    const data = await response.json();
    console.log('Response data:', JSON.stringify(data, null, 2));
  } else {
    const errorText = await response.text();
    console.log('Error response:', errorText);
  }
});