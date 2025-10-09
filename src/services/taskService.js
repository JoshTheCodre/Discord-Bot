const cron = require('node-cron');
const { readData } = require('./storage');
const { isUserRegistered } = require('../utils/userUtils');

function startReminders(client) {
    // Schedule daily at 9:00 AM local time
    cron.schedule('0 9 * * *', async () => {
        console.log('Running daily task reminders...');
        await sendReminders(client);
    });
    
    console.log('Daily reminders scheduled for 9:00 AM');
}

// Manual trigger for testing
function triggerReminders(client) {
    console.log('Manually triggering reminders...');
    return sendReminders(client);
}

async function sendReminders(client) {
    try {
        const data = readData();
        const tasks = data.tasks || [];
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        
        for (const task of tasks) {
            if (task.status !== 'pending') continue;
            
            // Skip if user is not registered
            if (!isUserRegistered(task.assignedTo)) {
                console.log(`⚠️ Skipping reminder for unregistered user ${task.assignedTo} (task ${task.taskId})`);
                continue;
            }
            
            const dueDate = task.dueDate;
            const isOverdue = dueDate < today;
            const isDueToday = dueDate === today;
            
            if (!isOverdue && !isDueToday) continue;
            
            // Check subtasks - they are the actual tasks
            const overdueSubtasks = [];
            const dueTodaySubtasks = [];
            
            if (task.subTasks && task.subTasks.length > 0) {
                for (const subtask of task.subTasks) {
                    if (subtask.status === 'pending' && !subtask.completedAt) {
                        if (isOverdue) {
                            overdueSubtasks.push(subtask);
                        } else if (isDueToday) {
                            dueTodaySubtasks.push(subtask);
                        }
                    }
                }
            } else {
                // No subtasks, treat main task as the work item
                if (isOverdue) {
                    overdueSubtasks.push({ title: task.movieName });
                } else if (isDueToday) {
                    dueTodaySubtasks.push({ title: task.movieName });
                }
            }
            
            // Send reminders for overdue and due today items
            if (overdueSubtasks.length > 0 || dueTodaySubtasks.length > 0) {
                await sendTaskReminder(client, task, overdueSubtasks, dueTodaySubtasks);
            }
        }
    } catch (error) {
        console.error('Error sending reminders:', error);
    }
}

async function sendTaskReminder(client, task, overdueSubtasks, dueTodaySubtasks) {
    try {
        const user = await client.users.fetch(task.assignedTo);
        
        let message = '';
        
        // Overdue reminders
        if (overdueSubtasks.length > 0) {
            message += `⚠️ **Overdue Task Alert!**\n`;
            message += `Task ${task.taskId} (${task.movieName}) was due on ${task.dueDate}\n\n`;
            message += `**Overdue items:**\n`;
            overdueSubtasks.forEach(subtask => {
                message += `• ${subtask.title}\n`;
            });
            message += '\n';
        }
        
        // Due today reminders
        if (dueTodaySubtasks.length > 0) {
            message += `📅 **Task Due Today!**\n`;
            message += `Task ${task.taskId} (${task.movieName}) is due today (${task.dueDate})\n\n`;
            message += `**Items due today:**\n`;
            dueTodaySubtasks.forEach(subtask => {
                message += `• ${subtask.title}\n`;
            });
        }
        
        await user.send(message.trim());
        console.log(`Reminder sent to user ${task.assignedTo} for task ${task.taskId}`);
        
    } catch (error) {
        console.error(`Failed to send reminder for task ${task.taskId}:`, error);
    }
}

module.exports = { startReminders, triggerReminders, sendReminders };
