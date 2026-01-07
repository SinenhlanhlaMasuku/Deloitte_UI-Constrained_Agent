const express = require('express');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const PORT = 3000;

// Serve static files
app.use(express.static('public'));
app.use(express.json());

// Agent state and logic
class TaskAgent {
  constructor() {
    this.tasks = [];
    this.currentTask = null;
    this.confidence = 0.8;
  }

  processInput(input, action) {
    const responses = {
      'create_task': this.createTask(input),
      'break_down': this.breakDownTask(input),
      'mark_complete': this.markComplete(input),
      'select_task': this.selectTask(input),
      'get_suggestion': this.getSuggestion(),
      'retry': this.retry()
    };
    
    return responses[action] || { text: 'Unknown action', confidence: 0.3 };
  }

  createTask(taskText) {
    if (!taskText || taskText.length < 3) {
      return { text: 'Task too short', confidence: 0.2, action: 'error', reason: 'Insufficient task description' };
    }
    
    const task = {
      id: Date.now(),
      text: taskText.substring(0, 100),
      subtasks: [],
      completed: false,
      created: new Date()
    };
    
    this.tasks.push(task);
    this.currentTask = task;
    
    // Calculate confidence based on task information content
    this.confidence = this.calculateTaskConfidence(taskText);
    
    return { 
      text: `Task "${task.text}" created`, 
      confidence: this.confidence,
      action: 'task_created',
      taskId: task.id,
      reason: this.getConfidenceReason(taskText, this.confidence)
    };
  }

  breakDownTask(taskId) {
    const task = this.tasks.find(t => t.id == taskId);
    if (!task) {
      return { text: 'Task not found', confidence: 0.1, action: 'error', reason: 'Invalid task ID' };
    }

    // Breaking down reveals unknowns - confidence drops initially
    const suggestions = this.generateSubtasks(task.text);
    task.subtasks = suggestions; // Overwrites existing subtasks for re-analysis
    this.confidence = 0.5; // Intentionally lower - decomposition reveals complexity
    
    const actionText = task.subtasks.length > 0 ? 'Re-analyzed' : 'Broke into';
    
    return {
      text: `${actionText} ${suggestions.length} steps. Needs validation.`,
      confidence: this.confidence,
      action: 'subtasks_generated',
      subtasks: suggestions,
      reason: 'Task decomposed - awaiting validation'
    };
  }

  generateSubtasks(taskText) {
    const keywords = taskText.toLowerCase();
    const subtasks = [];
    
    if (keywords.includes('project') || keywords.includes('build')) {
      subtasks.push('Plan requirements', 'Design solution', 'Implement', 'Test & deploy');
    } else if (keywords.includes('research') || keywords.includes('study')) {
      subtasks.push('Define scope', 'Gather sources', 'Analyze data', 'Write summary');
    } else if (keywords.includes('meeting') || keywords.includes('presentation')) {
      subtasks.push('Set agenda', 'Prepare materials', 'Schedule time', 'Follow up');
    } else {
      subtasks.push('Start task', 'Make progress', 'Review work', 'Complete');
    }
    
    return subtasks.map((text, i) => ({ id: i + 1, text, completed: false }));
  }

  selectTask(taskId) {
    const task = this.tasks.find(t => t.id == taskId);
    if (!task) {
      return { text: 'Task not found', confidence: 0.1, action: 'error', reason: 'Invalid task ID' };
    }
    
    this.currentTask = task;
    this.confidence = 0.7; // Medium confidence - task selected for review
    
    return {
      text: `Selected: "${task.text.substring(0, 60)}..."`,
      confidence: this.confidence,
      action: 'task_selected',
      taskId: task.id,
      reason: 'Task selected for review'
    };
  }

  markComplete(taskId) {
    const task = this.tasks.find(t => t.id == taskId);
    if (!task) {
      return { text: 'Task not found', confidence: 0.1, action: 'error', reason: 'Invalid task ID' };
    }
    
    task.completed = true;
    this.confidence = 0.95; // High confidence - clear completion state
    
    return {
      text: 'Task completed!',
      confidence: this.confidence,
      action: 'task_completed',
      reason: 'Task marked as complete'
    };
  }

  getSuggestion() {
    const incompleteTasks = this.tasks.filter(t => !t.completed);
    if (incompleteTasks.length === 0) {
      return { text: 'No pending tasks', confidence: 0.6, action: 'info' };
    }
    
    const suggestions = [
      'Focus on high priority tasks first to maximize productivity and ensure critical deliverables are completed on time',
      'Break down complex tasks into smaller, manageable subtasks to reduce cognitive load and improve completion rates',
      'Set specific time limits for each task to maintain focus and prevent scope creep during execution',
      'Review progress regularly and adjust priorities based on changing requirements and stakeholder feedback'
    ];
    
    const suggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
    this.confidence = 0.7;
    
    return {
      text: suggestion, // This will be >120 chars to test truncation
      confidence: this.confidence,
      action: 'suggestion'
    };
  }

  retry() {
    this.confidence = Math.min(0.9, this.confidence + 0.1);
    return {
      text: 'Ready to try again',
      confidence: this.confidence,
      action: 'retry'
    };
  }

  calculateTaskConfidence(taskText) {
    const text = taskText.toLowerCase();
    let confidence = 0.3; // Start low
    
    // Information richness indicators
    const hasSpecifics = /\b(python|llm|system|design|engineer|requires|skills|experience)\b/.test(text);
    const hasContext = /\b(job|role|position|work|project|build|develop)\b/.test(text);
    const hasRequirements = /\b(requires|needs|must|should|experience|knowledge)\b/.test(text);
    const hasDetails = text.split(' ').length > 5;
    const hasTechnicalTerms = /\b(api|database|framework|architecture|deployment)\b/.test(text);
    
    // Confidence scoring
    if (hasSpecifics) confidence += 0.25;
    if (hasContext) confidence += 0.2;
    if (hasRequirements) confidence += 0.2;
    if (hasDetails) confidence += 0.15;
    if (hasTechnicalTerms) confidence += 0.1;
    
    // Cap at 0.9 - never 100% confident initially
    return Math.min(0.9, confidence);
  }

  getConfidenceReason(taskText, confidence) {
    if (confidence > 0.8) return 'Rich task details - high confidence';
    if (confidence > 0.6) return 'Good task context - medium confidence';
    if (confidence > 0.4) return 'Basic task info - low confidence';
    return 'Insufficient task details - very low confidence';
  }

  getState() {
    return {
      tasks: this.tasks,
      currentTask: this.currentTask,
      confidence: this.confidence
    };
  }
}

const agent = new TaskAgent();

// WebSocket server
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('Client connected');
  
  // Send initial state
  ws.send(JSON.stringify({ type: 'state', data: agent.getState() }));
  
  ws.on('message', (message) => {
    try {
      const { input, action } = JSON.parse(message);
      const response = agent.processInput(input, action);
      
      ws.send(JSON.stringify({ 
        type: 'response', 
        data: response,
        state: agent.getState()
      }));
    } catch (error) {
      ws.send(JSON.stringify({ 
        type: 'error', 
        data: { text: 'Invalid input', confidence: 0.1 }
      }));
    }
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});