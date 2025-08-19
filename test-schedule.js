const { optimizeBurnSchedule } = require('./backend/agents-sdk/ScheduleOptimizer');

async function testScheduleOptimization() {
  console.log('Testing simulated annealing schedule optimization...\n');
  
  const testDate = '2025-01-22';
  
  // Call the optimization function
  try {
    const result = await optimizeBurnSchedule(testDate);
    
    console.log('Optimization Result:');
    console.log('==================');
    console.log('Success:', result.success);
    console.log('Schedule ID:', result.scheduleId || 'N/A');
    console.log('Total Requests:', result.metrics?.totalRequests || 0);
    console.log('Scheduled:', result.metrics?.scheduled || 0);
    console.log('Conflicts:', result.metrics?.conflicts || 0);
    console.log('Utilization Rate:', (result.metrics?.utilizationRate || 0) + '%');
    console.log('Quality Score:', result.quality?.overallScore || 'N/A');
    console.log('Duration:', (result.duration || 0) + 'ms');
    
    if (result.schedule && result.schedule.length > 0) {
      console.log('\nScheduled Burns:');
      result.schedule.forEach((burn, i) => {
        console.log(`  ${i+1}. Farm ${burn.farmId}: ${burn.assignedStart}-${burn.assignedEnd} (${burn.acres} acres, conflict: ${burn.conflictScore})`);
      });
    }
    
    console.log('\n✅ Simulated annealing test complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Optimization failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testScheduleOptimization();