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
        const data = readData();
        const tasks = data.tasks || [];
        const today = new Date().toISOString().split('T')[0];
        
        for (const task of tasks) {
            if (task.status !== 'pending' || !isUserRegistered(task.assignedTo)) {
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
            message += `⚠️ **Overdue Task Alert!**\nTask ${task.taskId} (${task.movieName}) was due on ${task.dueDate}\n\n**Overdue items:**\n`;
            overdueSubtasks.forEach(subtask => message += `• ${subtask.title}\n`);
            message += '\n';
        }
        
        if (dueTodaySubtasks.length > 0) {
            message += `📅 **Task Due Today!**\nTask ${task.taskId} (${task.movieName}) is due today (${task.dueDate})\n\n**Items due today:**\n`;
            dueTodaySubtasks.forEach(subtask => message += `• ${subtask.title}\n`);
        }
        
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const dismissButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('dismiss_reminder_dm')
                    .setLabel('Dismiss')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('❌')
            );

        await user.send({ 
            content: message.trim(), 
            components: [dismissButton] 
        });
        console.log(`Reminder sent to user ${task.assignedTo} for task ${task.taskId}`);
    } catch (error) {
        console.error(`Failed to send reminder for task ${task.taskId}:`, error);
    }
}

module.exports = { startReminders, triggerReminders, sendReminders };
