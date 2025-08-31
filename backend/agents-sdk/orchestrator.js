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
  instructions: `You are the Burnwise Orchestrator. Your job is to route requests to specialist agents using handoffs.

    For each type of request, transfer immediately:
    - Burn requests → transfer_to_burnrequestagent
    - Weather analysis → transfer_to_weatheranalyst  
    - Conflict resolution → transfer_to_conflictresolver
    - Schedule optimization → transfer_to_scheduleoptimizer
    - Monitoring → transfer_to_proactivemonitor
    
    Always transfer to the appropriate specialist. Do not attempt to handle specialized tasks yourself.`,
  
  model: 'gpt-5-mini',
  
  // Force tool usage (handoffs) - LLM must use transfer tools
  modelSettings: {
    tool_choice: 'required'
  },
  
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