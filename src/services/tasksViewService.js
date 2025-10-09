/**
 * Tasks Service
 * Handles task viewing and filtering functionality
 */

const { EmbedBuilder } = require('discord.js');
const { readData } = require('./storage');
const { ADMIN_IDS } = require('./setupService');

/**
 * Get formatted task information for display
 */
const formatTaskInfo = (task, includeSubtasks = true) => {
    let taskInfo = `**TaskID**: ${task.taskId}\n`;
    taskInfo += `**Movie**: ${task.movieName}\n`;
    taskInfo += `**Deadline**: ${task.dueDate}\n`;
    
    if (includeSubtasks && task.subTasks && task.subTasks.length > 0) {
        taskInfo += `**SubTasks**:\n`;
        task.subTasks.forEach(subtask => {
            const statusIcon = subtask.status === 'completed' ? '✅' : '⏳';
            taskInfo += `${statusIcon} ${subtask.title}\n`;
        });
    }
    
    return taskInfo;
};

/**
 * Filter tasks based on criteria
 */
const filterTasks = (tasks, filterType, today = new Date().toISOString().split('T')[0]) => {
    if (!filterType) return tasks;
    
    return tasks.filter(task => {
        switch (filterType) {
            case 'complete':
                // Show only tasks where ALL subtasks are completed
                return task.subTasks && task.subTasks.every(st => st.status === 'completed');
                
            case 'active':
                // Show only tasks with pending/active subtasks
                return task.subTasks && task.subTasks.some(st => st.status !== 'completed');
                
            case 'due':
                // Show only tasks that are overdue AND have incomplete subtasks
                const isOverdue = task.dueDate < today;
                const hasIncompleteSubtasks = task.subTasks && task.subTasks.some(st => st.status !== 'completed');
                return isOverdue && hasIncompleteSubtasks;
                
            default:
                return true;
        }
    });
};

/**
 * Get user's task statistics
 */
const getUserTaskStats = (tasks, userId) => {
    const userTasks = tasks.filter(task => task.assignedTo === userId);
    
    const stats = {
        total: 0,
        completed: 0,
        active: 0,
        overdue: 0
    };
    
    const today = new Date().toISOString().split('T')[0];
    
    userTasks.forEach(task => {
        if (task.subTasks && task.subTasks.length > 0) {
            task.subTasks.forEach(subtask => {
                stats.total++;
                if (subtask.status === 'completed') {
                    stats.completed++;
                } else {
                    stats.active++;
                    if (task.dueDate < today) {
                        stats.overdue++;
                    }
                }
            });
        } else {
            // Handle tasks without subtasks (legacy)
            stats.total++;
            if (task.status === 'completed') {
                stats.completed++;
            } else {
                stats.active++;
                if (task.dueDate < today) {
                    stats.overdue++;
                }
            }
        }
    });
    
    return { tasks: userTasks, stats };
};

/**
 * Handle tasks command
 */
