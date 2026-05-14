const cron = require('node-cron');
const { readData } = require('./storage');
const { isUserRegistered } = require('../utils/userUtils');

function startReminders(client) {
    cron.schedule('0 9 * * *', async () => {
        console.log('Running daily task reminders...');
        await sendReminders(client);
    });
    console.log('Daily reminders scheduled for 9:00 AM');
}


function triggerReminders(client) {
    console.log('Manually triggering reminders...');
    return sendReminders(client);
}


async function sendReminders(client) {
    try {
        const data = await readData();
        const tasks = data.tasks || [];
        const today = new Date().toISOString().split('T')[0];
        
        for (const task of tasks) {
            if (task.status !== 'pending' || !(await isUserRegistered(task.assignedTo))) {
                if (task.status === 'pending') {
                    console.log(`⚠️ Skipping unregistered user ${task.assignedTo} (task ${task.taskId})`);
                }
                continue;
            }
            
            const isOverdue = task.dueDate < today;
            const isDueToday = task.dueDate === today;
            
            if (!isOverdue && !isDueToday) continue;
            
            const overdueSubtasks = [];
            const dueTodaySubtasks = [];
            
            if (task.subTasks?.length > 0) {
                task.subTasks.forEach(subtask => {
                    if (subtask.status === 'pending' && !subtask.completedAt) {
                        (isOverdue ? overdueSubtasks : dueTodaySubtasks).push(subtask);
                    }
                });
            } else {
                (isOverdue ? overdueSubtasks : dueTodaySubtasks).push({ title: task.movieName });
            }
            
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
        
        if (overdueSubtasks.length > 0) {
            message += `⚠️ Overdue: Task ${task.taskId} (${task.movieName}) — ${overdueSubtasks.length} item${overdueSubtasks.length !== 1 ? 's' : ''} past due ${task.dueDate}.`;
        }

        if (dueTodaySubtasks.length > 0) {
            if (message) message += '\n';
            message += `📅 Due today: Task ${task.taskId} (${task.movieName}) — ${dueTodaySubtasks.length} item${dueTodaySubtasks.length !== 1 ? 's' : ''} due today.`;
        }
        
        await user.send(message.trim());
        console.log(`Reminder sent to user ${task.assignedTo} for task ${task.taskId}`);
    } catch (error) {
        console.error(`Failed to send reminder for task ${task.taskId}:`, error);
    }
}

module.exports = { startReminders, triggerReminders, sendReminders };
