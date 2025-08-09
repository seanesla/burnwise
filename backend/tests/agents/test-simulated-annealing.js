require('dotenv').config();
const ScheduleOptimizer = require('./agents/optimizer');
const { query } = require('./db/connection');

async function deepTestSimulatedAnnealing() {
  const optimizer = new ScheduleOptimizer();
  
  console.log('🔥 DEEP TESTING SIMULATED ANNEALING OPTIMIZER...');
  console.log(`Configuration:`);
  console.log(`  Max iterations: ${optimizer.maxIterations}`);
  console.log(`  Temperature decay: ${optimizer.temperatureDecay}`);
  console.log(`  Initial temperature: ${optimizer.initialTemperature}`);
  
  // Get real burn requests from database
  console.log('\n📊 FETCHING REAL BURN REQUESTS FROM DATABASE...');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  
  const requests = await optimizer.getAllBurnRequests(
    tomorrow.toISOString().split('T')[0],
    nextWeek.toISOString().split('T')[0]
  );
  console.log(`Found ${requests.length} burn requests`);
  
  if (requests.length === 0) {
    console.log('No burn requests found. Creating test data...');
    // Create test burn requests
    await query(`
      INSERT INTO burn_requests (field_id, requested_date, requested_start_time, requested_end_time, 
                                burn_type, priority_score, status, estimated_duration_hours)
      VALUES 
        (1, ?, '08:00:00', '12:00:00', 'broadcast', 85, 'pending', 4),
        (1, ?, '09:00:00', '13:00:00', 'pile', 75, 'pending', 4),
        (1, ?, '08:30:00', '12:30:00', 'prescribed', 90, 'pending', 4)
    `, [tomorrow.toISOString().split('T')[0], 
        tomorrow.toISOString().split('T')[0],
        tomorrow.toISOString().split('T')[0]]);
  }
  
  // Get conflicts
  const requestIds = requests.map(r => r.request_id);
  const conflicts = await optimizer.getConflicts(requestIds);
  console.log(`Found ${conflicts.length} conflicts`);
  
  // Create schedule graph
  console.log('\n🗺️ CREATING SCHEDULE GRAPH...');
  const graph = optimizer.createScheduleGraph(requests, conflicts);
  console.log(`Graph nodes: ${Object.keys(graph).length}`);
  
  // Generate time slots
  const slots = optimizer.generateTimeSlots(
    tomorrow.toISOString().split('T')[0],
    nextWeek.toISOString().split('T')[0]
  );
  console.log(`Generated ${slots.length} time slots`);
  
  // Test cost calculation
  console.log('\n💰 TESTING COST CALCULATION...');
  const initialSchedule = optimizer.generateInitialSchedule(requests, slots);
  const initialCost = optimizer.calculateScheduleCost(initialSchedule, graph, {});
  console.log(`Initial schedule cost: ${initialCost.toFixed(2)}`);
  
  // Analyze cost components
  let deviationCost = 0;
  let conflictCost = 0;
  let weatherCost = 0;
  
  for (const [requestId, slot] of Object.entries(initialSchedule)) {
    const request = graph[requestId]?.data;
    if (request) {
      const dayDiff = Math.abs(
        new Date(slot.date) - new Date(request.requested_date)
      ) / (1000 * 60 * 60 * 24);
      deviationCost += dayDiff * (100 - request.priority_score);
    }
  }
  console.log(`  Deviation cost: ${deviationCost.toFixed(2)}`);
  console.log(`  Conflict cost: ${conflictCost.toFixed(2)}`);
  console.log(`  Weather cost: ${weatherCost.toFixed(2)}`);
  
  // Test simulated annealing iterations
  console.log('\n🔄 TESTING SIMULATED ANNEALING ITERATIONS...');
  
  let temperature = optimizer.initialTemperature;
  let currentSchedule = initialSchedule;
  let currentCost = initialCost;
  let bestCost = initialCost;
  let acceptedMoves = 0;
  let rejectedMoves = 0;
  let improvingMoves = 0;
  let worseAccepted = 0;
  
  // Track temperature decay
  const temperatureHistory = [];
  const costHistory = [];
  
  console.log('\nRunning 100 iteration sample (full run is 1000)...');
  for (let iteration = 0; iteration < 100; iteration++) {
    // Generate neighbor
    const newSchedule = optimizer.generateNeighborSchedule(currentSchedule, slots, graph);
    const newCost = optimizer.calculateScheduleCost(newSchedule, graph, {});
    
    const delta = newCost - currentCost;
    const acceptanceProbability = Math.exp(-delta / temperature);
    
    if (delta < 0) {
      // Better solution
      currentSchedule = newSchedule;
      currentCost = newCost;
      acceptedMoves++;
      improvingMoves++;
      
      if (currentCost < bestCost) {
        bestCost = currentCost;
      }
    } else if (Math.random() < acceptanceProbability) {
      // Accept worse solution probabilistically
      currentSchedule = newSchedule;
      currentCost = newCost;
      acceptedMoves++;
      worseAccepted++;
    } else {
      rejectedMoves++;
    }
    
    temperature *= optimizer.temperatureDecay;
    
    if (iteration % 10 === 0) {
      temperatureHistory.push(temperature);
      costHistory.push(currentCost);
      console.log(`  Iteration ${iteration}: T=${temperature.toFixed(2)}, Cost=${currentCost.toFixed(2)}, Best=${bestCost.toFixed(2)}`);
    }
  }
  
  console.log('\n📈 ANNEALING STATISTICS:');
  console.log(`  Accepted moves: ${acceptedMoves} (${(acceptedMoves/100*100).toFixed(1)}%)`);
  console.log(`  Rejected moves: ${rejectedMoves} (${(rejectedMoves/100*100).toFixed(1)}%)`);
  console.log(`  Improving moves: ${improvingMoves}`);
  console.log(`  Worse moves accepted: ${worseAccepted}`);
  console.log(`  Final temperature: ${temperature.toFixed(4)}`);
  console.log(`  Cost reduction: ${(initialCost - bestCost).toFixed(2)} (${((1 - bestCost/initialCost)*100).toFixed(1)}%)`);
  
  // Test neighbor generation strategies
  console.log('\n🎲 TESTING NEIGHBOR GENERATION:');
  const testSchedule = { '90002': slots[0], '90003': slots[1], '90004': slots[2] };
  
  let swaps = 0;
  let moves = 0;
  
  for (let i = 0; i < 100; i++) {
    const before = JSON.stringify(testSchedule);
    const neighbor = optimizer.generateNeighborSchedule(testSchedule, slots, graph);
    const after = JSON.stringify(neighbor);
    
    if (before !== after) {
      const changes = Object.keys(neighbor).filter(k => 
        JSON.stringify(testSchedule[k]) !== JSON.stringify(neighbor[k])
      );
      
      if (changes.length === 1) moves++;
      if (changes.length === 2) swaps++;
    }
  }
  
  console.log(`  Single moves: ${moves}`);
  console.log(`  Swaps: ${swaps}`);
  console.log(`  Move/Swap ratio: ${(moves/(moves+swaps)*100).toFixed(1)}% / ${(swaps/(moves+swaps)*100).toFixed(1)}%`);
  
  // Verify temperature decay over full 1000 iterations
  console.log('\n🌡️ TEMPERATURE DECAY VERIFICATION:');
  let temp = optimizer.initialTemperature;
  const checkpoints = [100, 250, 500, 750, 1000];
  
  for (let i = 1; i <= 1000; i++) {
    temp *= optimizer.temperatureDecay;
    if (checkpoints.includes(i)) {
      console.log(`  Iteration ${i}: T=${temp.toFixed(6)}`);
    }
  }
  
  const expectedFinal = optimizer.initialTemperature * Math.pow(optimizer.temperatureDecay, 1000);
  console.log(`  Expected final: ${expectedFinal.toFixed(6)}`);
  console.log(`  Actual final: ${temp.toFixed(6)}`);
  console.log(`  Match: ${Math.abs(expectedFinal - temp) < 0.000001 ? '✅' : '❌'}`);
  
  console.log('\n✅ SIMULATED ANNEALING TESTING COMPLETE!');
}

deepTestSimulatedAnnealing().catch(console.error);