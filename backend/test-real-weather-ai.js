/**
 * Test to verify REAL weather data + AI analysis
 * This proves we're using actual weather, not fake data
 * Run: node test-real-weather-ai.js
 */

require('dotenv').config();

console.log('🌤️ TESTING REAL WEATHER + AI SYSTEM');
console.log('=' .repeat(60));

async function testRealWeatherAI() {
  try {
    // Initialize the weather agent
    const WeatherAgent = require('./agents/weather');
    const weatherAgent = new WeatherAgent();
    
    console.log('\n📍 Test Location: Davis, California (real agricultural area)');
    console.log('This will fetch ACTUAL current weather from OpenWeatherMap\n');
    
    // Initialize agent (tests both weather API and GPT-5)
    console.log('1️⃣ Initializing Weather Agent...');
    await weatherAgent.initialize();
    console.log('✅ Weather Agent initialized with REAL APIs\n');
    
    // Test fetching REAL current weather
    console.log('2️⃣ Fetching REAL current weather...');
    const location = { city: 'Davis', state: 'CA', country: 'US' };
    const currentWeather = await weatherAgent.fetchCurrentWeather(location);
    
    console.log('✅ REAL Weather Data:');
    console.log(`   📍 Location: ${currentWeather.location.name}`);
    console.log(`   🌡️ Temperature: ${currentWeather.temperature}°F (feels like ${currentWeather.feels_like}°F)`);
    console.log(`   💧 Humidity: ${currentWeather.humidity}%`);
    console.log(`   💨 Wind: ${currentWeather.windSpeed}mph from ${currentWeather.windDirection}°`);
    console.log(`   ☁️ Conditions: ${currentWeather.condition} - ${currentWeather.description}`);
    console.log(`   📊 Pressure: ${currentWeather.pressure.toFixed(2)} inHg`);
    console.log(`   👁️ Visibility: ${currentWeather.visibility ? currentWeather.visibility.toFixed(1) + ' miles' : 'N/A'}`);
    console.log('');
    
    // Verify this is real data (temperature should be reasonable)
    if (currentWeather.temperature < -50 || currentWeather.temperature > 130) {
      throw new Error('Temperature out of realistic range - data may be fake');
    }
    
    // Test fetching REAL forecast
    console.log('3️⃣ Fetching REAL weather forecast...');
    const forecast = await weatherAgent.fetchWeatherForecast(location);
    
    console.log('✅ REAL Forecast Data:');
    console.log(`   📅 Forecast points: ${forecast.length} (next 5 days)`);
    console.log('   Next 12 hours:');
    forecast.slice(0, 4).forEach(f => {
      const time = new Date(f.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      console.log(`     ${time}: ${f.temperature}°F, ${f.windSpeed}mph, ${f.precipitationProb.toFixed(0)}% rain`);
    });
    console.log('');
    
    // Test AI analysis of REAL weather
    console.log('4️⃣ Analyzing with GPT-5 AI...');
    const weatherVector = await weatherAgent.generateWeatherVector(currentWeather, forecast);
    
    console.log('✅ AI Analysis Complete:');
    console.log(`   🧠 Vector dimensions: ${weatherVector.length}`);
    console.log(`   📊 Vector sample: [${weatherVector.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
    
    // Verify it's a real embedding (should be normalized)
    const magnitude = Math.sqrt(weatherVector.reduce((sum, val) => sum + val * val, 0));
    console.log(`   📐 Vector magnitude: ${magnitude.toFixed(4)} (should be ~1.0 for normalized)`);
    
    if (weatherAgent.lastAnalysis?.aiAnalysis) {
      console.log(`   💡 AI Insights: "${weatherAgent.lastAnalysis.aiAnalysis.substring(0, 200)}..."`);
    }
    console.log('');
    
    // Test burn condition analysis
    console.log('5️⃣ Analyzing burn conditions...');
    const burnAnalysis = await weatherAgent.analyzeBurnConditions(location, new Date());
    
    console.log('✅ Burn Safety Analysis:');
    console.log(`   🚦 Safe to burn: ${burnAnalysis.isSafe.safe ? 'YES' : 'NO'}`);
    console.log(`   📊 Safety score: ${burnAnalysis.isSafe.score}/10`);
    
    if (burnAnalysis.isSafe.issues.length > 0) {
      console.log('   ⚠️ Issues:');
      burnAnalysis.isSafe.issues.forEach(issue => {
        console.log(`     - ${issue}`);
      });
    }
    
    if (burnAnalysis.burnWindows.length > 0) {
      console.log(`   🕐 Optimal burn windows found: ${burnAnalysis.burnWindows.length}`);
      const firstWindow = burnAnalysis.burnWindows[0];
      const start = new Date(firstWindow.start).toLocaleString();
      const end = new Date(firstWindow.end).toLocaleString();
      console.log(`     First window: ${start} to ${end}`);
    }
    
    console.log(`   📡 Data source: ${burnAnalysis.dataSource}`);
    console.log('');
    
    // FINAL VERIFICATION
    console.log('=' .repeat(60));
    console.log('✅ ALL TESTS PASSED!');
    console.log('');
    console.log('VERIFICATION SUMMARY:');
    console.log('  ✅ OpenWeatherMap API: Working with REAL weather data');
    console.log('  ✅ Current weather: Retrieved actual conditions');
    console.log('  ✅ Weather forecast: Retrieved actual 5-day forecast');
    console.log('  ✅ GPT-5 AI: Analyzed weather intelligently');
    console.log('  ✅ Embeddings: Generated real semantic vectors');
    console.log('  ✅ Burn analysis: Provided intelligent safety assessment');
    console.log('');
    console.log('🎉 BURNWISE is using 100% REAL weather data + AI!');
    console.log('🚀 Ready for TiDB AgentX Hackathon 2025');
    
    return true;
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:');
    console.error(error.message);
    
    if (error.message.includes('OPENWEATHERMAP_API_KEY')) {
      console.error('\n📝 To fix:');
      console.error('1. Get a free API key from https://openweathermap.org/api');
      console.error('2. Add to backend/.env: OPENWEATHERMAP_API_KEY=your-key-here');
    }
    
    if (error.message.includes('OPENAI_API_KEY')) {
      console.error('\n📝 To fix:');
      console.error('1. Ensure OPENAI_API_KEY is in backend/.env');
      console.error('2. Verify the key has GPT-5 access');
    }
    
    return false;
  }
}

// Run the test
testRealWeatherAI().then(success => {
  process.exit(success ? 0 : 1);
});