class UIConstrainedAgent {
    constructor() {
        this.ws = null;
        this.connectionFailed = false;
        this.state = { tasks: [], confidence: 0.8 };
        this.connect();
        this.setupEventListeners();
        // Initialize UI immediately
        this.updateUI();
    }

    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        this.ws = new WebSocket(`${protocol}//${window.location.host}`);
        
        this.ws.onopen = () => {
            console.log('Connected to agent');
            this.updateStatus('Connected', 'success');
            this.connectionFailed = false;
        };
        
        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            } catch (error) {
                console.error('Error parsing message:', error);
                this.updateResponse('Message parsing error', 0.1, 'error');
            }
        };
        
        this.ws.onclose = () => {
            console.log('Disconnected from agent');
            this.updateStatus('Disconnected', 'error');
            this.connectionFailed = true;
            // Attempt reconnection
            setTimeout(() => this.connect(), 3000);
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateStatus('Connection Error', 'error');
            this.connectionFailed = true;
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
        // Always handle locally first to maintain our intelligent confidence
        console.log(`Handling ${action} locally first`);
        
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(JSON.stringify({ input, action }));
                console.log('Sent to server for sync only');
            } catch (error) {
                console.error('Error sending message:', error);
            }
        } else {
            console.log('WebSocket not connected - local only');
        }
    }

    // Local fallback when WebSocket is not available
    handleLocalAction(input, action) {
        switch (action) {
            case 'create_task':
                this.createTaskLocal(input);
                break;
            case 'get_suggestion':
                this.getSuggestionLocal();
                break;
            case 'mark_complete':
                this.markCompleteLocal(input);
                break;
            case 'delete_task':
                this.deleteTaskLocal(input);
                break;
            case 'break_down':
                this.breakDownTaskLocal(input);
                break;
            case 'edit_task':
                this.editTaskLocal(input);
                break;
            default:
                this.updateResponse('Offline mode - limited features', 0.3, 'error');
        }
    }

    createTaskLocal(taskText) {
        if (!taskText || taskText.length < 3) {
            this.updateResponse('Task too short', 0.2, 'error');
            return;
        }
        
        const task = {
            id: Date.now(),
            text: taskText.substring(0, 100),
            subtasks: [],
            completed: false,
            created: new Date()
        };
        
        // Calculate confidence based on task analysis
        const confidence = this.analyzeTaskConfidence(taskText);
        const analysis = this.getTaskAnalysis(taskText);
        
        this.state.tasks.push(task);
        this.state.currentTask = task;
        this.state.confidence = confidence;
        
        this.updateResponse(`Task created. ${analysis.reason}`, confidence, 'task_created');
        this.updateUI();
    }

    getSuggestionLocal() {
        const suggestions = [
            { text: 'Review and prioritize pending tasks', confidence: 0.4 },
            { text: 'Schedule focused work blocks', confidence: 0.3 },
            { text: 'Update project documentation', confidence: 0.5 },
            { text: 'Plan next week activities', confidence: 0.3 },
            { text: 'Organize workspace and files', confidence: 0.6 },
            { text: 'Follow up on pending communications', confidence: 0.4 }
        ];
        
        const suggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
        
        const task = {
            id: Date.now(),
            text: suggestion.text,
            subtasks: [],
            completed: false,
            created: new Date(),
            suggested: true
        };
        
        this.state.tasks.push(task);
        this.state.confidence = suggestion.confidence;
        
        this.updateResponse(`Added suggestion. Low confidence - needs planning`, suggestion.confidence, 'task_created');
        this.updateUI();
    }

    markCompleteLocal(taskId) {
        const task = this.state.tasks.find(t => t.id == taskId);
        if (!task) {
            this.updateResponse('Task not found', 0.1, 'error');
            return;
        }
        
        task.completed = true;
        
        // Complete all subtasks if they exist
        if (task.subtasks && task.subtasks.length > 0) {
            task.subtasks.forEach(subtask => subtask.completed = true);
        }
        
        // Remove suggested status when completed
        if (task.suggested) {
            task.suggested = false;
        }
        
        this.state.confidence = 0.9; // High confidence after completion
        
        this.updateResponse(`"${task.text.substring(0, 40)}..." completed!`, 0.9, 'task_completed');
        this.updateUI();
    }

    deleteTaskLocal(taskId) {
        const taskIndex = this.state.tasks.findIndex(t => t.id == taskId);
        if (taskIndex === -1) {
            this.updateResponse('Task not found', 0.1, 'error');
            return;
        }
        
        const task = this.state.tasks[taskIndex];
        this.state.tasks.splice(taskIndex, 1);
        
        if (this.state.currentTask && this.state.currentTask.id == taskId) {
            this.state.currentTask = null;
        }
        
        this.state.confidence = 0.7;
        
        this.updateResponse(`Deleted: "${task.text.substring(0, 50)}..."`, 0.7, 'task_deleted');
        this.updateUI();
    }

    breakDownTaskLocal(taskId) {
        console.log('Breaking down task locally:', taskId);
        const task = this.state.tasks.find(t => t.id == taskId);
        if (!task) {
            this.updateResponse('Task not found', 0.1, 'error');
            return;
        }

        const subtasks = this.generateSubtasksLocal(task.text);
        task.subtasks = subtasks;
        
        // Calculate new confidence after breakdown
        const breakdownConfidence = this.calculateBreakdownConfidence(task.text, subtasks.length);
        
        // Remove suggested status when broken down
        if (task.suggested) {
            task.suggested = false;
            this.state.confidence = Math.min(0.8, breakdownConfidence + 0.2); // Boost for planning
        } else {
            this.state.confidence = breakdownConfidence;
        }
        
        this.state.currentTask = task;
        
        const confidenceReason = this.getBreakdownReason(task.text, subtasks.length, this.state.confidence);
        this.updateResponse(`${subtasks.length} steps planned. ${confidenceReason}`, this.state.confidence, 'subtasks_generated');
        this.updateUI();
    }

    generateSubtasksLocal(taskText) {
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

    editTaskLocal(data) {
        const { taskId, newText } = JSON.parse(data);
        const task = this.state.tasks.find(t => t.id == taskId);
        
        if (!task) {
            this.updateResponse('Task not found', 0.1, 'error');
            return;
        }
        
        if (!newText || newText.length < 3) {
            this.updateResponse('Task text too short', 0.2, 'error');
            return;
        }
        
        task.text = newText.substring(0, 100);
        this.state.confidence = 0.8;
        
        this.updateResponse(`Updated: "${task.text}"`, 0.8, 'task_updated');
        this.updateUI();
    }

    // Enhanced confidence analysis with edge case detection
    analyzeTaskConfidence(taskText) {
        const text = taskText.toLowerCase().trim();
        let confidence = 0.2; // Start very low
        let flags = [];
        
        // Edge case detection first
        if (this.detectMalformedInput(text)) {
            flags.push('malformed');
            return { confidence: 0.1, flags, reason: 'Invalid input format detected' };
        }
        
        if (this.detectContradictoryInput(text)) {
            flags.push('contradictory');
            return { confidence: 0.15, flags, reason: 'Contradictory requirements detected' };
        }
        
        if (this.detectUnsafeInput(text)) {
            flags.push('unsafe');
            return { confidence: 0.1, flags, reason: 'Unsafe or unethical request detected' };
        }
        
        if (this.detectOverbroadInput(text)) {
            flags.push('overbroad');
            return { confidence: 0.2, flags, reason: 'Task scope too broad for autonomous execution' };
        }
        
        // Vagueness detection
        if (this.detectVagueInput(text)) {
            flags.push('vague');
            confidence = Math.max(0.1, confidence - 0.3);
        }
        
        // Length and detail analysis
        const wordCount = text.split(/\s+/).length;
        if (wordCount >= 8) confidence += 0.2;
        else if (wordCount >= 5) confidence += 0.1;
        else if (wordCount >= 3) confidence += 0.05;
        
        // Specificity indicators
        const hasSpecificTerms = /\b(design|build|create|develop|implement|analyze|research|write|plan|organize)\b/.test(text);
        if (hasSpecificTerms) confidence += 0.15;
        
        // Technical/domain knowledge
        const hasTechnicalTerms = /\b(api|database|system|framework|algorithm|model|architecture|deployment|testing)\b/.test(text);
        if (hasTechnicalTerms) confidence += 0.2;
        
        // Context and requirements
        const hasContext = /\b(for|using|with|in|on|project|application|website|mobile|web)\b/.test(text);
        if (hasContext) confidence += 0.1;
        
        // Clear objectives
        const hasObjectives = /\b(to|will|should|must|need|goal|objective|target|result)\b/.test(text);
        if (hasObjectives) confidence += 0.1;
        
        // Complexity indicators (reduce confidence)
        const complexityTerms = /\b(complex|advanced|sophisticated|enterprise|scalable|distributed|machine learning|ai)\b/.test(text);
        if (complexityTerms) {
            confidence -= 0.15;
            flags.push('complex');
        }
        
        // Cap between 0.1 and 0.85
        confidence = Math.max(0.1, Math.min(0.85, confidence));
        
        return { confidence, flags, reason: this.getConfidenceReason(confidence, flags) };
    }
    
    // Edge case detection methods
    detectMalformedInput(text) {
        // Detect garbage input, excessive punctuation, or non-text
        const excessivePunctuation = /[!?]{3,}|[.]{4,}|[#@$%^&*]{2,}/.test(text);
        const onlySymbols = /^[^a-zA-Z0-9\s]+$/.test(text);
        const tooShort = text.length < 2;
        
        return excessivePunctuation || onlySymbols || tooShort;
    }
    
    detectContradictoryInput(text) {
        // Detect contradictory requirements
        const contradictions = [
            /technical.*but.*no.*technical/,
            /presentation.*but.*no.*present/,
            /build.*but.*don't.*create/,
            /detailed.*but.*simple/,
            /complex.*but.*basic/
        ];
        
        return contradictions.some(pattern => pattern.test(text));
    }
    
    detectUnsafeInput(text) {
        // Detect unsafe, unethical, or inappropriate requests
        const unsafePatterns = [
            /autonomous.*hiring.*without.*human/,
            /replace.*human.*decision/,
            /ignore.*rules|bypass.*constraint/,
            /full.*autonomy.*without.*oversight/,
            /make.*decisions.*without.*approval/
        ];
        
        return unsafePatterns.some(pattern => pattern.test(text));
    }
    
    detectOverbroadInput(text) {
        // Detect impossibly broad or unrealistic scope
        const overbroadPatterns = [
            /solve.*all.*problems/,
            /everything.*automatically/,
            /complete.*solution.*for.*everything/,
            /build.*system.*that.*does.*everything/,
            /automate.*entire.*business/
        ];
        
        return overbroadPatterns.some(pattern => pattern.test(text));
    }
    
    detectVagueInput(text) {
        // Detect vague or ambiguous language
        const vagueTerms = /\b(something|stuff|things|maybe|probably|somehow|whatever|handle|deal with|work on)\b/;
        const tooGeneric = /\b(do|make|create|build)\s+\w{1,4}\b/; // "do it", "make thing"
        
        return vagueTerms.test(text) || tooGeneric.test(text);
    }
    
    getConfidenceReason(confidence, flags) {
        if (flags.includes('malformed')) return 'Invalid input format';
        if (flags.includes('contradictory')) return 'Contradictory requirements';
        if (flags.includes('unsafe')) return 'Unsafe request - human oversight required';
        if (flags.includes('overbroad')) return 'Scope too broad - needs constraints';
        if (flags.includes('vague')) return 'Vague task - needs clarification';
        if (flags.includes('complex')) return 'Complex task - proceed cautiously';
        
        if (confidence >= 0.7) return 'Clear, specific task';
        if (confidence >= 0.5) return 'Good detail, some clarity';
        if (confidence >= 0.3) return 'Basic info, needs more detail';
        return 'Low confidence - needs refinement';
    }
    
    calculateBreakdownConfidence(taskText, subtaskCount) {
        const analysis = this.analyzeTaskConfidence(taskText);
        let breakdownConfidence = analysis.confidence;
        
        // More subtasks = more complexity revealed = lower confidence initially
        if (subtaskCount >= 6) breakdownConfidence -= 0.2;
        else if (subtaskCount >= 4) breakdownConfidence -= 0.1;
        else if (subtaskCount <= 2) breakdownConfidence -= 0.15; // Too simple might be incomplete
        
        // But planning itself increases confidence slightly
        breakdownConfidence += 0.1;
        
        return Math.max(0.15, Math.min(0.8, breakdownConfidence));
    }
    
    getBreakdownReason(taskText, subtaskCount, confidence) {
        if (confidence >= 0.6) {
            return 'Well-structured plan';
        } else if (confidence >= 0.4) {
            return 'Plan needs refinement';
        } else {
            return 'Complex task, uncertain steps';
        }
    }

    handleMessage(message) {
        console.log('Received server message:', message);
        // Completely ignore server responses for UI updates
        // Only use server for data sync in background
        console.log('Server message ignored - using local UI only');
    }

    // Constraint: Maximum 120 characters per response
    updateResponse(text, confidence, action, reason = '') {
        const constrainedText = text.substring(0, 120);
        const responseElement = document.getElementById('responseText');
        const actionsElement = document.getElementById('responseActions');
        
        responseElement.textContent = constrainedText;
        
        // Track last action for debugging
        this.lastAction = `${action} (${Math.round(confidence * 100)}%)`;
        
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
            fill.style.boxShadow = '0 0 10px rgba(231, 76, 60, 0.5)';
        } else if (confidence < 0.7) {
            fill.style.background = '#f39c12';
            fill.style.boxShadow = '0 0 10px rgba(243, 156, 18, 0.5)';
        } else {
            fill.style.background = '#27ae60';
            fill.style.boxShadow = '0 0 10px rgba(39, 174, 96, 0.5)';
        }
        
        // Add confidence change animation
        fill.style.transition = 'all 0.5s ease';
        
        // Log confidence for debugging
        console.log(`Confidence updated to: ${percentage}%`);
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
                    ${!task.completed ? `<button class="btn-small" onclick="event.stopPropagation(); console.log('Breakdown clicked for task ${task.id}'); agent.breakDownTask(${task.id})">Break Down</button>` : ''}
                    ${!task.completed ? `<button class="btn-small" onclick="event.stopPropagation(); console.log('Complete clicked for task ${task.id}'); agent.markComplete(${task.id})">Complete</button>` : ''}
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
            'Agent Confidence': Math.round(this.state.confidence * 100) + '%',
            'Last Action': this.lastAction || 'None'
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

    createTask() {
        const input = document.getElementById('taskInput');
        const taskText = input.value.trim();
        
        if (!taskText) {
            this.updateResponse('Please enter a task', 0.2, 'error');
            return;
        }
        
        if (taskText.length < 3) {
            this.updateResponse('Task too short - needs more detail', 0.2, 'error');
            return;
        }
        
        // Enhanced analysis with edge case detection
        const analysis = this.analyzeTaskConfidence(taskText);
        
        // Handle edge cases with specific responses
        if (analysis.flags.includes('malformed')) {
            this.updateResponse('Invalid input format detected', 0.1, 'error');
            return;
        }
        
        if (analysis.flags.includes('contradictory')) {
            this.updateResponse('Contradictory requirements - please clarify', 0.15, 'error');
            return;
        }
        
        if (analysis.flags.includes('unsafe')) {
            this.updateResponse('Request requires human oversight - cannot proceed autonomously', 0.1, 'error');
            return;
        }
        
        if (analysis.flags.includes('overbroad')) {
            this.updateResponse('Scope too broad - please add constraints', 0.2, 'error');
            return;
        }
        
        // Create task with enhanced analysis
        const task = {
            id: Date.now(),
            text: taskText.substring(0, 100),
            subtasks: [],
            completed: false,
            created: new Date(),
            flags: analysis.flags
        };
        
        this.state.tasks.push(task);
        this.state.currentTask = task;
        this.state.confidence = analysis.confidence;
        
        // Update UI immediately
        this.updateUI();
        this.updateResponse(`Task created. ${analysis.reason}`, analysis.confidence, 'task_created');
        
        // Clear input
        input.value = '';
        
        // Send to server for sync
        this.sendMessage(taskText, 'create_task');
    }

    selectTask(taskId) {
        this.sendMessage(taskId, 'select_task');
    }

    breakDownTask(taskId) {
        console.log('Breaking down task:', taskId);
        
        // Handle completely locally - no server interference
        this.breakDownTaskLocal(taskId);
        
        // Don't send to server to avoid response override
        console.log('Breakdown handled locally only');
    }

    breakDownCurrentTask() {
        if (this.state.currentTask) {
            this.breakDownTask(this.state.currentTask.id);
        }
    }

    markComplete(taskId) {
        // Handle completely locally - no server interference
        this.markCompleteLocal(taskId);
        
        // Don't send to server to avoid response override
        console.log('Completion handled locally only');
    }

    markCurrentTaskComplete() {
        if (this.state.currentTask) {
            this.markComplete(this.state.currentTask.id);
        }
    }

    deleteTask(taskId) {
        if (confirm('Delete this task?')) {
            // Delete immediately on client
            const taskIndex = this.state.tasks.findIndex(t => t.id == taskId);
            if (taskIndex !== -1) {
                this.state.tasks.splice(taskIndex, 1);
                if (this.state.currentTask && this.state.currentTask.id == taskId) {
                    this.state.currentTask = null;
                }
                this.updateUI();
                this.updateResponse('Task deleted', 0.7, 'task_deleted');
            }
            
            // Send to server
            this.sendMessage(taskId, 'delete_task');
        }
    }

    editTask(taskId) {
        const task = this.state.tasks.find(t => t.id === taskId);
        if (!task) return;
        
        const newText = prompt('Edit task:', task.text);
        if (newText && newText.trim() && newText.trim() !== task.text) {
            const data = JSON.stringify({ taskId, newText: newText.trim() });
            
            // Handle locally first
            this.editTaskLocal(data);
            
            // Send to server for sync
            this.sendMessage(data, 'edit_task');
        }
    }

    getSuggestion() {
        // Handle completely locally - no server interference
        this.getSuggestionLocal();
        
        // Don't send to server to avoid response override
        console.log('Suggestion handled locally only');
    }

    retryAction() {
        // Clear any error state and reset to ready
        this.state.confidence = 0.8;
        this.updateResponse('Ready to help you plan tasks', 0.8, 'info');
        
        // Clear task input if there's an error there
        const input = document.getElementById('taskInput');
        if (input.value.trim().length < 3) {
            input.value = '';
        }
        
        this.updateUI();
    }

    applySuggestion() {
        this.updateResponse('Suggestion noted', 0.8, 'info');
    }

    clearTasks() {
        if (confirm('Clear all tasks? This cannot be undone.')) {
            // Clear immediately on client
            this.state.tasks = [];
            this.state.currentTask = null;
            this.state.confidence = 0.8;
            this.updateUI();
            this.updateResponse('All tasks cleared', 0.9, 'info');
            
            // Send to server
            this.sendMessage('', 'clear_all');
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