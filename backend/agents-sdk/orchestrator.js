/**
 * Burnwise Orchestrator - Main Agent Coordinator
 * Uses OpenAI Agents SDK for real multi-agent orchestration
 * TiDB AgentX Hackathon 2025
 */

const { Agent, tool, run, setDefaultOpenAIKey } = require('@openai/agents');
const { z } = require('zod');

// Configure OpenAI API key for real agent execution
setDefaultOpenAIKey(process.env.OPENAI_API_KEY);
const burnRequestAgent = require('./BurnRequestAgent');
const weatherAnalyst = require('./WeatherAnalyst');
const conflictResolver = require('./ConflictResolver');
const scheduleOptimizer = require('./ScheduleOptimizer');
const proactiveMonitor = require('./ProactiveMonitor');

/**
 * Main Orchestrator Agent
 * Routes requests to specialized agents with direct execution
 */
const orchestrator = new Agent({
  name: 'BurnwiseOrchestrator',
  instructions: `You are the Burnwise Orchestrator. You route requests to specialist agents using the appropriate tools.

    Use these tools for routing:
    - route_to_burn_agent: For burn requests, scheduling, or field management
    - route_to_weather_agent: For weather analysis, forecasting, or conditions
    - route_to_conflict_agent: For conflict detection or resolution
    - route_to_schedule_agent: For optimization or timing questions
    - route_to_monitor_agent: For monitoring or alert setup
    
    Always use the appropriate routing tool. Do not attempt to answer directly.`,
  
  model: 'gpt-5-mini',
  
  // Force tool usage - must route through specialist agents
  modelSettings: {
    tool_choice: 'required'
  },

  // Stop after the first tool call (routing tool)
  toolUseBehavior: 'stop_on_first_tool',
  
  tools: [
    tool({
      name: 'route_to_burn_agent',
      description: 'Route burn requests to BurnRequestAgent',
      parameters: z.object({
        request: z.string().describe('The burn request to process')
      }),
      execute: async (input, context) => {
        // This will be handled by the API layer to trigger handoff events
        return {
          action: 'handoff',
          targetAgent: 'BurnRequestAgent',
          message: input.request,
          context: context
        };
      }
    }),
    
    tool({
      name: 'route_to_weather_agent',
      description: 'Route weather analysis to WeatherAnalyst',
      parameters: z.object({
        request: z.string().describe('The weather analysis request')
      }),
      execute: async (input, context) => {
        return {
          action: 'handoff',
          targetAgent: 'WeatherAnalyst', 
          message: input.request,
          context: context
        };
      }
    }),
    
    tool({
      name: 'route_to_conflict_agent',
      description: 'Route conflict resolution to ConflictResolver',
      parameters: z.object({
        request: z.string().describe('The conflict resolution request')
      }),
      execute: async (input, context) => {
        return {
          action: 'handoff',
          targetAgent: 'ConflictResolver',
          message: input.request,
          context: context
        };
      }
    }),
    
    tool({
      name: 'route_to_schedule_agent',
      description: 'Route schedule optimization to ScheduleOptimizer',
      parameters: z.object({
        request: z.string().describe('The schedule optimization request')
      }),
      execute: async (input, context) => {
        return {
          action: 'handoff',
          targetAgent: 'ScheduleOptimizer',
          message: input.request,
          context: context
        };
      }
    }),
    
    tool({
      name: 'route_to_monitor_agent',
      description: 'Route monitoring setup to ProactiveMonitor',
      parameters: z.object({
        request: z.string().describe('The monitoring request')
      }),
      execute: async (input, context) => {
        return {
          action: 'handoff',
          targetAgent: 'ProactiveMonitor',
          message: input.request,
          context: context
        };
      }
    })
  ]
});

module.exports = orchestrator;