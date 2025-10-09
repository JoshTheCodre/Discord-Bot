const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
require('dotenv').config();
const { readData, writeData } = require('./services/storage');
const { generateTaskId, resolveUserId, getUserDisplayName, ensureUser, validateUserRegistration, getUserMention } = require('./utils/userUtils');
const { parseTaskMessage } = require('./utils/parser');
const { startReminders } = require('./services/taskService');
const { handleFinishedTaskMessage } = require('./services/finishedTaskService');
const { handleSetupCommand, handleSetupModalSubmit, getUserRole, ADMIN_IDS } = require('./services/setupService');
const { startBirthdayReminders, triggerBirthdayCheck } = require('./services/birthdayService');
const { registerCommands } = require('./utils/registerCommands');
const { generateUsersTitlesSheet, generateChannelTitlesSheet, generatePerformanceSummary } = require('./services/performanceService');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// Prevent duplicate processing
const processedMessages = new Set();

// Handle performance command
async function handlePerformanceCommand(interaction) {
    try {
        // Check if user is admin
        if (!ADMIN_IDS.includes(interaction.user.id)) {
            const embed = new EmbedBuilder()
                .setColor('#FF4444')
                .setTitle('🔒 Admin Only Command')
                .setDescription('Only administrators can generate performance reports.')
                .addFields(
                    { name: '👑 Required Permission', value: 'Admin role required', inline: false },
                    { name: '💡 Need Help?', value: 'Contact an administrator if you believe this is an error', inline: false }
                )
                .setFooter({ text: 'Performance reports restricted to admins' })
                .setTimestamp();
            
            return await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const reportType = interaction.options.getString('type');
        
        // Defer reply since Excel generation might take time
        await interaction.deferReply({ ephemeral: true });

        if (reportType === 'excel') {
            // Generate Excel report
            const result = await generateUsersTitlesSheet();
            
            if (result.success) {
                const embed = new EmbedBuilder()
                    .setColor('#4CAF50')
                    .setTitle('📊 Excel Report Generated Successfully!')
                    .setDescription('**Users — Titles & Totals** report has been created.')
                    .addFields(
                        { name: '📁 File Location', value: result.filepath, inline: false },
                        { name: '👥 Total Users', value: result.stats.totalUsers.toString(), inline: true },
                        { name: '✅ Users with Tasks', value: result.stats.usersWithTasks.toString(), inline: true },
                        { name: '📋 Total Subtasks', value: result.stats.totalSubtasks.toString(), inline: true },
                        { name: '✅ Approved', value: result.stats.totalApproved.toString(), inline: true },
                        { name: '🔄 Active', value: result.stats.totalActive.toString(), inline: true },
                        { name: '⏰ Past Deadline', value: result.stats.totalPastDeadline.toString(), inline: true }
                    )
                    .setFooter({ text: 'Excel report saved locally' })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
            } else {
                const embed = new EmbedBuilder()
                    .setColor('#FF4444')
                    .setTitle('❌ Report Generation Failed')
                    .setDescription('There was an error generating the Excel report.')
                    .addFields({ name: '🐛 Error', value: result.error, inline: false })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
            }
        } else if (reportType === 'channels') {
            // Generate Channel Titles & Total report
            const result = await generateChannelTitlesSheet();
            
            if (result.success) {
                const embed = new EmbedBuilder()
                    .setColor('#9C27B0')
                    .setTitle('📺 Channel Report Generated Successfully!')
                    .setDescription('**Channels — Titles & Total** report has been created.')
                    .addFields(
                        { name: '📁 File Location', value: result.filepath, inline: false },
                        { name: '📺 Total Channels', value: result.stats.totalChannels.toString(), inline: true },
                        { name: '📋 Total Forwarded', value: result.stats.totalForwarded.toString(), inline: true }
                    );

                // Add channel breakdown if available
                if (result.stats.channelBreakdown && Object.keys(result.stats.channelBreakdown).length > 0) {
                    const breakdown = Object.entries(result.stats.channelBreakdown)
                        .map(([channel, count]) => `**${channel}**: ${count}`)
                        .join('\n');
                    
                    embed.addFields({ name: '📊 Channel Breakdown', value: breakdown, inline: false });
                }

                embed.setFooter({ text: 'Channel report saved locally' }).setTimestamp();

                await interaction.editReply({ embeds: [embed] });
            } else {
                const embed = new EmbedBuilder()
                    .setColor('#FF4444')
                    .setTitle('❌ Channel Report Generation Failed')
                    .setDescription('There was an error generating the channel Excel report.')
                    .addFields({ name: '🐛 Error', value: result.error, inline: false })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
            }
        } else if (reportType === 'summary') {
            // Generate performance summary
            const result = generatePerformanceSummary();
            
            if (result.success) {
                const topPerformers = Object.entries(result.userStats)
                    .filter(([_, user]) => user.total > 0)
                    .sort((a, b) => b[1].completionRate - a[1].completionRate)
                    .slice(0, 5);

                const embed = new EmbedBuilder()
                    .setColor('#2196F3')
                    .setTitle('📈 Performance Summary')
                    .setDescription('**Team Performance Overview**')
                    .addFields(
                        { name: '👥 Total Users', value: result.summary.totalUsers.toString(), inline: true },
                        { name: '📋 Total Subtasks', value: result.summary.totalSubtasks.toString(), inline: true },
                        { name: '✅ Approved', value: result.summary.totalApproved.toString(), inline: true },
                        { name: '🔄 Active', value: result.summary.totalActive.toString(), inline: true },
                        { name: '⏰ Past Deadline', value: result.summary.totalPastDeadline.toString(), inline: true },
                        { name: '📊 Avg Completion Rate', value: `${result.summary.averageCompletionRate}%`, inline: true }
                    );

                if (topPerformers.length > 0) {
                    const performersList = topPerformers
                        .map(([_, user], index) => 
                            `${index + 1}. **${user.name}** - ${user.completionRate}% (${user.approved}/${user.total})`
                        )
                        .join('\n');
                    
                    embed.addFields({ name: '🏆 Top Performers', value: performersList, inline: false });
                }

                embed.setFooter({ text: 'Performance data as of today' }).setTimestamp();

                await interaction.editReply({ embeds: [embed] });
            } else {
                const embed = new EmbedBuilder()
                    .setColor('#FF4444')
                    .setTitle('❌ Summary Generation Failed')
                    .setDescription('There was an error generating the performance summary.')
                    .addFields({ name: '🐛 Error', value: result.error, inline: false })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
            }
        }
    } catch (error) {
        console.error('Error handling performance command:', error);
        await interaction.editReply({
            content: '❌ An error occurred while processing the performance command.',
            ephemeral: true
        });
    }
}

// Send congratulatory DM when task is assigned
async function sendTaskAssignmentDM(client, task, user) {
    try {
        const discordUser = await client.users.fetch(task.assignedTo);
        
        const subtaskCount = task.subTasks?.length || 0;
        const subtaskText = subtaskCount > 0 ? `${subtaskCount} subtask${subtaskCount > 1 ? 's' : ''}` : 'No subtasks';
        
        const congratsEmbed = new EmbedBuilder()
            .setColor('#32CD32') // Lime green for celebration
            .setTitle('🎉 Congratulations! New Task Assigned!')
            .setDescription(`Hey ${user.name}! You've been assigned a new task group. Time to showcase your skills! 💪`)
            .addFields(
                { name: '🆔 Task ID', value: `\`${task.taskId}\``, inline: true },
                { name: '🎬 Project', value: task.movieName, inline: true },
                { name: '🎨 Style', value: task.style, inline: true },
                { name: '📋 Subtasks', value: subtaskText, inline: true },
                { name: '📅 Deadline', value: `**${task.dueDate}**`, inline: true },
                { name: '⏰ Status', value: '🟡 Pending', inline: true }
            )
            .setFooter({ text: 'Good luck with your new assignment! 🚀' })
            .setTimestamp();

        await discordUser.send({ embeds: [congratsEmbed] });
        console.log(`📧 Congratulatory DM sent to ${user.name} for task ${task.taskId}`);
        
    } catch (error) {
        console.error(`Failed to send assignment DM to user ${task.assignedTo}:`, error);
    }
}

client.once('clientReady', async () => {
    console.log('Bot is online');
    
    // Register slash commands
    await registerCommands();
    
    // Start reminder systems
    startReminders(client);
    startBirthdayReminders(client);
});

// Handle slash command interactions
client.on('interactionCreate', async (interaction) => {
    try {
        if (interaction.isChatInputCommand()) {
            // Handle slash commands
            switch (interaction.commandName) {
                case 'setup':
                    await handleSetupCommand(interaction);
                    break;
                case 'performance':
                    await handlePerformanceCommand(interaction);
                    break;
                default:
                    await interaction.reply({
                        content: '❌ Unknown command.',
                        ephemeral: true
                    });
            }
        } else if (interaction.isModalSubmit()) {
            // Handle modal submissions
            switch (interaction.customId) {
                case 'user_setup_modal':
                    await handleSetupModalSubmit(interaction);
                    break;
                default:
                    await interaction.reply({
                        content: '❌ Unknown modal submission.',
                        ephemeral: true
                    });
            }
        }
    } catch (error) {
        console.error('Error handling interaction:', error);
        
        const errorMessage = {
            content: '❌ An error occurred while processing your request.',
            ephemeral: true
        };
        
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMessage);
        } else {
            await interaction.reply(errorMessage);
        }
    }
});



