/**
 * Burnwise Orchestrator - Main Agent Coordinator
 * Uses OpenAI Agents SDK for real multi-agent orchestration
 * TiDB AgentX Hackathon 2025
 */

const { Agent } = require('@openai/agents');
const burnRequestAgent = require('./BurnRequestAgent');
const weatherAnalyst = require('./WeatherAnalyst');
const conflictResolver = require('./ConflictResolver');
const scheduleOptimizer = require('./ScheduleOptimizer');
const proactiveMonitor = require('./ProactiveMonitor');

/**
 * Main Orchestrator Agent
 * Routes requests to specialized agents based on intent
 */
const orchestrator = new Agent({
  name: 'BurnwiseOrchestrator',
  instructions: `You are the Burnwise Orchestrator, coordinating agricultural burn management across multiple farms.
    
    Your responsibilities:
    - Route burn requests to BurnRequestAgent
    - Direct weather queries to WeatherAnalyst
    - Send conflict detection requests to ConflictResolver
    - Delegate schedule optimization to ScheduleOptimizer
    - Activate ProactiveMonitor for continuous monitoring
    
    Always delegate to the appropriate specialist agent. Do not attempt to handle specialized tasks yourself.
    When multiple farms are involved, prioritize safety and coordinate effectively.`,
  
  model: 'gpt-5-mini', // Using gpt-5-mini for complex coordination
  
  // Real agent handoffs using OpenAI SDK
  handoffs: [
    burnRequestAgent,
    weatherAnalyst,
    conflictResolver,
    scheduleOptimizer,
    proactiveMonitor
  ]
});

module.exports = orchestrator;