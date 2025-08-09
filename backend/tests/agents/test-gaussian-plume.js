require('dotenv').config();
const WeatherAgent = require('./agents/weather');

async function deepTestGaussianPlume() {
  const weather = new WeatherAgent();

  console.log('🔬 DEEP TESTING GAUSSIAN PLUME MODEL...');

  // Test stability class calculation for different conditions
  console.log('\n📊 TESTING PASQUILL-GIFFORD STABILITY CLASSES:');
  const testConditions = [
    { hour: 12, windSpeed: 1.5, cloudCover: 20, desc: 'Day, low wind, clear' },
    { hour: 14, windSpeed: 3, cloudCover: 30, desc: 'Day, moderate wind, partial cloud' },
    { hour: 16, windSpeed: 6, cloudCover: 60, desc: 'Day, high wind, cloudy' },
    { hour: 20, windSpeed: 4, cloudCover: 50, desc: 'Night, moderate wind' },
    { hour: 2, windSpeed: 2.5, cloudCover: 10, desc: 'Night, low wind' },
    { hour: 3, windSpeed: 1, cloudCover: 0, desc: 'Night, very low wind' }
  ];

  for (const condition of testConditions) {
    const weather_obj = {
      timestamp: new Date().setHours(condition.hour),
      windSpeed: condition.windSpeed,
      cloudCover: condition.cloudCover
    };
    const stabilityClass = weather.calculateStabilityClass(weather_obj);
    const className = ['A (Very Unstable)', 'B (Unstable)', 'C (Slightly Unstable)', 'D (Neutral)', 'E (Slightly Stable)', 'F (Stable)'][stabilityClass];
    console.log(`  ${condition.desc}: Class ${className}`);
  }

  // Test actual smoke dispersion calculation
  console.log('\n🌬️ TESTING SMOKE DISPERSION WITH GAUSSIAN PLUME:');
  const burnConditions = {
    temperature: 20,
    humidity: 50,
    windSpeed: 5,
    windDirection: 270,
    cloudCover: 30,
    timestamp: new Date()
  };

  const dispersionResult = await weather.predictSmokeDispersion(
    { lat: 37.7, lon: -122.4 },
    100,  // 100 hectares
    burnConditions,
    4  // 4 hour burn
  );

  console.log('\nDispersion predictions by distance:');
  for (const pred of dispersionResult.predictions) {
    console.log(`  ${pred.distanceKm} km: PM2.5 = ${pred.pm25.toFixed(2)} μg/m³ [${pred.hazardLevel}] (arrival: ${pred.arrivalTimeMinutes.toFixed(1)} min)`);
  }

  console.log(`\nMax dispersion: ${dispersionResult.maxDispersionKm.toFixed(2)} km`);
  console.log(`Affected area: ${dispersionResult.affectedAreaKm2.toFixed(2)} km²`);
  console.log(`Confidence: ${dispersionResult.confidenceScore}`);

  // Test sigma Y and sigma Z calculations
  console.log('\n📈 TESTING DISPERSION COEFFICIENTS (Sigma Y/Z):');
  const distances = [100, 500, 1000, 5000, 10000];
  for (let stabilityClass = 0; stabilityClass <= 5; stabilityClass++) {
    const sigmaY = weather.getSigmaY(stabilityClass);
    const sigmaZ = weather.getSigmaZ(stabilityClass);
    console.log(`\nClass ${['A', 'B', 'C', 'D', 'E', 'F'][stabilityClass]}:`);
    for (const dist of distances) {
      console.log(`  ${dist}m: σy=${sigmaY(dist).toFixed(2)}m, σz=${sigmaZ(dist).toFixed(2)}m`);
    }
  }

  // Test 128-dimensional weather embedding
  console.log('\n🔢 TESTING 128-DIMENSIONAL WEATHER EMBEDDING:');
  const embedding = weather.createWeatherEmbedding(burnConditions);
  console.log(`Embedding dimensions: ${embedding.length}`);
  console.log(`Temperature component: ${embedding[0]}`);
  console.log(`Humidity component: ${embedding[1]}`);
  console.log(`Wind speed component: ${embedding[2]}`);
  console.log(`Wind direction component: ${embedding[3]}`);
  console.log(`Stability class one-hot encoding: [${embedding.slice(30, 36).join(', ')}]`);

  const nonZeroCount = embedding.filter(x => x !== 0).length;
  console.log(`Non-zero components: ${nonZeroCount}/128 (${(nonZeroCount/128*100).toFixed(1)}% dense)`);

  console.log('\n✅ GAUSSIAN PLUME MODEL TESTING COMPLETE!');
}

deepTestGaussianPlume().catch(console.error);