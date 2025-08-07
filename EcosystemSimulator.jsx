import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import * as d3 from 'd3';

// Message Types - Define globally
const MessageTypes = {
  RESOURCE_LOCATION: 'resource',
  THREAT_WARNING: 'threat',
  ALLIANCE_PROPOSAL: 'alliance',
  HELP_REQUEST: 'help',
  KNOWLEDGE_SHARE: 'knowledge'
};

// Semantic Action Types
const ActionTypes = {
  FORAGE: 'FORAGE',
  EXPLORE: 'EXPLORE',
  FLEE: 'FLEE',
  REPRODUCE: 'REPRODUCE'
};

// Hard population cap
const HARD_MAX_POPULATION = 200;

// Message System for Agent Communication
class Message {
  constructor(sender, type, content, priority = 'normal') {
    this.id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    this.sender = sender;
    this.type = type;
    this.content = content;
    this.timestamp = Date.now();
    this.priority = priority;
    this.range = 10; // Communication range
  }
}

// Multi-Agent Reinforcement Learning Policy (intent-level)
class ReinforcementLearningPolicy {
  constructor() {
    this.qTable = new Map();
    this.epsilon = 0.15;
    this.alpha = 0.1;
    this.gamma = 0.9;
    this.lastState = null;
    this.lastActionType = null;
  }

  getAction(observation) {
    const state = this.discretizeState(observation);

    if (this.lastState && this.lastActionType) {
      const reward = this.calculateReward(observation);
      this.updateQValue(this.lastState, this.lastActionType, reward, state);
    }

    let selectedType;
    if (Math.random() < this.epsilon) {
      selectedType = this.getRandomActionType();
    } else {
      selectedType = this.getBestActionType(state);
    }

    this.lastState = state;
    this.lastActionType = selectedType;

    // Parameters are separate from Q-value; learning optimizes type selection
    return {
      type: selectedType,
      params: { speed: selectedType === ActionTypes.REPRODUCE ? 0.2 : (Math.random() * 0.5 + 0.5) }
    };
  }

  discretizeState(obs) {
    const energyBucket = Math.floor(obs.energy / 25);
    const nearbyBucket = Math.min(3, obs.nearbyCount);
    const infectedBucket = Math.min(2, obs.nearbyInfected);
    const resourceBucket = obs.nearestResourceDistance < 5 ? 0 : 1;
    return `${energyBucket}_${nearbyBucket}_${infectedBucket}_${resourceBucket}_${obs.status}`;
  }

  calculateReward(observation) {
    let reward = 0;
    reward += observation.energy * 0.01;
    reward -= observation.nearbyInfected * 2;
    if (observation.energy < 50 && observation.nearestResourceDistance < 10) reward += 5;
    reward -= observation.age * 0.001;
    return reward;
  }

  updateQValue(state, actionType, reward, nextState) {
    const key = `${state}_${actionType}`;
    const currentQ = this.qTable.get(key) || 0;
    const maxNextQ = this.getMaxQValue(nextState);
    const newQ = currentQ + this.alpha * (reward + this.gamma * maxNextQ - currentQ);
    this.qTable.set(key, newQ);
  }

  getMaxQValue(state) {
    const actions = this.getAllActionTypes();
    let maxQ = -Infinity;
    for (const type of actions) {
      const key = `${state}_${type}`;
      const q = this.qTable.get(key) || 0;
      if (q > maxQ) maxQ = q;
    }
    return maxQ === -Infinity ? 0 : maxQ;
  }

  getBestActionType(state) {
    const actions = this.getAllActionTypes();
    let best = actions[0];
    let maxQ = -Infinity;
    for (const type of actions) {
      const key = `${state}_${type}`;
      const q = this.qTable.get(key) || 0;
      if (q > maxQ) {
        maxQ = q;
        best = type;
      }
    }
    return best;
  }

  getRandomActionType() {
    const actions = this.getAllActionTypes();
    return actions[Math.floor(Math.random() * actions.length)];
  }

  getAllActionTypes() {
    return [ActionTypes.FORAGE, ActionTypes.EXPLORE, ActionTypes.FLEE, ActionTypes.REPRODUCE];
  }
}

// Social Memory System
class SocialMemory {
  constructor() {
    this.knownAgents = new Map();
    this.receivedMessages = [];
    this.maxMessages = 20;
  }

  rememberAgent(agentId, interaction) {
    if (!this.knownAgents.has(agentId)) {
      this.knownAgents.set(agentId, {
        firstMet: Date.now(),
        lastSeen: Date.now(),
        interactions: 0,
        sharedInfo: []
      });
    }
    const memory = this.knownAgents.get(agentId);
    memory.interactions++;
    memory.lastSeen = Date.now();
    if (interaction) {
      memory.sharedInfo.push({ type: interaction.type, timestamp: Date.now() });
    }
  }

  addReceivedMessage(message) {
    this.receivedMessages.push(message);
    if (this.receivedMessages.length > this.maxMessages) this.receivedMessages.shift();
  }

  getRecentMessages(count = 5) {
    return this.receivedMessages.slice(-count);
  }
}

// Base Agent Class
class Agent {
  constructor(id, position, genotype = null) {
    this.id = id;
    this.position = { ...position };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.genotype = genotype || this.generateRandomGenotype();
    this.phenotype = this.expressPhenotype();
    this.age = 0;
    this.energy = 100;
    this.status = 'Susceptible';
    this.infectionTimer = 0;
    this.maxLifespan = this.genotype.lifespan;
    this.mesh = null;
    this.learningPolicy = new ReinforcementLearningPolicy();
    this.reproductionCooldown = 0;
    this.isActive = false;
  }

  generateRandomGenotype() {
    return {
      speed: Math.random() * 2 + 0.5,
      size: Math.random() * 0.3 + 0.2,
      socialRadius: Math.random() * 5 + 2,
      infectionResistance: Math.random(),
      lifespan: Math.floor(Math.random() * 200 + 100),
      reproductionThreshold: Math.random() * 30 + 50,
      aggressiveness: Math.random(),
      forageEfficiency: Math.random()
    };
  }

  expressPhenotype() {
    return {
      maxSpeed: this.genotype.speed,
      radius: this.genotype.size,
      socialDistance: this.genotype.socialRadius,
      resistance: this.genotype.infectionResistance,
      aggression: this.genotype.aggressiveness,
      efficiency: this.genotype.forageEfficiency
    };
  }

  update(environment, agents, isSimulationRunning = true) {
    if (!isSimulationRunning) return 'continue';

    this.age++;

    // Density-driven upkeep
    const pressure = Math.min(2, agents.length / environment.carryingCapacity);
    const baseLoss = 0.3 * (1 + pressure * 0.5);
    const infectionPenalty = this.status === 'Infected' ? 0.4 : 0;
    const agePenalty = this.age > this.maxLifespan * 0.8 ? 0.2 : 0;
    this.energy = Math.max(0, this.energy - (baseLoss + infectionPenalty + agePenalty));
    this.reproductionCooldown = Math.max(0, this.reproductionCooldown - 1);

    const survivalThreshold = environment.getDynamicSurvivalThreshold(agents.length);

    // Death odds incorporate dynamic survival threshold
    let deathChance = 0;
    if (this.age >= this.maxLifespan) deathChance += 0.1;
    if (this.energy < survivalThreshold) {
      deathChance += ((survivalThreshold - this.energy) / Math.max(1, survivalThreshold)) * 0.02;
    }
    if (this.energy <= 5) deathChance += (5 - this.energy) * 0.05;
    if (Math.random() < deathChance) return 'die';

    // SIR progression
    if (this.status === 'Infected') {
      this.infectionTimer++;
      if (this.infectionTimer > 40) {
        this.status = 'Recovered';
        this.energy = Math.min(100, this.energy + 10);
        this.updateMeshColor();
      }
    }

    if (this.status === 'Susceptible') {
      const nearbyInfected = agents.filter(a => a.status === 'Infected' && this.distanceTo(a) < this.phenotype.socialDistance);
      if (nearbyInfected.length > 0) {
        const infectionProbability = 0.03 * (1 - this.phenotype.resistance);
        if (Math.random() < infectionProbability) {
          this.status = 'Infected';
          this.infectionTimer = 0;
          this.updateMeshColor();
        }
      }
    }

    // Foraging
    this.forage(environment);

    // Policy intent -> steering
    const observation = this.getObservation(environment, agents);
    const intent = this.learningPolicy.getAction(observation);
    this.applySteeringIntent(intent, environment, agents);

    // Kinematics
    this.updatePosition();

    // Reproduction controlled by dynamic threshold and hard cap
    const populationPressure = Math.min(2, agents.length / environment.carryingCapacity);
    const reproductionRate = 0.01 * (1 / (1 + populationPressure));
    const minEnergyToReproduce = Math.max(30, survivalThreshold + 10);
    if (
      agents.length < HARD_MAX_POPULATION &&
      this.energy > minEnergyToReproduce &&
      this.reproductionCooldown === 0 &&
      this.age > 20 &&
      Math.random() < reproductionRate
    ) {
      return 'reproduce';
    }

    return 'continue';
  }

  forage(environment) {
    environment.resources.forEach((resource, id) => {
      const dx = this.position.x - resource.position.x;
      const dz = this.position.z - resource.position.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      if (distance < 3) {
        const baseGain = resource.value * this.phenotype.efficiency;
        const efficiencyBonus = this.status === 'Recovered' ? 1.2 : 1.0;
        const energyGain = baseGain * efficiencyBonus;
        this.energy = Math.min(100, this.energy + energyGain);
        environment.consumeResource(id);
        if (this.energy > 80 && this.reproductionCooldown === 0) this.reproductionCooldown = Math.max(0, this.reproductionCooldown - 20);
      }
    });
  }

