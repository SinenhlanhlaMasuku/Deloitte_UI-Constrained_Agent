class UIConstrainedAgent {
    constructor() {
        this.ws = null;
        this.state = { tasks: [], confidence: 0.8 };
        this.connect();
        this.setupEventListeners();
    }

    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        this.ws = new WebSocket(`${protocol}//${window.location.host}`);
        
        this.ws.onopen = () => {
            console.log('Connected to agent');
            this.updateStatus('Connected', 'success');
        };
        
        this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
        };
        
        this.ws.onclose = () => {
            console.log('Disconnected from agent');
            this.updateStatus('Disconnected', 'error');
            // Attempt reconnection
            setTimeout(() => this.connect(), 3000);
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateStatus('Connection Error', 'error');
        };
    }

    setupEventListeners() {
        document.getElementById('taskInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.createTask();
            }
        });
    }

    sendMessage(input, action) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ input, action }));
        } else {
            this.updateResponse('Connection lost', 0.1, 'error');
        }
    }

    handleMessage(message) {
        switch (message.type) {
            case 'response':
                this.updateResponse(
                    message.data.text, 
                    message.data.confidence, 
                    message.data.action,
                    message.data.reason
                );
                break;
            case 'state':
                this.state = message.data;
                break;
            case 'error':
                this.updateResponse(
                    message.data.text, 
                    message.data.confidence, 
                    'error',
                    message.data.reason
                );
                break;
        }
        // Always update state and UI after any message
        if (message.state) {
            this.state = message.state;
        }
        this.updateUI();
    }

    // Constraint: Maximum 120 characters per response
    updateResponse(text, confidence, action, reason = '') {
        const constrainedText = text.substring(0, 120);
        const responseElement = document.getElementById('responseText');
        const actionsElement = document.getElementById('responseActions');
        
        responseElement.textContent = constrainedText;
        
        // Show character count to demonstrate constraint
        const charCount = document.getElementById('charCount') || this.createCharCounter();
        charCount.textContent = `${constrainedText.length}/120 chars`;
        charCount.style.color = constrainedText.length >= 120 ? '#e74c3c' : '#666';
        
        // Show reasoning if confidence changed significantly
        if (reason && (confidence < 0.6 || confidence > 0.9)) {
            const reasonElement = document.getElementById('confidenceReason') || this.createReasonElement();
            reasonElement.textContent = reason.substring(0, 80); // Keep reason short
            reasonElement.style.display = 'block';
        }
        
        // Update confidence meter
        this.updateConfidence(confidence);
        
        // Generate constrained action buttons based on response
        this.generateActionButtons(action, actionsElement);
        
        // Update status indicator
        this.updateStatus(action, this.getStatusType(confidence));
    }

    // Constraint: Responses only via predefined UI components
    generateActionButtons(action, container) {
        container.innerHTML = '';
        
        const buttons = this.getActionButtons(action);
        buttons.forEach(button => {
            const btn = document.createElement('button');
            btn.textContent = button.text;
            btn.className = button.class;
            btn.onclick = button.action;
            container.appendChild(btn);
        });
    }

    getActionButtons(action) {
        const buttons = [];
        
        switch (action) {
            case 'task_created':
                buttons.push({
                    text: 'Break Down',
                    class: 'btn-small',
                    action: () => this.breakDownCurrentTask()
                });
                break;
            case 'task_selected':
                buttons.push({
                    text: 'Break Down',
                    class: 'btn-small',
                    action: () => this.breakDownCurrentTask()
                });
                buttons.push({
                    text: 'Complete',
                    class: 'btn-small',
                    action: () => this.markCurrentTaskComplete()
                });
                break;
            case 'subtasks_generated':
                buttons.push({
                    text: 'Mark Complete',
                    class: 'btn-small',
                    action: () => this.markCurrentTaskComplete()
                });
                break;
            case 'error':
                buttons.push({
                    text: 'Retry',
                    class: 'btn-small',
                    action: () => this.retryAction()
                });
                break;
            case 'suggestion':
                // Remove the Apply button - suggestions are now auto-added as tasks
                break;
        }
        
        return buttons;
    }

    updateConfidence(confidence) {
        const fill = document.getElementById('confidenceFill');
        const text = document.getElementById('confidenceText');
        
        const percentage = Math.round(confidence * 100);
        fill.style.width = `${percentage}%`;
        text.textContent = `${percentage}%`;
        
        // Update color based on confidence level
        if (confidence < 0.3) {
            fill.style.background = '#e74c3c';
        } else if (confidence < 0.7) {
            fill.style.background = '#f39c12';
        } else {
            fill.style.background = '#27ae60';
        }
    }

    createReasonElement() {
        const reasonElement = document.createElement('div');
        reasonElement.id = 'confidenceReason';
        reasonElement.className = 'confidence-reason';
        reasonElement.style.cssText = 'font-size: 12px; color: #666; margin-top: 5px; display: none;';
        document.getElementById('agentResponse').appendChild(reasonElement);
        return reasonElement;
    }

    createCharCounter() {
        const charCounter = document.createElement('div');
        charCounter.id = 'charCount';
        charCounter.style.cssText = 'font-size: 11px; color: #666; text-align: right; margin-top: 5px;';
        document.getElementById('agentResponse').appendChild(charCounter);
        return charCounter;
    }

    updateUI() {
        this.renderTasks();
        this.updateStateDisplay();
    }

    renderTasks() {
        const container = document.getElementById('tasks');
        container.innerHTML = '';
        
        if (this.state.tasks.length === 0) {
            container.innerHTML = '<p style="color: #666; font-style: italic;">No tasks yet. Create one above!</p>';
            return;
        }
        
        this.state.tasks.forEach(task => {
            const taskElement = this.createTaskElement(task);
            container.appendChild(taskElement);
        });
    }

    createTaskElement(task) {
        const div = document.createElement('div');
        div.className = `task-item ${task.completed ? 'completed' : ''} ${task.suggested ? 'suggested' : ''}`;
        
        div.innerHTML = `
            <div class="task-header">
                <span class="task-text clickable" onclick="agent.editTask(${task.id})">${task.text}</span>
                <div class="task-actions">
                    ${!task.completed ? `<button class="btn-small" onclick="event.stopPropagation(); agent.breakDownTask(${task.id})">Break Down</button>` : ''}
                    ${!task.completed ? `<button class="btn-small" onclick="event.stopPropagation(); agent.markComplete(${task.id})">Complete</button>` : ''}
                    <button class="btn-delete" onclick="event.stopPropagation(); agent.deleteTask(${task.id})" title="Delete task">🗑️</button>
                </div>
            </div>
            ${task.subtasks && task.subtasks.length > 0 ? this.renderSubtasks(task.subtasks) : ''}
        `;
        
        return div;
    }

    renderSubtasks(subtasks) {
        const subtaskHtml = subtasks.map(subtask => 
            `<div class="subtask ${subtask.completed ? 'completed' : ''}">
                <span class="status-indicator ${subtask.completed ? 'status-success' : 'status-warning'}"></span>
                ${subtask.text}
            </div>`
        ).join('');
        
        return `<div class="subtasks">${subtaskHtml}</div>`;
    }

    updateStateDisplay() {
        const display = document.getElementById('stateDisplay');
        const stateInfo = {
            'Total Tasks': this.state.tasks.length,
            'Completed': this.state.tasks.filter(t => t.completed).length,
            'Current Task': this.state.currentTask ? this.state.currentTask.text.substring(0, 30) + '...' : 'None',
            'Agent Confidence': Math.round(this.state.confidence * 100) + '%'
        };
        
        display.innerHTML = Object.entries(stateInfo)
            .map(([key, value]) => `${key}: ${value}`)
            .join('<br>');
    }

    updateStatus(message, type) {
        // Could add a status bar here if needed
        console.log(`Status: ${message} (${type})`);
    }

    getStatusType(confidence) {
        if (confidence < 0.3) return 'error';
        if (confidence < 0.7) return 'warning';
        return 'success';
    }

    // User actions
    createTask() {
        const input = document.getElementById('taskInput');
        const taskText = input.value.trim();
        
        if (!taskText) {
            this.updateResponse('Please enter a task', 0.2, 'error');
            return;
        }
        
        this.sendMessage(taskText, 'create_task');
        input.value = '';
    }

    selectTask(taskId) {
        this.sendMessage(taskId, 'select_task');
    }

    breakDownTask(taskId) {
        this.sendMessage(taskId, 'break_down');
    }

    breakDownCurrentTask() {
        if (this.state.currentTask) {
            this.breakDownTask(this.state.currentTask.id);
        }
    }

    markComplete(taskId) {
        this.sendMessage(taskId, 'mark_complete');
    }

    markCurrentTaskComplete() {
        if (this.state.currentTask) {
            this.markComplete(this.state.currentTask.id);
        }
    }

    deleteTask(taskId) {
        if (confirm('Delete this task?')) {
            this.sendMessage(taskId, 'delete_task');
        }
    }

    editTask(taskId) {
        const task = this.state.tasks.find(t => t.id === taskId);
        if (!task) return;
        
        const newText = prompt('Edit task:', task.text);
        if (newText && newText.trim() && newText.trim() !== task.text) {
            const data = JSON.stringify({ taskId, newText: newText.trim() });
            this.sendMessage(data, 'edit_task');
        }
    }

    getSuggestion() {
        this.sendMessage('', 'get_suggestion');
    }

    retryAction() {
        this.sendMessage('', 'retry');
    }

    applySuggestion() {
        this.updateResponse('Suggestion noted', 0.8, 'info');
    }

    clearTasks() {
        if (confirm('Clear all tasks? This cannot be undone.')) {
            this.state.tasks = [];
            this.state.currentTask = null;
            this.updateUI();
            this.updateResponse('All tasks cleared', 0.9, 'info');
        }
    }
}

// Global functions for HTML onclick handlers
let agent;

function createTask() {
    agent.createTask();
}

function getSuggestion() {
    agent.getSuggestion();
}

function retryAction() {
    agent.retryAction();
}

function clearTasks() {
    agent.clearTasks();
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    agent = new UIConstrainedAgent();
});