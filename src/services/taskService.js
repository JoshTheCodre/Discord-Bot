const cron = require('node-cron');
const { readData } = require('./storage');
const { isUserRegistered } = require('../utils/userUtils');
const { log } = require('./logService');

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
            const items = overdueSubtasks.map(st => `• ${st.title || st.subTaskID || 'Subtask'}`).join('\n');
            message += `Hey! Just a heads-up — you have ${overdueSubtasks.length} overdue item${overdueSubtasks.length !== 1 ? 's' : ''} for **${task.movieName}** (${task.taskId}), which was due on ${task.dueDate}.\n\n${items}\n\nPlease try to get these submitted as soon as you can.`;
        }

        if (dueTodaySubtasks.length > 0) {
            if (message) message += '\n\n---\n\n';
            const items = dueTodaySubtasks.map(st => `• ${st.title || st.subTaskID || 'Subtask'}`).join('\n');
            message += `Reminder: the following item${dueTodaySubtasks.length !== 1 ? 's are' : ' is'} due today for **${task.movieName}** (${task.taskId}):\n\n${items}\n\nYou've got this — make sure to submit before the end of the day!`;
        }

        await user.send(message.trim());
        console.log(`Reminder sent to user ${task.assignedTo} for task ${task.taskId}`);
        await log('reminder_sent', `Reminder sent to ${task.assignedTo} for task ${task.taskId}`, {
            taskId: task.taskId, userId: task.assignedTo
        });
    } catch (error) {
        console.error(`Failed to send reminder for task ${task.taskId}:`, error);
        await log('dm_failed', `Could not send reminder to ${task.assignedTo} for task ${task.taskId}`, {
            taskId: task.taskId, userId: task.assignedTo
        });
    }
}

module.exports = { startReminders, triggerReminders, sendReminders };