  getObservation(environment, agents) {
    const nearbyAgents = agents.filter(a => a.id !== this.id && this.distanceTo(a) < 8);
    const nearestResource = this.findNearestResource(environment);
    return {
      position: this.position,
      energy: this.energy,
      nearbyCount: nearbyAgents.length,
      nearbyInfected: nearbyAgents.filter(a => a.status === 'Infected').length,
      age: this.age,
      nearestResourceDistance: nearestResource ? nearestResource.distance : 100,
      status: this.status
    };
  }

  findNearestResource(environment) {
    let nearest = null;
    let minDistance = Infinity;
    environment.resources.forEach((resource) => {
      const dx = this.position.x - resource.position.x;
      const dz = this.position.z - resource.position.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = { resource, distance };
      }
    });
    return nearest;
  }

  applySteeringIntent(intent, environment, agents) {
    if (!this.isActive) return;
    const speed = Math.max(0, Math.min(1, intent.params?.speed ?? 0.6)) * this.phenotype.maxSpeed;

    if (intent.type === ActionTypes.FORAGE) {
      const nearestResource = this.findNearestResource(environment);
      if (nearestResource) {
        const dx = nearestResource.resource.position.x - this.position.x;
        const dz = nearestResource.resource.position.z - this.position.z;
        const mag = Math.hypot(dx, dz) || 1;
        this.velocity.x += (dx / mag) * speed;
        this.velocity.z += (dz / mag) * speed;
      }
    } else if (intent.type === ActionTypes.FLEE) {
      // Move away from nearest infected agent
      let threat = null;
      let minD = Infinity;
      for (const a of agents) {
        if (a.id === this.id || a.status !== 'Infected') continue;
        const d = this.distanceTo(a);
        if (d < minD) {
          minD = d;
          threat = a;
        }
      }
      if (threat && minD < 10) {
        const dx = this.position.x - threat.position.x;
        const dz = this.position.z - threat.position.z;
        const mag = Math.hypot(dx, dz) || 1;
        this.velocity.x += (dx / mag) * speed;
        this.velocity.z += (dz / mag) * speed;
      }
    } else if (intent.type === ActionTypes.EXPLORE) {
      const dir = Math.random() * Math.PI * 2;
      this.velocity.x += Math.cos(dir) * speed * 0.7;
      this.velocity.z += Math.sin(dir) * speed * 0.7;
    } else if (intent.type === ActionTypes.REPRODUCE) {
      // Minimal wandering
      this.velocity.x += (Math.random() - 0.5) * speed * 0.3;
      this.velocity.z += (Math.random() - 0.5) * speed * 0.3;
    }
  }

  updatePosition() {
    if (!this.isActive && !this.isPlayer) return;
    this.position.x += this.velocity.x;
    this.position.z += this.velocity.z;
    this.velocity.x *= 0.8;
    this.velocity.z *= 0.8;
    const bounds = 20;
    if (Math.abs(this.position.x) > bounds) {
      this.position.x = Math.sign(this.position.x) * bounds;
      this.velocity.x *= -0.5;
    }
    if (Math.abs(this.position.z) > bounds) {
      this.position.z = Math.sign(this.position.z) * bounds;
      this.velocity.z *= -0.5;
    }
    if (this.mesh) this.mesh.position.set(this.position.x, this.position.y, this.position.z);
  }

  distanceTo(other) {
    const dx = this.position.x - other.position.x;
    const dz = this.position.z - other.position.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  updateMeshColor() {
    if (this.mesh && this.mesh.material) {
      let color;
      switch (this.status) {
        case 'Infected': color = new THREE.Color(1, 0, 0); break;
        case 'Recovered': color = new THREE.Color(0, 1, 0); break;
        default: color = new THREE.Color(0, 0.5, 1);
      }
      this.mesh.material.color = color;
    }
  }

  reproduce(partner = null) {
    const newGenotype = {};
    Object.keys(this.genotype).forEach(trait => {
      newGenotype[trait] = this.genotype[trait];
      if (Math.random() < 0.15) {
        const mutationFactor = 0.8 + Math.random() * 0.4;
        newGenotype[trait] *= mutationFactor;
        if (trait === 'infectionResistance' || trait === 'aggressiveness' || trait === 'forageEfficiency') {
          newGenotype[trait] = Math.max(0, Math.min(1, newGenotype[trait]));
        }
      }
    });
    const offspring = new Agent(
      `agent_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      { x: this.position.x + (Math.random() - 0.5) * 3, y: 1, z: this.position.z + (Math.random() - 0.5) * 3 },
      newGenotype
    );
    this.reproductionCooldown = 60;
    this.energy -= 15;
    return offspring;
  }
}

// LLM-Powered Causal Agent
class CausalAgent extends Agent {
  constructor(id, position, genotype = null) {
    super(id, position, genotype);
    this.reasoningHistory = [];
    this.lastReasoning = null;
    this.reasoningMode = true;
    this.decisionCount = 0;
    this.reasoningSuccessRate = 0;
    this.llmAvailable = false;
    this.personality = this.generatePersonality();
    this.pendingReasoning = null;
    this.queuedAction = null;
    this.reasoningFrequency = 0.3;
    this.socialMemory = new SocialMemory();
    this.communicationCooldown = 0;
    this.messageQueue = [];
    this.lastCommunication = null;
    this.isActive = false;
    // Social
    this.knownResourceLocations = [];
    this.dangerZones = [];
    this.helpRequests = [];
    this.socialInfoInfluence = 0.7;
    this.informationDecay = 300;
  }

  reproduce(partner = null) {
    const baseOffspring = super.reproduce(partner);
    return new CausalAgent(baseOffspring.id, { ...baseOffspring.position }, baseOffspring.genotype);
  }

  generatePersonality() {
    const traits = ['cautious', 'aggressive', 'social', 'solitary', 'curious', 'conservative'];
    return traits[Math.floor(Math.random() * traits.length)];
  }

  async makeReasonedDecision(environment, agents) {
    const observation = this.getObservation(environment, agents);
    const reasoning = await this.simulateLLMReasoning(observation, agents);
    this.lastReasoning = reasoning;
    this.reasoningHistory.push({ step: this.age, observation, reasoning, action: reasoning.action });
    return reasoning.action;
  }

  // ... existing code ...
  buildStructuredPrompt(observation, agents) {
    const situation = this.analyzeSituation(observation, agents);
    const goals = this.defineGoals(observation);
    const recentMessages = this.socialMemory.getRecentMessages(3);
    return `You are an AI agent in a survival ecosystem simulation. Your personality is "${this.personality}".

CURRENT SITUATION:
- Energy: ${observation.energy}% (${observation.energy < 30 ? 'CRITICAL' : observation.energy < 60 ? 'LOW' : 'GOOD'})
- Health Status: ${observation.status} ${observation.status === 'Infected' ? '(INFECTED!)' : ''}
- Age: ${observation.age} steps
- Nearby Agents: ${observation.nearbyCount} (${observation.nearbyInfected} infected)
- Nearest Resource: ${Math.round(observation.nearestResourceDistance)} units away
- Location: (${Math.round(observation.position.x)}, ${Math.round(observation.position.z)})

ENVIRONMENT:
- Population Density: ${situation.populationDensity < 3 ? 'sparse' : situation.populationDensity < 7 ? 'moderate' : 'crowded'}

PRIMARY GOALS (by priority):
${goals.slice(0, 3).map((g, i) => `${i + 1}. ${g.goal} (urgency: ${g.urgency.toFixed(1)})`).join('\n')}

Recent messages received: ${recentMessages.map(m => `${m.type}: ${m.content.message}`).join('; ') || 'none'}

CAPABILITIES:
- forage: Move toward and collect resources
- avoid: Move away from threats/infected agents
- explore: Random movement to discover new areas
- reproduce: Create offspring if energy > 60

Respond with JSON:
{
  "action": "forage|avoid|explore|reproduce",
  "intensity": 0.1-1.0,
  "direction": 0-6.28,
  "reasoning": "Brief explanation",
  "confidence": 0.0-1.0
}`;
  }

  async simulateLLMReasoning(observation, agents) {
    const prompt = this.buildCausalPrompt(observation, agents);
    const chainOfThought = this.generateChainOfThought(prompt, observation);
    const action = this.reasonToAction(chainOfThought, observation);
    this.decisionCount++;
    return { action, chainOfThought, confidence: Math.random() * 0.4 + 0.6, reasoning: chainOfThought.conclusion };
  }

  buildCausalPrompt(observation, agents) {
    return {
      role: `You are a ${this.personality} agent in a competitive ecosystem`,
      situation: this.analyzeSituation(observation, agents),
      goals: this.defineGoals(observation),
      constraints: this.identifyConstraints(observation, agents),
      examples: this.getRelevantExamples()
    };
  }

  analyzeSituation(observation, agents) {
    const nearbyThreats = agents.filter(a => a.status === 'Infected' && this.distanceTo(a) < 5).length;
    const resourceDistance = observation.nearestResourceDistance;
    const energyStatus = observation.energy < 30 ? 'critical' : observation.energy > 70 ? 'abundant' : 'moderate';
    return { energyStatus, nearbyThreats, resourceDistance, populationDensity: observation.nearbyCount, age: observation.age, season: 'current', weatherCondition: 'clear' };
  }

  defineGoals(observation) {
    const goals = [];
    if (observation.energy < 40) goals.push({ priority: 'high', goal: 'find_food', urgency: 10 - (observation.energy / 10) });
    if (observation.nearbyInfected > 0) goals.push({ priority: 'high', goal: 'avoid_infection', urgency: observation.nearbyInfected * 2 });
    if (observation.energy > 60 && this.age > 30) goals.push({ priority: 'medium', goal: 'reproduce', urgency: 3 });
    goals.push({ priority: 'low', goal: 'explore', urgency: 1 });
    return goals.sort((a, b) => b.urgency - a.urgency);
  }

  identifyConstraints(observation, agents) {
    return {
      energyLimitation: observation.energy < 20,
      infectionRisk: observation.nearbyInfected > 0,
      crowding: observation.nearbyCount > 5,
      ageFactors: this.age > this.maxLifespan * 0.8,
      reproductionCooldown: this.reproductionCooldown > 0
    };
  }

  getRelevantExamples() {
    return [
      { situation: "Low energy, nearby food, no threats", decision: "Move directly to food source", outcome: "Energy restored, survival extended", reasoning: "Direct action was optimal - no competing priorities" },
      { situation: "Moderate energy, infected agents nearby, distant food", decision: "Maintain distance, search for alternative food", outcome: "Avoided infection, found alternative resources", reasoning: "Infection risk outweighed immediate food need" }
    ];
  }

  generateChainOfThought(prompt, observation) {
    const thoughts = [];
    thoughts.push({ step: 1, type: 'situation_analysis', content: `Current situation: Energy at ${observation.energy}%, ${observation.nearbyInfected} infected nearby, nearest resource ${Math.round(observation.nearestResourceDistance)} units away.` });
    const primaryGoal = prompt.goals[0];
    thoughts.push({ step: 2, type: 'goal_prioritization', content: `Primary goal: ${primaryGoal?.goal || 'survive'} (urgency: ${primaryGoal?.urgency || 1}). This takes priority because ${this.explainGoalReasoning(primaryGoal, observation)}.` });
    const riskLevel = this.assessRisks(observation);
    thoughts.push({ step: 3, type: 'risk_assessment', content: `Risk assessment: ${riskLevel.level} risk. Main concerns: ${riskLevel.factors.join(', ')}. Risk tolerance based on ${this.personality} personality.` });
    const actionPlan = this.planAction(observation, primaryGoal, riskLevel);
    thoughts.push({ step: 4, type: 'action_planning', content: `Action plan: ${actionPlan.description}. Expected outcome: ${actionPlan.expectedOutcome}. Alternatives considered: ${actionPlan.alternatives.join(', ')}.` });
    thoughts.push({ step: 5, type: 'conclusion', content: `Decision: ${actionPlan.action}. Reasoning: ${actionPlan.justification}` });
    return { thoughts, conclusion: actionPlan.justification, confidence: actionPlan.confidence };
  }

  explainGoalReasoning(goal, observation) {
    if (!goal) return 'survival is the baseline imperative';
    switch (goal.goal) {
      case 'find_food': return `energy is ${observation.energy < 20 ? 'critically' : 'dangerously'} low`;
      case 'avoid_infection': return 'infection would severely compromise survival chances';
      case 'reproduce': return 'energy reserves allow for genetic contribution to next generation';
      default: return 'exploration maintains adaptive flexibility';
    }
  }

  assessRisks(observation) {
    const factors = [];
    let riskScore = 0;
    if (observation.energy < 30) { factors.push('energy depletion'); riskScore += 3; }
    if (observation.nearbyInfected > 0) { factors.push('infection exposure'); riskScore += observation.nearbyInfected * 2; }
    if (observation.nearbyCount > 5) { factors.push('resource competition'); riskScore += 1; }
    if (this.age > this.maxLifespan * 0.8) { factors.push('advanced age'); riskScore += 2; }
    const level = riskScore < 2 ? 'low' : riskScore < 5 ? 'moderate' : 'high';
    return { level, factors, score: riskScore };
  }

  planAction(observation, goal) {
    const alternatives = ['explore', 'rest', 'forage', 'socialize', 'isolate'];
    let selectedAction = 'explore';
    let description = 'Continue current behavior';
    let expectedOutcome = 'Maintain status quo';
    let justification = 'Default action when no clear priority emerges';
    let confidence = 0.5;
    if (goal?.goal === 'find_food' && observation.nearestResourceDistance < 10) {
      selectedAction = 'forage'; description = 'Move toward nearest resource'; expectedOutcome = 'Energy restoration'; justification = `Food is accessible (${Math.round(observation.nearestResourceDistance)} units)`; confidence = 0.8;
    } else if (observation.nearbyInfected > 0 && this.status === 'Susceptible') {
      selectedAction = 'avoid'; description = 'Maintain distance from infected agents'; expectedOutcome = 'Reduce infection probability'; justification = `${observation.nearbyInfected} infected nearby`; confidence = 0.9;
    } else if (observation.energy > 70 && this.reproductionCooldown === 0 && this.age > 30) {
      selectedAction = 'reproduce'; description = 'Seek reproduction opportunity'; expectedOutcome = 'Genetic propagation'; justification = 'High energy reserves and maturity'; confidence = 0.7;
    }
    return { action: selectedAction, description, expectedOutcome, justification, alternatives: alternatives.filter(a => a !== selectedAction), confidence };
  }

  reasonToAction(chainOfThought, observation) {
    const conclusion = chainOfThought.thoughts.find(t => t.type === 'conclusion');
    const actionType = conclusion?.content.match(/Decision: (\w+)/)?.[1] || 'explore';
    switch (actionType) {
      case 'forage': return { type: ActionTypes.FORAGE, params: { speed: 0.9 }, reasoning: 'Moving toward food source' };
      case 'avoid': return { type: ActionTypes.FLEE, params: { speed: 0.8 }, reasoning: 'Avoiding infection risk' };
      case 'reproduce': return { type: ActionTypes.REPRODUCE, params: { speed: 0.3 }, reasoning: 'Seeking reproductive opportunity' };
      default: return { type: ActionTypes.EXPLORE, params: { speed: 0.5 }, reasoning: 'Exploratory behavior' };
    }
  }

  // Check if social information was accurate (foundation for trust system)
  verifyInformation(environment, agents) {
    this.knownResourceLocations.forEach(tip => {
      const distance = Math.hypot(this.position.x - tip.location.x, this.position.z - tip.location.z);
      if (distance < 3 && !tip.verified) {
        const actualResource = this.findNearestResource(environment);
        const wasAccurate = actualResource && actualResource.distance < 5;
        tip.verified = wasAccurate;
        if (tip.source) {
          const memory = this.socialMemory.knownAgents.get(tip.source);
          if (memory) memory.sharedInfo.push({ type: 'verification', accurate: wasAccurate, infoType: 'resource', timestamp: Date.now() });
        }
      }
    });
    this.dangerZones.forEach(zone => {
      const distance = Math.hypot(this.position.x - zone.location.x, this.position.z - zone.location.z);
      if (distance < zone.radius * 1.5 && !zone.verified) {
        const observation = this.getObservation(environment, agents);
        const actuallyDangerous = observation.nearbyInfected > 0;
        zone.verified = actuallyDangerous;
        if (zone.source) {
          const memory = this.socialMemory.knownAgents.get(zone.source);
          if (memory) memory.sharedInfo.push({ type: 'verification', accurate: actuallyDangerous, infoType: 'threat', timestamp: Date.now() });
        }
      }
    });
  }

  async decideToCommunicate(agents, environment) {
    if (this.communicationCooldown > 0) return null;
    const nearbyAgents = agents.filter(a => a.id !== this.id && a instanceof CausalAgent && this.distanceTo(a) < 10);
    if (nearbyAgents.length === 0) return null;
    const observation = this.getObservation(environment, agents);
    let message = null;
    if (observation.nearbyInfected > 2 && observation.status === 'Susceptible') {
      this.communicationCooldown = 15;
      message = new Message(this.id, MessageTypes.THREAT_WARNING, { message: `Warning: ${observation.nearbyInfected} infected agents here!`, data: { location: { x: this.position.x, z: this.position.z }, urgency: 'high', infectedCount: observation.nearbyInfected } }, 'high');
    } else if (observation.nearestResourceDistance < 3 && observation.energy > 50) {
      this.communicationCooldown = 20;
      message = new Message(this.id, MessageTypes.RESOURCE_LOCATION, { message: 'Found abundant resources here!', data: { location: { x: this.position.x, z: this.position.z }, urgency: 'normal', quality: 'high' } }, 'normal');
    } else if (observation.energy < 20 && this.personality !== 'solitary') {
      this.communicationCooldown = 30;
      message = new Message(this.id, MessageTypes.HELP_REQUEST, { message: 'Need help! Energy critical!', data: { location: { x: this.position.x, z: this.position.z }, urgency: 'high', energyLevel: observation.energy } }, 'high');
    } else if (Math.random() < 0.1 && this.knownResourceLocations.length > 0) {
      const recentTip = this.knownResourceLocations[this.knownResourceLocations.length - 1];
      if (recentTip && recentTip.location) {
        this.communicationCooldown = 25;
        message = new Message(this.id, MessageTypes.KNOWLEDGE_SHARE, { message: 'I know of resources elsewhere', data: { location: recentTip.location, urgency: 'low', age: this.age - recentTip.receivedAt } }, 'low');
      }
    }
    return message;
  }

  broadcastMessage(message, agents) {
    let recipientCount = 0;
    agents.forEach(agent => {
      if (agent.id !== this.id && agent instanceof CausalAgent && this.distanceTo(agent) <= message.range) {
        agent.receiveMessage(message);
        this.socialMemory.rememberAgent(agent.id, message);
        recipientCount++;
      }
    });
    this.lastCommunication = { message: message.content.message, type: message.type, recipients: recipientCount, timestamp: this.age };
    if (recipientCount > 0 && this.mesh) this.animateCommunication();
  }

  receiveMessage(message) {
    this.messageQueue.push(message);
    this.socialMemory.addReceivedMessage(message);
    this.socialMemory.rememberAgent(message.sender, null);
    switch (message.type) {
      case MessageTypes.RESOURCE_LOCATION: {
        const loc = message.content?.data?.location;
        if (loc) {
          this.knownResourceLocations.unshift({ location: { x: loc.x, z: loc.z }, receivedAt: this.age, confidence: 0.8, source: message.sender, verified: false });
          this.knownResourceLocations = this.knownResourceLocations.slice(0, 10);
        }
        break;
      }
      case MessageTypes.THREAT_WARNING: {
        const loc = message.content?.data?.location;
        if (loc) {
          this.dangerZones.unshift({ location: { x: loc.x, z: loc.z }, radius: 5, receivedAt: this.age, confidence: 0.7, source: message.sender, verified: false });
          this.dangerZones = this.dangerZones.slice(0, 10);
        }
        break;
      }
      case MessageTypes.HELP_REQUEST: {
        const loc = message.content?.data?.location;
        this.helpRequests.unshift({ requester: message.sender, location: loc ? { x: loc.x, z: loc.z } : null, urgency: message.content?.data?.urgency || 'high', receivedAt: this.age });
        this.helpRequests = this.helpRequests.slice(0, 10);
        break;
      }
    }
  }

  processMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      switch (message.type) {
        case MessageTypes.RESOURCE_LOCATION: {
          if (this.energy < 50) {
            const mem = this.socialMemory.knownAgents.get(message.sender);
            if (mem) mem.sharedInfo.push({ type: 'resource_tip', location: message.content.data.location, timestamp: Date.now() });
          }
          break;
        }
        case MessageTypes.THREAT_WARNING: {
          if (message.content.data.urgency === 'high') this.pendingThreatAvoidance = message.content.data.location;
          break;
        }
        case MessageTypes.HELP_REQUEST: {
          if (this.energy > 70 && this.personality !== 'solitary') this.considerHelping = message.sender;
          break;
        }
      }
    }
  }

  update(environment, agents, isSimulationRunning = true) {
    if (!isSimulationRunning) return 'continue';

    this.age++;

    // Density-driven upkeep
    const pressure = Math.min(2, agents.length / environment.carryingCapacity);
    const baseLoss = 0.3 * (1 + pressure * 0.5);
    const infectionPenalty = this.status === 'Infected' ? 0.4 : 0;
    const agePenalty = this.age > this.maxLifespan * 0.8 ? 0.2 : 0;
    this.energy = Math.max(0, this.energy - (baseLoss + infectionPenalty + agePenalty));
    this.reproductionCooldown = Math.max(0, this.reproductionCooldown - 1);
    this.communicationCooldown = Math.max(0, this.communicationCooldown - 1);

    const survivalThreshold = environment.getDynamicSurvivalThreshold(agents.length);

    // Death odds incorporate dynamic survival threshold
    let deathChance = 0;
    if (this.age >= this.maxLifespan) deathChance += 0.1;
    if (this.energy < survivalThreshold) deathChance += ((survivalThreshold - this.energy) / Math.max(1, survivalThreshold)) * 0.02;
    if (this.energy <= 5) deathChance += (5 - this.energy) * 0.05;
    if (Math.random() < deathChance) return 'die';

    // SIR mechanics
    if (this.status === 'Infected') {
      this.infectionTimer++;
      if (this.infectionTimer > 40) {
        this.status = 'Recovered';
        this.energy = Math.min(100, this.energy + 10);
        this.updateMeshColor();
      }
    }

    if (this.status === 'Susceptible') {
      const nearbyInfected = agents.filter(a => a.status === 'Infected' && this.distanceTo(a) < this.phenotype.socialDistance);
      if (nearbyInfected.length > 0) {
        const infectionProbability = 0.03 * (1 - this.phenotype.resistance);
        if (Math.random() < infectionProbability) {
          this.status = 'Infected';
          this.infectionTimer = 0;
          this.updateMeshColor();
        }
      }
    }

    this.forage(environment);

    // Process/verify social info
    this.processMessageQueue();
    this.verifyInformation(environment, agents);

    // Trust indicator
    if (this.mesh && this.mesh.userData.trustIndicator) {
      const avgTrust = this.calculateAverageTrust();
      const color = new THREE.Color();
      if (avgTrust > 0.6) color.setRGB(0, 1, 0); else if (avgTrust < 0.4) color.setRGB(1, 0, 0); else color.setRGB(1, 1, 0);
      this.mesh.userData.trustIndicator.material.color = color;
    }

    // Communication decisions
    if (Math.random() < 0.4 && this.communicationCooldown === 0) {
      this.decideToCommunicate(agents, environment).then(message => { if (message) this.broadcastMessage(message, agents); }).catch(() => {});
    }

    // Reasoning scheduling
    const shouldReason = Math.random() < this.reasoningFrequency && this.reasoningMode;
    if (shouldReason && !this.pendingReasoning) {
      this.pendingReasoning = this.makeReasonedDecision(environment, agents)
        .then(reasonedAction => { this.queuedAction = reasonedAction; this.pendingReasoning = null; })
        .catch(() => { this.pendingReasoning = null; });
    }

    if (this.queuedAction) {
      // Socially-informed steering on intent
      const intent = this.mapReasonedToIntent(this.queuedAction, environment);
      this.applySteeringIntentWithSocial(intent, environment, agents);
      this.queuedAction = null;
    } else {
      // RL intent + social influence for causal agents
      const observation = this.getObservation(environment, agents);
      const intent = this.learningPolicy.getAction(observation);
      this.applySteeringIntentWithSocial(intent, environment, agents);
    }

    this.updatePosition();

    // Reproduction controls
    const populationPressure = Math.min(2, agents.length / environment.carryingCapacity);
    const reproductionRate = 0.01 * (1 / (1 + populationPressure));
    const minEnergyToReproduce = Math.max(30, survivalThreshold + 10);
    if (agents.length < HARD_MAX_POPULATION && this.energy > minEnergyToReproduce && this.reproductionCooldown === 0 && this.age > 20 && Math.random() < reproductionRate) {
      return 'reproduce';
    }

    return 'continue';
  }

  mapReasonedToIntent(reasonedAction) {
    // Already in semantic form from reasonToAction
    return { type: reasonedAction.type, params: { speed: reasonedAction.params?.speed ?? 0.6 } };
  }

  applySteeringIntentWithSocial(intent, environment, agents) {
    if (!this.isActive) return;
    const speed = Math.max(0, Math.min(1, intent.params?.speed ?? 0.6)) * this.phenotype.maxSpeed;

    if (intent.type === ActionTypes.FORAGE) {
      // Prefer shared resource tips when hungry
      let target = null;
      if (this.energy < 40 && this.knownResourceLocations.length > 0) {
        const bestTip = this.knownResourceLocations.sort((a, b) => {
          const ageA = Math.max(0, this.age - (a.receivedAt ?? this.age));
          const ageB = Math.max(0, this.age - (b.receivedAt ?? this.age));
          const aScore = (a.confidence ?? 0.6) * (1 - ageA / this.informationDecay);
          const bScore = (b.confidence ?? 0.6) * (1 - ageB / this.informationDecay);
          return bScore - aScore;
        })[0];
        if (bestTip) target = bestTip.location;
      }
      if (!target) {
        const nearest = this.findNearestResource(environment);
        if (nearest) target = nearest.resource.position;
      }
      if (target) {
        const dx = target.x - this.position.x;
        const dz = target.z - this.position.z;
        const mag = Math.hypot(dx, dz) || 1;
        this.velocity.x += (dx / mag) * speed;
        this.velocity.z += (dz / mag) * speed;
      }
    } else if (intent.type === ActionTypes.FLEE) {
      // Bias from danger zones
      let ax = 0, az = 0;
      if (this.dangerZones.length > 0) {
        this.dangerZones.forEach(zone => {
          const dx = this.position.x - zone.location.x;
          const dz = this.position.z - zone.location.z;
          const dist = Math.hypot(dx, dz) || 1;
          if (dist < zone.radius * 2) { ax += (dx / dist); az += (dz / dist); }
        });
      }
      if (ax === 0 && az === 0) {
        // Fallback: away from nearest infected
        let threat = null; let minD = Infinity;
        for (const a of agents) { if (a.id !== this.id && a.status === 'Infected') { const d = this.distanceTo(a); if (d < minD) { minD = d; threat = a; } } }
        if (threat) { ax = this.position.x - threat.position.x; az = this.position.z - threat.position.z; }
      }
      const mag = Math.hypot(ax, az) || 1;
      this.velocity.x += (ax / mag) * speed;
      this.velocity.z += (az / mag) * speed;
    } else if (intent.type === ActionTypes.EXPLORE) {
      const dir = Math.random() * Math.PI * 2;
      this.velocity.x += Math.cos(dir) * speed * 0.7;
      this.velocity.z += Math.sin(dir) * speed * 0.7;
    } else if (intent.type === ActionTypes.REPRODUCE) {
      this.velocity.x += (Math.random() - 0.5) * speed * 0.3;
      this.velocity.z += (Math.random() - 0.5) * speed * 0.3;
    }
  }

  calculateAverageTrust() {
    let totalTrust = 0, count = 0;
    this.socialMemory.knownAgents.forEach(memory => {
      let trust = 0.5;
      const verifications = memory.sharedInfo.filter(info => info.type === 'verification');
      verifications.forEach(v => { trust += v.accurate ? 0.1 : -0.2; });
      trust = Math.max(0, Math.min(1, trust));
      totalTrust += trust; count++;
    });
    return count > 0 ? totalTrust / count : 0.5;
  }

  animateCommunication() {
    if (this.mesh && this.mesh.userData.communicationRing) {
      const ring = this.mesh.userData.communicationRing;
      if (ring.animationId) cancelAnimationFrame(ring.animationId);
      ring.visible = true;
      ring.material.opacity = 0.8;
      if (this.lastCommunication) {
        switch (this.lastCommunication.type) {
          case MessageTypes.THREAT_WARNING: ring.material.color = new THREE.Color(1, 0, 0); break;
          case MessageTypes.RESOURCE_LOCATION: ring.material.color = new THREE.Color(0, 1, 0); break;
          case MessageTypes.HELP_REQUEST: ring.material.color = new THREE.Color(1, 1, 0); break;
          default: ring.material.color = new THREE.Color(0, 0.5, 1);
        }
      }
      let scale = 1, opacity = 0.8;
      const animationStep = () => {
        scale += 0.05; opacity -= 0.03;
        ring.scale.set(scale, scale, 1);
        ring.material.opacity = opacity;
        if (opacity > 0) ring.animationId = requestAnimationFrame(animationStep);
        else { ring.visible = false; ring.scale.set(1, 1, 1); ring.animationId = null; }
      };
      ring.animationId = requestAnimationFrame(animationStep);
    }
  }

  updateMeshColor() {
    if (this.mesh && this.mesh.material) {
      let color;
      switch (this.status) {
        case 'Infected': color = new THREE.Color(1, 0, 0); break;
        case 'Recovered': color = new THREE.Color(0, 1, 0); break;
        default: color = new THREE.Color(1, 0.8, 0.2);
      }
      this.mesh.material.color = color;
    }
  }
}

// Dynamic Environment System
class Environment {
  constructor() {
    this.resources = new Map();
    this.weather = 'clear';
    this.temperature = 20;
    this.season = 'spring';
    this.cycleStep = 0;
    this.carryingCapacity = 100;
  }

  update() {
    this.cycleStep++;
    const seasonLength = 150;
    const seasonPhase = (this.cycleStep % (seasonLength * 4)) / seasonLength;
    if (seasonPhase < 1) this.season = 'spring';
    else if (seasonPhase < 2) this.season = 'summer';
    else if (seasonPhase < 3) this.season = 'autumn';
    else this.season = 'winter';
    this.temperature = 20 + Math.sin((seasonPhase - 1) * Math.PI) * 15;
    this.regenerateResources();
    if (Math.random() < 0.02) this.weather = Math.random() < 0.7 ? 'clear' : Math.random() < 0.5 ? 'rain' : 'storm';
    return this.clone();
  }

  clone() {
    const newEnv = new Environment();
    newEnv.resources = new Map(this.resources);
    newEnv.weather = this.weather;
    newEnv.temperature = this.temperature;
    newEnv.season = this.season;
    newEnv.cycleStep = this.cycleStep;
    newEnv.carryingCapacity = this.carryingCapacity;
    return newEnv;
  }

  regenerateResources() {
    const resourceCount = this.resources.size;
    const seasonMultiplier = this.season === 'winter' ? 0.6 : this.season === 'spring' ? 1.4 : this.season === 'summer' ? 1.2 : 1.0;
    const maxResources = Math.floor((this.season === 'winter' ? 40 : 60) * seasonMultiplier);
    if (resourceCount < maxResources && Math.random() < 0.6) {
      const numNew = Math.min(3, maxResources - resourceCount);
      for (let i = 0; i < numNew; i++) {
        const quality = Math.random();
        const id = `resource_${Date.now()}_${Math.random().toString(36).substr(2, 5)}_${i}`;
        const distance = Math.random() * 15 + 3;
        const angle = Math.random() * Math.PI * 2;
        this.resources.set(id, { position: { x: Math.cos(angle) * distance, z: Math.sin(angle) * distance }, value: quality * 20 + 10, quality });
      }
    }
    if (resourceCount < 10) {
      for (let i = 0; i < 5; i++) {
        const id = `emergency_${Date.now()}_${i}`;
        this.resources.set(id, { position: { x: (Math.random() - 0.5) * 20, z: (Math.random() - 0.5) * 20 }, value: 25, quality: 0.8 });
      }
    }
  }

  consumeResource(id) { this.resources.delete(id); }

  getDynamicSurvivalThreshold(populationSize) {
    const pressureFactor = populationSize / this.carryingCapacity;
    return Math.max(10, 30 * pressureFactor);
  }
}

// Player-Controlled Agent
class PlayerAgent extends Agent {
  constructor(id, position, genotype = null) {
    super(id, position, genotype);
    this.isPlayer = true;
    this.targetPosition = null;
    this.moveSpeed = 2.0;
    this.isActive = false; // Start inactive
  }

  setTargetPosition(x, z) { this.targetPosition = { x, z }; }

  update(environment, agents, isSimulationRunning = true) {
    if (!isSimulationRunning && !this.targetPosition) return 'continue';

    this.age++;
    const pressure = Math.min(2, agents.length / environment.carryingCapacity);
    const baseLoss = 0.25 * (1 + pressure * 0.5);
    const infectionPenalty = this.status === 'Infected' ? 0.3 : 0;
    const agePenalty = this.age > this.maxLifespan * 0.8 ? 0.2 : 0;
    this.energy = Math.max(0, this.energy - (baseLoss + infectionPenalty + agePenalty));
    this.reproductionCooldown = Math.max(0, this.reproductionCooldown - 1);

    const survivalThreshold = environment.getDynamicSurvivalThreshold(agents.length);
    let deathChance = 0;
    if (this.age >= this.maxLifespan) deathChance += 0.05;
    if (this.energy < survivalThreshold) deathChance += ((survivalThreshold - this.energy) / Math.max(1, survivalThreshold)) * 0.015;
    if (this.energy <= 5) deathChance += (5 - this.energy) * 0.03;
    if (Math.random() < deathChance) return 'die';

    // SIR mechanics
    if (this.status === 'Infected') {
      this.infectionTimer++;
      if (this.infectionTimer > 40) { this.status = 'Recovered'; this.energy = Math.min(100, this.energy + 15); this.updateMeshColor(); }
    }
    if (this.status === 'Susceptible') {
      const nearbyInfected = agents.filter(a => a.status === 'Infected' && this.distanceTo(a) < this.phenotype.socialDistance);
      if (nearbyInfected.length > 0) {
        const infectionProbability = 0.02 * (1 - this.phenotype.resistance);
        if (Math.random() < infectionProbability) { this.status = 'Infected'; this.infectionTimer = 0; this.updateMeshColor(); }
      }
    }

    this.forage(environment);

    // Player movement
    if (this.targetPosition) {
      const dx = this.targetPosition.x - this.position.x;
      const dz = this.targetPosition.z - this.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance > 0.5) { this.velocity.x = (dx / distance) * this.moveSpeed; this.velocity.z = (dz / distance) * this.moveSpeed; }
      else { this.targetPosition = null; this.velocity.x *= 0.5; this.velocity.z *= 0.5; }
    }

    this.updatePosition();
    return 'continue';
  }

  updateMeshColor() {
    if (!this.mesh || !this.mesh.material) return;
    let color;
    switch (this.status) {
      case 'Infected': color = new THREE.Color(1, 0, 0); break;
      case 'Recovered': color = new THREE.Color(0, 1, 0); break;
      default: color = new THREE.Color(1, 1, 1);
    }
    this.mesh.material.color = color;
    this.mesh.material.emissive = new THREE.Color(0.2, 0.2, 0.2);
  }
}

// Main Ecosystem Simulator Component
const EcosystemSimulator = () => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const resourceMeshesRef = useRef(new Map());
  const resourceInstancingRef = useRef({ mesh: null, idToIndex: new Map(), indexToId: [], threshold: 200 });
  const resourceDummyRef = useRef(new THREE.Object3D());
  const playerAgentRef = useRef(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const [agents, setAgents] = useState([]); // UI snapshot only
  const agentsRef = useRef([]); // single source of truth for logic
  const [environment, setEnvironment] = useState(new Environment());
  const [isRunning, setIsRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [playerStats, setPlayerStats] = useState(null);
  const [gameOver, setGameOver] = useState(false);
  const [cameraMode, setCameraMode] = useState('overview');
  const [stats, setStats] = useState({
    susceptible: 0, infected: 0, recovered: 0, total: 0, avgAge: 0, avgEnergy: 0,
    causalAgents: 0, rlAgents: 0, reasoningEvents: 0, communicationEvents: 0, activeMessages: 0
  });
  const [llmConfig] = useState({ enabled: false, endpoint: 'http://localhost:11434', model: 'gpt-oss:20b', reasoningFrequency: 0.3, showThoughts: true });
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [populationHistory, setPopulationHistory] = useState([]);

  const updateResourceVisualization = (scene, resources) => {
    if (!scene) return;

    const useInstancing = resources.size > resourceInstancingRef.current.threshold;

    // Switch to instancing mode
    if (useInstancing) {
      // Remove individual meshes if present
      if (resourceMeshesRef.current.size > 0) {
        resourceMeshesRef.current.forEach(mesh => scene.remove(mesh));
        resourceMeshesRef.current.clear();
      }
      // (Re)build instanced mesh if count changed or mesh missing
      const count = resources.size;
      if (!resourceInstancingRef.current.mesh || resourceInstancingRef.current.mesh.count !== count) {
        if (resourceInstancingRef.current.mesh) {
          scene.remove(resourceInstancingRef.current.mesh);
        }
        const geometry = new THREE.BoxGeometry(0.5, 0.3, 0.5);
        const material = new THREE.MeshLambertMaterial({ vertexColors: true });
        const instanced = new THREE.InstancedMesh(geometry, material, count);
        instanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        resourceInstancingRef.current.mesh = instanced;
        resourceInstancingRef.current.idToIndex = new Map();
        resourceInstancingRef.current.indexToId = [];
        scene.add(instanced);
      }
      const instanced = resourceInstancingRef.current.mesh;
      const dummy = resourceDummyRef.current;
      let index = 0;
      resources.forEach((resource, id) => {
        dummy.position.set(resource.position.x, 0.15, resource.position.z);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        instanced.setMatrixAt(index, dummy.matrix);
        const color = new THREE.Color().setHSL(0.3, 0.8, 0.3 + resource.quality * 0.4);
        if (instanced.setColorAt) instanced.setColorAt(index, color);
        resourceInstancingRef.current.idToIndex.set(id, index);
        resourceInstancingRef.current.indexToId[index] = id;
        index++;
      });
      instanced.instanceMatrix.needsUpdate = true;
      if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;
      return;
    }

    // Non-instanced diffing: remove missing, add new, update moved
    if (resourceInstancingRef.current.mesh) {
      scene.remove(resourceInstancingRef.current.mesh);
      resourceInstancingRef.current.mesh = null;
      resourceInstancingRef.current.idToIndex.clear();
      resourceInstancingRef.current.indexToId = [];
    }

    // Remove meshes not in resources
    for (const [id, mesh] of resourceMeshesRef.current.entries()) {
      if (!resources.has(id)) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
        resourceMeshesRef.current.delete(id);
      }
    }
    // Add or update meshes
    resources.forEach((resource, id) => {
      let mesh = resourceMeshesRef.current.get(id);
      if (!mesh) {
        const geometry = new THREE.BoxGeometry(0.5, 0.3, 0.5);
        const material = new THREE.MeshLambertMaterial({ color: new THREE.Color().setHSL(0.3, 0.8, 0.3 + resource.quality * 0.4) });
        mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(resource.position.x, 0.15, resource.position.z);
        scene.add(mesh);
        resourceMeshesRef.current.set(id, mesh);
      } else {
        mesh.position.set(resource.position.x, 0.15, resource.position.z);
        mesh.material.color = new THREE.Color().setHSL(0.3, 0.8, 0.3 + resource.quality * 0.4);
      }
    });
  };

  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 1000);
    camera.position.set(30, 25, 30);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(20, 20, 20);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    const groundGeometry = new THREE.PlaneGeometry(50, 50);
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x4a6741 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.name = 'ground';
    scene.add(ground);

    // Create player agent
    const playerAgent = new PlayerAgent('player', { x: 0, y: 1, z: 0 });
    createAgentMesh(playerAgent, scene);
    playerAgentRef.current = playerAgent;

    const initialAgents = [playerAgent];

    // Create AI agents
    for (let i = 0; i < 24; i++) {
      let agent;
      if (i < 9) {
        agent = new CausalAgent(`causal_${i}`, { x: (Math.random() - 0.5) * 30, y: 1, z: (Math.random() - 0.5) * 30 });
      } else {
        agent = new Agent(`rl_${i}`, { x: (Math.random() - 0.5) * 30, y: 1, z: (Math.random() - 0.5) * 30 });
      }
      if (i === 0) agent.status = 'Infected';
      createAgentMesh(agent, scene);
      initialAgents.push(agent);
    }

    agentsRef.current = initialAgents;
    setAgents(initialAgents); // initial UI snapshot

    updateResourceVisualization(scene, environment.resources);

    // Mouse click handler for player movement
    const handleClick = (event) => {
      if (!playerAgentRef.current || gameOver) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const intersects = raycasterRef.current.intersectObjects(scene.children.filter(obj => obj.name === 'ground'));
      if (intersects.length > 0) {
        const point = intersects[0].point;
        playerAgentRef.current.setTargetPosition(point.x, point.z);
        // click ring
        const ringGeometry = new THREE.RingGeometry(0.5, 0.7, 16);
        const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.position.set(point.x, 0.1, point.z);
        ring.rotation.x = -Math.PI / 2;
        scene.add(ring);
        let opacity = 0.5;
        const fadeInterval = setInterval(() => {
          opacity -= 0.05; ring.material.opacity = opacity;
          if (opacity <= 0) { scene.remove(ring); clearInterval(fadeInterval); ring.geometry.dispose(); ring.material.dispose(); }
        }, 50);
      }
    };
    renderer.domElement.addEventListener('click', handleClick);

    // Handle agent double-clicks to show reasoning
    const handleAgentDblClick = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const agentMeshes = agentsRef.current.map(a => a.mesh).filter(m => m);
      const intersects = raycasterRef.current.intersectObjects(agentMeshes);
      if (intersects.length > 0) {
        const clickedMesh = intersects[0].object;
        const clickedAgent = agentsRef.current.find(a => a.mesh === clickedMesh);
        if (clickedAgent instanceof CausalAgent && clickedAgent.lastReasoning) {
          setSelectedAgent({
            id: clickedAgent.id,
            personality: clickedAgent.personality,
            reasoning: clickedAgent.lastReasoning.reasoning,
            confidence: clickedAgent.lastReasoning.confidence,
            age: clickedAgent.age,
            energy: Math.round(clickedAgent.energy),
            status: clickedAgent.status,
            history: clickedAgent.reasoningHistory.slice(-5),
            communications: clickedAgent.socialMemory.receivedMessages.slice(-3),
            knownAgents: clickedAgent.socialMemory.knownAgents.size,
            knownResources: clickedAgent.knownResourceLocations?.length || 0,
            dangerZones: clickedAgent.dangerZones?.length || 0,
            helpRequests: clickedAgent.helpRequests?.length || 0,
            avgTrust: clickedAgent.calculateAverageTrust ? clickedAgent.calculateAverageTrust() : 0.5
          });
        }
      }
    };
    renderer.domElement.addEventListener('dblclick', handleAgentDblClick);

    // Camera controls
    let mouseDown = false; let mouseX = 0; let mouseY = 0;
    const handleMouseDown = (event) => { if (event.button === 2) { mouseDown = true; mouseX = event.clientX; mouseY = event.clientY; } };
    const handleMouseMove = (event) => {
      if (!mouseDown) return;
      const deltaX = event.clientX - mouseX;
      const deltaY = event.clientY - mouseY;
      if (cameraMode === 'overview') {
        const spherical = new THREE.Spherical();
        spherical.setFromVector3(camera.position);
        spherical.theta -= deltaX * 0.01;
        spherical.phi += deltaY * 0.01;
        spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
        camera.position.setFromSpherical(spherical);
        camera.lookAt(0, 0, 0);
      }
      mouseX = event.clientX; mouseY = event.clientY;
    };
    const handleMouseUp = () => { mouseDown = false; };
    const handleWheel = (event) => { const factor = event.deltaY > 0 ? 1.1 : 0.9; camera.position.multiplyScalar(factor); camera.position.y = Math.max(5, camera.position.y); };
    const handleContextMenu = (event) => { event.preventDefault(); };

    renderer.domElement.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    renderer.domElement.addEventListener('wheel', handleWheel);
    renderer.domElement.addEventListener('contextmenu', handleContextMenu);

    const animate = () => {
      requestAnimationFrame(animate);
      const list = agentsRef.current;
      if (list && list.length > 0) {
        for (let i = 0; i < list.length; i++) {
          const agent = list[i];
          if (agent.mesh && agent.position) agent.mesh.position.set(agent.position.x, agent.position.y, agent.position.z);
        }
      }
      if (cameraMode === 'follow' && playerAgentRef.current && !gameOver) {
        const playerPos = playerAgentRef.current.position;
        camera.position.set(playerPos.x + 10, 15, playerPos.z + 10);
        camera.lookAt(playerPos.x, playerPos.y, playerPos.z);
      }
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (mountRef.current) {
        camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('click', handleClick);
      renderer.domElement.removeEventListener('dblclick', handleAgentDblClick);
      renderer.domElement.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      renderer.domElement.removeEventListener('wheel', handleWheel);
      renderer.domElement.removeEventListener('contextmenu', handleContextMenu);
      if (mountRef.current && renderer.domElement) mountRef.current.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [gameOver, cameraMode]);

  const createAgentMesh = (agent, scene) => {
    const geometry = new THREE.SphereGeometry(agent.phenotype.radius, 8, 6);
    let baseColor;
    if (agent.isPlayer) baseColor = agent.status === 'Infected' ? 0xff0000 : agent.status === 'Recovered' ? 0x00ff00 : 0xffffff;
    else if (agent instanceof CausalAgent) baseColor = agent.status === 'Infected' ? 0xff0000 : agent.status === 'Recovered' ? 0x00ff00 : 0xffcc00;
    else baseColor = agent.status === 'Infected' ? 0xff0000 : agent.status === 'Recovered' ? 0x00ff00 : 0x0080ff;
    const material = new THREE.MeshLambertMaterial({ color: baseColor, emissive: agent.isPlayer ? new THREE.Color(0.2, 0.2, 0.2) : new THREE.Color(0, 0, 0) });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(agent.position.x, agent.position.y, agent.position.z);
    mesh.castShadow = true;
    agent.mesh = mesh;
    scene.add(mesh);
    if (agent instanceof CausalAgent) {
      const ringGeometry = new THREE.RingGeometry(1.5, 1.8, 16);
      const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide, transparent: true, opacity: 0 });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.rotation.x = -Math.PI / 2; ring.position.y = -0.3; ring.visible = false; mesh.userData.communicationRing = ring; mesh.add(ring);
      const trustGeometry = new THREE.SphereGeometry(0.08, 4, 4);
      const trustMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.7 });
      const trustIndicator = new THREE.Mesh(trustGeometry, trustMaterial);
      trustIndicator.position.y = 0.5; mesh.userData.trustIndicator = trustIndicator; mesh.add(trustIndicator);
    }
  };

  const simulationStep = useCallback(() => {
    if (!sceneRef.current || !isRunning) return;

    const list = agentsRef.current;
    const toRemoveIdxs = [];
    const toAdd = [];

    // activate all agents
    list.forEach(a => { a.isActive = true; });

    // Update each agent using agentsRef as the source of truth
    for (let i = 0; i < list.length; i++) {
      const agent = list[i];
      const result = agent.update(environment, list, true);
      if (result === 'die') {
        toRemoveIdxs.push(i);
        if (agent.isPlayer) { setGameOver(true); setIsRunning(false); }
      } else if (result === 'reproduce') {
        const survivalThreshold = environment.getDynamicSurvivalThreshold(list.length);
        if (list.length < HARD_MAX_POPULATION && agent.energy > Math.max(15, survivalThreshold * 0.5)) {
          const offspring = agent.reproduce();
          createAgentMesh(offspring, sceneRef.current);
          toAdd.push(offspring);
        }
      }
    }

    // Apply removals
    toRemoveIdxs.sort((a, b) => b - a).forEach(idx => {
      const agent = list[idx];
      if (agent.mesh) sceneRef.current.remove(agent.mesh);
      list.splice(idx, 1);
    });

    // Apply additions
    toAdd.forEach(a => list.push(a));

    // Player stats
    const playerAgent = list.find(a => a.isPlayer);
    if (playerAgent) {
      setPlayerStats({ energy: Math.round(playerAgent.energy), age: playerAgent.age, status: playerAgent.status, position: { x: Math.round(playerAgent.position.x), z: Math.round(playerAgent.position.z) } });
    }

    // Compute dashboard stats directly from agentsRef
    const susceptible = list.filter(a => a.status === 'Susceptible').length;
    const infected = list.filter(a => a.status === 'Infected').length;
    const recovered = list.filter(a => a.status === 'Recovered').length;
    const totalAge = list.reduce((sum, a) => sum + a.age, 0);
    const totalEnergy = list.reduce((sum, a) => sum + a.energy, 0);
    const causalAgents = list.filter(a => a instanceof CausalAgent).length;
    const rlAgents = list.filter(a => !a.isPlayer && !(a instanceof CausalAgent)).length;
    const reasoningEvents = list.filter(a => a instanceof CausalAgent).reduce((sum, a) => sum + a.decisionCount, 0);
    const communicationEvents = list.filter(a => a instanceof CausalAgent).reduce((sum, a) => sum + a.socialMemory.receivedMessages.length, 0);
    const activeMessages = list.filter(a => a instanceof CausalAgent).reduce((sum, a) => {
      if (a.lastCommunication && a.age - (a.lastCommunication.timestamp || 0) < 10) return sum + 1; return sum;
    }, 0);

    setStats({
      susceptible, infected, recovered, total: list.length,
      avgAge: list.length > 0 ? Math.round(totalAge / list.length) : 0,
      avgEnergy: list.length > 0 ? Math.round(totalEnergy / list.length) : 0,
      causalAgents, rlAgents, reasoningEvents, communicationEvents, activeMessages
    });

    // Environment update and resource diffing
    const newEnvironment = environment.update();
    setEnvironment(newEnvironment);
    if (sceneRef.current) updateResourceVisualization(sceneRef.current, newEnvironment.resources);

    // Advance step and track history
    setStep(s => {
      const newStep = s + 1;
      if (newStep % 10 === 0) {
        setPopulationHistory(history => {
          const newHistory = [...history, { step: newStep, total: list.length, infected, susceptible, recovered }];
          return newHistory.slice(-50);
        });
      }
      return newStep;
    });

    // Optional: refresh minimal UI snapshot (shallow) without affecting logic
    setAgents(() => list.slice(0, 1)); // minimal state update to trigger React render cheaply
  }, [environment, isRunning]);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => { simulationStep(); }, 100);
    return () => clearInterval(interval);
  }, [isRunning, simulationStep]);

  const resetSimulation = () => {
    setIsRunning(false);
    setStep(0);
    setPopulationHistory([]);
    setGameOver(false);
    setPlayerStats(null);

    agentsRef.current.forEach(agent => { if (agent.mesh) sceneRef.current.remove(agent.mesh); });
    resourceMeshesRef.current.forEach(mesh => { sceneRef.current.remove(mesh); });
    resourceMeshesRef.current.clear();
    if (resourceInstancingRef.current.mesh) { sceneRef.current.remove(resourceInstancingRef.current.mesh); resourceInstancingRef.current.mesh = null; resourceInstancingRef.current.idToIndex.clear(); resourceInstancingRef.current.indexToId = []; }

    const newEnvironment = new Environment();
    setEnvironment(newEnvironment);

    const playerAgent = new PlayerAgent('player', { x: 0, y: 1, z: 0 });
    createAgentMesh(playerAgent, sceneRef.current);
    playerAgentRef.current = playerAgent;

    const newAgents = [playerAgent];
    for (let i = 0; i < 24; i++) {
      let agent;
      if (i < 9) agent = new CausalAgent(`causal_reset_${i}`, { x: (Math.random() - 0.5) * 30, y: 1, z: (Math.random() - 0.5) * 30 });
      else agent = new Agent(`rl_reset_${i}`, { x: (Math.random() - 0.5) * 30, y: 1, z: (Math.random() - 0.5) * 30 });
      if (i === 0) agent.status = 'Infected';
      createAgentMesh(agent, sceneRef.current);
      newAgents.push(agent);
    }

    agentsRef.current = newAgents;
    setAgents(newAgents.slice(0, 1));
    if (sceneRef.current) updateResourceVisualization(sceneRef.current, newEnvironment.resources);
  };

  const PopulationChart = () => {
    const svgRef = useRef();
    useEffect(() => {
      if (populationHistory.length < 2) return;
      const svg = d3.select(svgRef.current); svg.selectAll('*').remove();
      const margin = { top: 20, right: 30, bottom: 30, left: 40 };
      const width = 300 - margin.left - margin.right; const height = 150 - margin.top - margin.bottom;
      const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
      const xScale = d3.scaleLinear().domain(d3.extent(populationHistory, d => d.step)).range([0, width]);
      const yScale = d3.scaleLinear().domain([0, d3.max(populationHistory, d => d.total)]).range([height, 0]);
      const line = d3.line().x(d => xScale(d.step)).y(d => yScale(d.total)).curve(d3.curveMonotoneX);
      g.append('path').datum(populationHistory).attr('fill', 'none').attr('stroke', '#0080ff').attr('stroke-width', 2).attr('d', line);
      g.append('g').attr('transform', `translate(0,${height})`).call(d3.axisBottom(xScale).tickFormat(d3.format('d')));
      g.append('g').call(d3.axisLeft(yScale));
    }, [populationHistory]);
    return <svg ref={svgRef} width="300" height="150"></svg>;
  };

  return (
    <div className="w-full h-screen bg-gray-900 flex">
      <div className="flex-1 relative">
        <div ref={mountRef} className="w-full h-full" style={{ width: '100%', height: '100%' }} />

        <div className="absolute top-4 left-4 bg-black bg-opacity-80 p-4 rounded-lg text-white max-w-md">
          <h2 className="text-xl font-bold mb-2">🎮 Ecosystem Survival Game</h2>
          <p className="text-sm mb-3 text-gray-300">Click anywhere to move your white agent. Collect green resources to survive!</p>
          {gameOver ? (
            <div className="bg-red-900 p-3 rounded mb-3">
              <h3 className="text-lg font-bold text-red-300">💀 Game Over!</h3>
              <p className="text-sm">You survived {step} steps</p>
            </div>
          ) : (playerStats && (
            <div className="bg-gray-700 p-2 rounded mb-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>❤️ Energy: {playerStats.energy}%</div>
                <div>🎂 Age: {playerStats.age}</div>
                <div>🦠 Status: <span className={playerStats.status === 'Infected' ? 'text-red-400' : playerStats.status === 'Recovered' ? 'text-green-400' : 'text-blue-400'}>{playerStats.status}</span></div>
                <div>📍 Pos: ({playerStats.position.x}, {playerStats.position.z})</div>
              </div>
            </div>
          ))}
          <div className="space-y-2">
            <button
              onClick={() => {
                setIsRunning(!isRunning);
                agentsRef.current.forEach(agent => { agent.isActive = !isRunning; });
              }}
              className={`px-4 py-2 rounded ${isRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
              disabled={gameOver}
            >{isRunning ? '⏸ Pause' : '▶ Start'} Game</button>
            <button onClick={resetSimulation} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded ml-2">🔄 New Game</button>
            <button onClick={() => setCameraMode(cameraMode === 'overview' ? 'follow' : 'overview')} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded ml-2">📷 {cameraMode === 'overview' ? 'Follow' : 'Overview'}</button>
          </div>
          <div className="mt-3 text-xs text-gray-400">
            <p>• <strong>Left Click:</strong> Move player</p>
            <p>• <strong>Double Click Agent:</strong> View AI reasoning & social info</p>
            <p>• <strong>Right Drag:</strong> Rotate camera</p>
            <p>• <strong>Scroll:</strong> Zoom</p>
            <p>• Avoid red infected agents!</p>
            <p>• Collect resources to survive</p>
            <p>• <strong className="text-yellow-300">Gold agents share information!</strong></p>
            <p>• <strong className="text-green-300">Watch for colored rings:</strong></p>
            <p className="ml-2">🟢 Green = Resource tip</p>
            <p className="ml-2">🔴 Red = Danger warning</p>
            <p className="ml-2">🟡 Yellow = Help request</p>
          </div>
        </div>

        {selectedAgent && (
          <div className="absolute top-20 right-4 bg-black bg-opacity-95 p-4 rounded-lg max-w-md border border-yellow-400">
            <h3 className="text-lg font-bold text-yellow-300 mb-2">🧠 Agent {selectedAgent.id} ({selectedAgent.personality})</h3>
            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
              <div>❤️ Energy: {selectedAgent.energy}%</div>
              <div>🎂 Age: {selectedAgent.age}</div>
              <div>🦠 Status: <span className={selectedAgent.status === 'Infected' ? 'text-red-400' : selectedAgent.status === 'Recovered' ? 'text-green-400' : 'text-blue-400'}>{selectedAgent.status}</span></div>
              <div>👥 Known Agents: {selectedAgent.knownAgents || 0}</div>
            </div>
            <div className="mb-3 p-2 bg-gray-800 rounded">
              <h4 className="font-semibold text-sm mb-1 text-cyan-300">📡 Social Intelligence:</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>🍃 Resource Tips: {selectedAgent.knownResources || 0}</div>
                <div>⚠️ Danger Zones: {selectedAgent.dangerZones || 0}</div>
                <div>🆘 Help Requests: {selectedAgent.helpRequests || 0}</div>
                <div>🤝 Avg Trust: {Math.round((selectedAgent.avgTrust || 0.5) * 100)}%</div>
              </div>
            </div>
            <div className="mb-3">
              <h4 className="font-semibold text-sm mb-1">Current Reasoning:</h4>
              <p className="text-sm text-gray-300 italic">"{selectedAgent.reasoning}"</p>
              <div className="text-xs text-gray-400 mt-1">Confidence: {Math.round((selectedAgent.confidence || 0) * 100)}%</div>
            </div>
            {selectedAgent.communications && selectedAgent.communications.length > 0 && (
              <div className="mb-3 border-t border-gray-700 pt-2">
                <h4 className="font-semibold text-sm mb-1 text-green-300">💬 Recent Messages:</h4>
                <div className="text-xs space-y-1">
                  {selectedAgent.communications.map((msg, i) => (
                    <div key={i} className="text-gray-300">
                      <span className={msg.type === 'threat' ? 'text-red-400' : msg.type === 'resource' ? 'text-green-400' : msg.type === 'help' ? 'text-yellow-400' : 'text-blue-400'}>[{msg.type}]</span> {msg.content.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {selectedAgent.history.length > 0 && (
              <div className="text-xs border-t border-gray-700 pt-2">
                <h4 className="font-semibold mb-1">Recent Decisions:</h4>
                {selectedAgent.history.map((h, i) => (
                  <div key={i} className="mb-1 text-gray-400">Step {h.step}: <span className="text-white">{h.action.type}</span>{h.reasoning && <span className="ml-2 text-gray-500">- {h.reasoning.substring(0, 50)}...</span>}</div>
                ))}
              </div>
            )}
            <button onClick={() => setSelectedAgent(null)} className="mt-3 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs w-full">Close</button>
          </div>
        )}
      </div>

      <div className="w-96 bg-gray-800 text-white p-4 overflow-y-auto">
        <h3 className="text-lg font-bold mb-4">🔬 Scientific Dashboard</h3>
        <div className="mb-6 p-3 bg-gray-700 rounded border-l-4 border-yellow-400">
          <h4 className="text-md font-semibold mb-2 text-yellow-300">🧠 Phase 2: Causal AI</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-yellow-400">🟡 Causal Agents:</span><span className="font-mono">{stats.causalAgents}</span></div>
            <div className="flex justify-between"><span className="text-blue-400">🔵 RL Agents:</span><span className="font-mono">{stats.rlAgents}</span></div>
            <div className="flex justify-between"><span>Reasoning Events:</span><span className="font-mono">{stats.reasoningEvents}</span></div>
            <div className="flex justify-between"><span>💬 Communications:</span><span className="font-mono">{stats.communicationEvents}</span></div>
            <div className="flex justify-between"><span>LLM Status:</span><span className={`font-mono ${llmConfig.enabled ? 'text-green-400' : 'text-yellow-400'}`}>{llmConfig.enabled ? '🟢 Active' : '🟡 Simulated'}</span></div>
          </div>
        </div>

        {stats.activeMessages > 0 && (
          <div className="mb-6 p-3 bg-gray-700 rounded border-l-4 border-green-400">
            <h4 className="text-md font-semibold mb-2 text-green-300">💬 Active Communications</h4>
            <div className="text-xs space-y-1">
              {agentsRef.current
                .filter(a => a instanceof CausalAgent && a.lastCommunication)
                .slice(0, 5)
                .map(agent => {
                  const commAge = agent.age - (agent.lastCommunication.timestamp || 0);
                  if (commAge > 10) return null;
                  let icon = '💬';
                  if (agent.lastCommunication.type === MessageTypes.THREAT_WARNING) icon = '⚠️';
                  else if (agent.lastCommunication.type === MessageTypes.RESOURCE_LOCATION) icon = '🍃';
                  else if (agent.lastCommunication.type === MessageTypes.HELP_REQUEST) icon = '🆘';
                  return (
                    <div key={agent.id} className="text-gray-300">
                      <span className="text-yellow-300">{icon} {agent.id.substring(0, 10)}:</span>
                      <span className="ml-1">{agent.lastCommunication.message}</span>
                      <span className="text-gray-500 ml-1">→ {agent.lastCommunication.recipients || 0} agents</span>
                    </div>
                  );
                })
                .filter(Boolean)}
            </div>
            <div className="mt-2 pt-2 border-t border-gray-600 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>Resource Tips Shared: {agentsRef.current.reduce((sum, a) => sum + (a instanceof CausalAgent && a.knownResourceLocations ? a.knownResourceLocations.length : 0), 0)}</div>
                <div>Active Warnings: {agentsRef.current.reduce((sum, a) => sum + (a instanceof CausalAgent && a.dangerZones ? a.dangerZones.length : 0), 0)}</div>
              </div>
            </div>
          </div>
        )}

        {(() => {
          const causalAgent = agentsRef.current.find(a => a instanceof CausalAgent && a.lastReasoning);
          if (causalAgent?.lastReasoning) {
            return (
              <div className="mb-6 p-3 bg-gray-700 rounded">
                <h4 className="text-md font-semibold mb-2 text-purple-300">🤔 Latest Reasoning</h4>
                <div className="text-xs space-y-1">
                  <div className="text-yellow-300">Agent: {causalAgent.id} ({causalAgent.personality})</div>
                  <div className="text-gray-300 italic">"{causalAgent.lastReasoning.reasoning}"</div>
                  <div className="text-green-300">Action: {causalAgent.lastReasoning.action?.type || 'none'}</div>
                  <div className="text-blue-300">Confidence: {Math.round((causalAgent.lastReasoning.confidence || 0) * 100)}%</div>
                </div>
              </div>
            );
          }
          return null;
        })()}

        <div className="mb-6 p-3 bg-gray-700 rounded">
          <h4 className="text-md font-semibold mb-2 text-blue-300">📊 SIR Disease Model</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between"><span className="text-blue-400">🔵 Susceptible:</span><span className="font-mono">{stats.susceptible}</span></div>
            <div className="flex justify-between"><span className="text-red-400">🔴 Infected:</span><span className="font-mono">{stats.infected}</span></div>
            <div className="flex justify-between"><span className="text-green-400">🟢 Recovered:</span><span className="font-mono">{stats.recovered}</span></div>
            <div className="flex justify-between font-bold"><span>👥 Population:</span><span className="font-mono">{stats.total}</span></div>
          </div>
        </div>

        {populationHistory.length > 1 && (
          <div className="mb-6 p-3 bg-gray-700 rounded">
            <h4 className="text-md font-semibold mb-2 text-purple-300">📈 Population Dynamics</h4>
            <PopulationChart />
          </div>
        )}

        <div className="mb-6 p-3 bg-gray-700 rounded">
          <h4 className="text-md font-semibold mb-2 text-yellow-300">🧠 Agent Intelligence</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Avg Age:</span><span className="font-mono">{stats.avgAge} steps</span></div>
            <div className="flex justify-between"><span>Avg Energy:</span><span className="font-mono">{stats.avgEnergy}%</span></div>
            <div className="flex justify-between"><span>Learning:</span><span className="text-green-400">Intent-level MARL</span></div>
          </div>
        </div>

        <div className="mb-6 p-3 bg-gray-700 rounded">
          <h4 className="text-md font-semibold mb-2 text-green-300">🌍 Environment</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Season:</span><span className="capitalize font-mono">{environment.season}</span></div>
            <div className="flex justify-between"><span>Temperature:</span><span className="font-mono">{Math.round(environment.temperature)}°C</span></div>
            <div className="flex justify-between"><span>Resources:</span><span className="font-mono">{environment.resources.size}</span></div>
            <div className="flex justify-between"><span>Weather:</span><span className="capitalize font-mono">{environment.weather}</span></div>
          </div>
        </div>

        <div className="mb-6 p-3 bg-gray-700 rounded">
          <h4 className="text-md font-semibold mb-2 text-cyan-300">⚡ Runtime</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Step:</span><span className="font-mono">{step.toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Status:</span><span className={`font-mono ${isRunning ? 'text-green-400' : 'text-red-400'}`}>{isRunning ? 'EVOLVING' : 'PAUSED'}</span></div>
            <div className="flex justify-between"><span>Carry Cap:</span><span className="font-mono">{environment.carryingCapacity}</span></div>
          </div>
        </div>

        <div className="mb-6 p-3 bg-gray-700 rounded">
          <h4 className="text-md font-semibold mb-2 text-indigo-300">🏗 Architecture Status</h4>
          <div className="text-xs space-y-1">
            <div className="text-green-400">✅ Agent-Based Modeling</div>
            <div className="text-green-400">✅ Genetic Algorithms</div>
            <div className="text-green-400">✅ Intent-level MARL</div>
            <div className="text-green-400">✅ Three.js Physics</div>
            <div className="text-green-400">✅ Environmental Dynamics</div>
            <div className="text-green-400">✅ D3.js Visualization</div>
            <div className="text-green-400">✅ Player-Controlled Agent</div>
            <div className="text-green-400">✅ Chain-of-Thought Reasoning</div>
            <div className="text-green-400">✅ Social Communication System</div>
            <div className="text-green-400">✅ Hybrid Intelligence (RL+Causal)</div>
          </div>
        </div>

        <div className="text-xs text-gray-400">
          <h4 className="font-semibold mb-2">🎮 Controls:</h4>
          <p>• Click to move white player agent</p>
          <p>• Double-click agents to see reasoning</p>
          <p>• Right-drag: Rotate camera</p>
          <p>• Scroll: Zoom in/out</p>
          <p>• Survive and watch AI evolve!</p>
        </div>
      </div>
    </div>
  );
};

export default EcosystemSimulator;