const handleTasksCommand = async (interaction) => {
    try {
        const requestingUserId = interaction.user.id;
        const targetUser = interaction.options.getUser('user');
        const filterType = interaction.options.getString('filter');
        
        const data = readData();
        const tasks = data.tasks || [];
        const users = data.users || [];
        
        // Determine target user ID
        let targetUserId = targetUser ? targetUser.id : requestingUserId;
        
        // Check permissions for viewing other users' tasks
        if (targetUser && targetUser.id !== requestingUserId) {
            if (!ADMIN_IDS.includes(requestingUserId)) {
                const embed = new EmbedBuilder()
                    .setColor('#FF4444')
                    .setTitle('🔒 Admin Only Feature')
                    .setDescription('Only administrators can view other users\' tasks.')
                    .addFields(
                        { name: '👑 Permission Required', value: 'Admin role needed to view other users\' tasks', inline: false },
                        { name: '💡 What You Can Do', value: 'Use `/tasks` without mentioning a user to see your own tasks', inline: false }
                    )
                    .setFooter({ text: 'Task viewing permissions' })
                    .setTimestamp();
                
                return await interaction.reply({ embeds: [embed], ephemeral: true });
            }
        }
        
        // Get user information
        const targetUserData = users.find(u => u.id === targetUserId);
        const displayName = targetUser ? targetUser.displayName : 
                           targetUserData ? targetUserData.name : 
                           `User ${targetUserId}`;
        
        // Get and filter user's tasks
        const { tasks: userTasks, stats } = getUserTaskStats(tasks, targetUserId);
        const filteredTasks = filterTasks(userTasks, filterType);
        
        if (filteredTasks.length === 0) {
            const filterText = filterType ? ` (${filterType} filter)` : '';
            const embed = new EmbedBuilder()
                .setColor('#FFC107')
                .setTitle('📋 No Tasks Found')
                .setDescription(`No tasks found for **${displayName}**${filterText}.`)
                .addFields(
                    { name: '📊 Task Statistics', value: 
                        `**Total Subtasks**: ${stats.total}\n` +
                        `**Completed**: ${stats.completed}\n` +
                        `**Active**: ${stats.active}\n` +
                        `**Overdue**: ${stats.overdue}`, inline: false }
                )
                .setFooter({ text: 'Task overview' })
                .setTimestamp();
            
            return await interaction.reply({ embeds: [embed] });
        }
        
        // Create embeds for tasks (Discord has embed limits)
        const embeds = [];
        const maxTasksPerEmbed = 5;
        
        for (let i = 0; i < filteredTasks.length; i += maxTasksPerEmbed) {
            const taskBatch = filteredTasks.slice(i, i + maxTasksPerEmbed);
            
            const embed = new EmbedBuilder()
                .setColor('#2196F3')
                .setTitle(i === 0 ? `📋 Tasks for ${displayName}` : `📋 Tasks (continued)`)
                .setTimestamp();
            
            if (i === 0) {
                // Add filter and stats info to first embed
                let description = '';
                if (filterType) {
                    const filterNames = {
                        'complete': 'Completed Tasks Only',
                        'active': 'Active/Pending Tasks Only', 
                        'due': 'Overdue Tasks Only'
                    };
                    description += `**Filter**: ${filterNames[filterType]}\n\n`;
                }
                
                description += `**Task Statistics**:\n`;
                description += `Total Subtasks: ${stats.total} | `;
                description += `Completed: ${stats.completed} | `;
                description += `Active: ${stats.active} | `;
                description += `Overdue: ${stats.overdue}\n\n`;
                description += `**Showing ${filteredTasks.length} task(s)**:`;
                
                embed.setDescription(description);
            }
            
            taskBatch.forEach((task, index) => {
                const taskNumber = i + index + 1;
                const taskInfo = formatTaskInfo(task, true);
                
                embed.addFields({
                    name: `${taskNumber}. Task ${task.taskId}`,
                    value: taskInfo,
                    inline: false
                });
            });
            
            if (i === 0) {
                embed.setFooter({ text: `Page ${Math.floor(i / maxTasksPerEmbed) + 1} of ${Math.ceil(filteredTasks.length / maxTasksPerEmbed)} | Task viewing` });
            } else {
                embed.setFooter({ text: `Page ${Math.floor(i / maxTasksPerEmbed) + 1} of ${Math.ceil(filteredTasks.length / maxTasksPerEmbed)}` });
            }
            
            embeds.push(embed);
        }
        
        // Send the embeds
        if (embeds.length === 1) {
            await interaction.reply({ embeds: [embeds[0]] });
        } else {
            // Send multiple embeds for large task lists
            await interaction.reply({ embeds: [embeds[0]] });
            for (let i = 1; i < embeds.length; i++) {
                await interaction.followUp({ embeds: [embeds[i]] });
            }
        }
        
    } catch (error) {
        console.error('Error handling tasks command:', error);
        await interaction.reply({
            content: '❌ An error occurred while retrieving tasks.',
            ephemeral: true
        });
    }
};

module.exports = {
    handleTasksCommand,
    formatTaskInfo,
    filterTasks,
    getUserTaskStats
};