client.on('messageCreate', async (message) => {
    // Skip bot messages
    if (message.author.bot) return;
    
    // Handle admin birthday test command
    if (message.content === '!test-birthday') {
        const { getUserRole } = require('./services/setupService');
        const userRole = getUserRole(message.author.id);
        
        if (userRole === 'admin') {
            message.reply('🎂 Triggering birthday check...');
            await triggerBirthdayCheck(client);
            return;
        } else {
            message.reply('❌ Only admins can use this command.');
            return;
        }
    }
    
    // Handle finished task forwarding (replies and threads in #finished-tasks channel)
    const finishedTaskHandled = await handleFinishedTaskMessage(message);
    if (finishedTaskHandled) return;
    
    // Handle task creation (messages in #task-assignments channel)
    if (message.channel.name !== 'task-assignments') return;
    
    // Check if user is admin before allowing task creation
    if (!ADMIN_IDS.includes(message.author.id)) {
        console.log(`❌ NON-ADMIN TASK CREATION: ${message.author.username} (${message.author.id}) tried to create task`);
        const embed = new EmbedBuilder()
            .setColor('#FF4444')
            .setTitle('🔒 Admin Only Action')
            .setDescription('Only administrators can create and assign tasks.')
            .addFields(
                { name: '👑 Required Permission', value: 'Admin role required', inline: false },
                { name: '💡 Need Help?', value: 'Contact an administrator if you believe this is an error', inline: false }
            )
            .setFooter({ text: 'Task creation restricted to admins' })
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
        return;
    }
    
    // Prevent duplicate processing by checking database
    const storageData = readData();
    const existingTask = storageData.tasks?.find(task => task.messageID === message.id);
    if (existingTask) {
        console.log(`Task already exists for message ${message.id}: ${existingTask.taskId}`);
        return;
    }
    
    // Also check in-memory set for extra safety
    if (processedMessages.has(message.id)) return;
    processedMessages.add(message.id);
    
    // Clean up old message IDs (keep only last 100)
    if (processedMessages.size > 100) {
        const array = Array.from(processedMessages);
        processedMessages.clear();
        array.slice(-50).forEach(id => processedMessages.add(id));
    }
    
    const result = parseTaskMessage(message.content);
    if (!result.isValid) {
        return message.reply('❌ Invalid format. Expected:\n```\nFOR @user\n\nDeadline: 13th Sept\nMovie: Movie Name\nStyle: Style Name\n\n1. First subtask\n2. Second subtask\n```');
    }
    
    try {
        // Resolve user ID first
        const assignedUserId = await resolveUserId(message.guild, result.data.assignedTo);
        console.log(`Creating task for user ID: ${assignedUserId}`);
        
        // Check if user is registered (completed /setup)
        const registrationCheck = validateUserRegistration(assignedUserId, 'task assignment');
        
        if (!registrationCheck.isRegistered) {
            console.log(`❌ User ${assignedUserId} not registered`);
            return message.reply(
                `${registrationCheck.message}\n\n` +
                `${getUserMention(assignedUserId)} needs to run \`/setup\` to complete their profile before being assigned tasks.`
            );
        }
        
        console.log(`✅ User registration verified: ${registrationCheck.user.name}`);
        const user = registrationCheck.user;
        
        // Now read fresh data and create task
        const storageData = readData();
        const taskId = generateTaskId(storageData.tasks || []);
        
        const task = {
            taskId,
            movieName: result.data.movieName,
            style: result.data.style,
            dueDate: result.data.dueDate,
            assignedTo: assignedUserId,
            status: 'pending',
            createdAt: new Date().toISOString(),
            messageID: message.id,
            channelID: '', // Empty initially - will be set when task is moved to a workflow channel
            subTasks: result.data.subTasks || []
        };
        
        // Add task and save
        if (!Array.isArray(storageData.tasks)) storageData.tasks = [];
        storageData.tasks.push(task);
        writeData(storageData);
        
        console.log(`✅ Task ${taskId} created and saved`);
        message.reply(`✅ Task ${taskId} created for ${user.name}`);
        
        // Send congratulatory DM to the assigned user
        await sendTaskAssignmentDM(client, task, user);
        
    } catch (error) {
        console.error('Error creating task:', error);
        message.reply('❌ Error creating task. Please try again.');
    }
});

client.login(process.env.DISCORD_BOT_TOKEN);
