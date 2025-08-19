const axios = require('axios');

async function testWorkflow() {
  console.log('Testing 5-agent workflow with REAL data...');
  
  const burnData = {
    burnRequest: {
      farm_id: 1,
      field_name: "North Field",
      acres: 150,
      crop_type: "wheat",
      burn_date: new Date(Date.now() + 24*60*60*1000).toISOString().split('T')[0],
      time_window_start: "08:00",
      time_window_end: "12:00",
      field_boundary: {
        type: "Polygon",
        coordinates: [[
          [-121.75, 38.54],
          [-121.75, 38.55],
          [-121.74, 38.55],
          [-121.74, 38.54],
          [-121.75, 38.54]
        ]]
      },
      contact_method: "sms"
    }
  };
  
  console.log('Sending burn request:', JSON.stringify(burnData, null, 2));
  
  try {
    const response = await axios.post('http://localhost:5001/api/agents/workflow', burnData, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('Success:', response.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    if (error.response?.data?.details) {
      console.error('Details:', error.response.data.details);
    }
  }
}

testWorkflow();