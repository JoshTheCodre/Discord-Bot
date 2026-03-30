const { Client, GatewayIntentBits, EmbedBuilder, Partials } = require('discord.js');
require('dotenv').config();
const { readData, saveTask, saveUser } = require('./services/storage');
const { generateTaskId, resolveUserId, getUserDisplayName, ensureUser, validateUserRegistration, getUserMention } = require('./utils/userUtils');
const { parseTaskMessage } = require('./utils/parser');
const { startReminders } = require('./services/taskService');
const { handleFinishedTaskMessage } = require('./services/finishedTaskService');
const { handleSetupCommand, handleSetupModalSubmit, getUserRole, ADMIN_IDS } = require('./services/setupService');
const { startBirthdayReminders, triggerBirthdayCheck } = require('./services/birthdayService');
const { registerCommands } = require('./utils/registerCommands');
const { generatePerformanceSummary, syncAllDataToSheets } = require('./services/performanceService');
const { handleTasksCommand } = require('./services/tasksViewService');
const MovieReminderService = require('./services/movieReminderService');
const DiscordUtils = require('./utils/discordUtils');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// Prevent duplicate processing
const processedMessages = new Set();

async function safeRespondToInteraction(interaction, payload) {
    try {
        if (interaction.deferred) {
            await interaction.editReply(payload);
            return true;
        }

        if (interaction.replied) {
            await interaction.followUp({ ...payload, flags: payload.flags ?? 64 });
            return true;
        }

        await interaction.reply(payload);
        return true;
    } catch (error) {
        if (error?.code === 10062) {
            console.warn('⚠️ Interaction expired before response could be sent.');
            return false;
        }

        console.error('Error sending interaction response:', error);
        return false;
    }
}

// Handle performance command
async function handlePerformanceCommand(interaction) {
    try {
        // Check admin permission first
        if (!ADMIN_IDS.includes(interaction.user.id)) {
            const embed = DiscordUtils.createAdminOnlyEmbed('performance reports');
            return await DiscordUtils.sendEphemeral(interaction, embed);
        }

        const reportType = interaction.options.getString('type');
        
        // Defer reply immediately to prevent timeout
        await interaction.deferReply({ flags: 64 });

        if (reportType === 'sheets-sync') {
            const result = await syncAllDataToSheets();
            const embed = result.success 
                ? DiscordUtils.createSuccessEmbed('Google Sheets Sync Complete!', 'Data successfully synced to Google Sheets.')
                : DiscordUtils.createErrorEmbed('Sync Failed', 'Error syncing data to Google Sheets.');

            if (result.success) {
                embed.addFields(
                    { name: '👥 Users Synced', value: result.users.usersCount?.toString() || '0', inline: true },
                    { name: '📺 Channels Synced', value: result.channels.channelsCount?.toString() || '0', inline: true },
                    { name: '📋 Total Subtasks', value: result.users.totalSubtasks?.toString() || '0', inline: true },
                    { name: '✅ Completed', value: result.users.completedSubtasks?.toString() || '0', inline: true },
                    { name: '📊 Sheets URL', value: '[View Live Data](https://docs.google.com/spreadsheets/d/1S9XfOmIS4latiGRmYHOJGx_XSs9bSc8b_BHNNhPlEMA/edit)', inline: false }
                );
            } else {
                embed.addFields({ name: '🐛 Error', value: result.error || 'Unknown error', inline: false });
            }
            await interaction.editReply({ embeds: [embed] });

        } else if (reportType === 'summary') {
            const result = await generatePerformanceSummary();
            const embed = new EmbedBuilder()
                .setColor(result.success ? '#2196F3' : '#FF4444')
                .setTitle(result.success ? '📈 Performance Summary' : '❌ Summary Failed')
                .setTimestamp();

            if (result.success) {
                const topPerformers = Object.entries(result.userStats)
                    .filter(([_, user]) => user.total > 0)
                    .sort((a, b) => b[1].completionRate - a[1].completionRate)
                    .slice(0, 5);

                embed.setDescription('**Team Performance Overview**')
                    .addFields(
                        { name: '👥 Total Users', value: result.summary.totalUsers.toString(), inline: true },
                        { name: '📋 Total Subtasks', value: result.summary.totalSubtasks.toString(), inline: true },
                        { name: '✅ Approved', value: result.summary.totalApproved.toString(), inline: true },
                        { name: '🔄 Active', value: result.summary.totalActive.toString(), inline: true },
                        { name: '⏰ Overdue', value: result.summary.totalPastDeadline.toString(), inline: true },
                        { name: '📊 Avg Rate', value: `${result.summary.averageCompletionRate}%`, inline: true }
                    );

                if (topPerformers.length > 0) {
                    const performersList = topPerformers
                        .map(([_, user], i) => `${i + 1}. **${user.name}** - ${user.completionRate}% (${user.approved}/${user.total})`)
                        .join('\n');
                    embed.addFields({ name: '🏆 Individual Performance', value: performersList, inline: false });
                }
            } else {
                embed.setDescription('Error generating performance summary.')
                    .addFields({ name: '🐛 Error', value: result.error || 'Unknown error', inline: false });
            }
            await interaction.editReply({ embeds: [embed] });
        }
    } catch (error) {
        console.error('Error handling performance command:', error);
        
        // Check if interaction can still be responded to
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ An error occurred while processing the performance command.',
                    flags: 64
                });
            } else if (interaction.deferred) {
                await interaction.editReply({
                    content: '❌ An error occurred while processing the performance command.'
                });
            }
        } catch (responseError) {
            console.error('Error sending error response:', responseError);
        }
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

        await discordUser.send({ 
            embeds: [congratsEmbed]
        });
        console.log(`📧 Congratulatory DM sent to ${user.name} for task ${task.taskId}`);
        
    } catch (error) {
        console.error(`Failed to send assignment DM to user ${task.assignedTo}:`, error);
    }
}

// Handle movies command
async function handleMoviesCommand(interaction) {
    try {
        // Check admin permission
        if (!ADMIN_IDS.includes(interaction.user.id)) {
            return await interaction.reply({ 
                embeds: [new EmbedBuilder()
                    .setColor('#FF4444')
                    .setTitle('🔒 Admin Only Command')
                    .setDescription('Only administrators can manage movie reminders.')
                    .setTimestamp()], 
                flags: 64
            });
        }

        const action = interaction.options.getString('action');
        await interaction.deferReply({ flags: 64 });
        
        if (action === 'test') {
            try {
                await interaction.client.movieReminder.testReminder();
                
                const embed = new EmbedBuilder()
                    .setColor('#4CAF50')
                    .setTitle('🎬 Movie Reminder Test Complete')
                    .setDescription('Test reminder has been sent! Check your DMs for movie notifications.')
                    .setTimestamp();
                
                await interaction.editReply({ embeds: [embed] });
            } catch (error) {
                const embed = new EmbedBuilder()
                    .setColor('#FF4444')
                    .setTitle('❌ Movie Reminder Test Failed')
                    .setDescription(`Error: ${error.message}`)
                    .setTimestamp();
                
                await interaction.editReply({ embeds: [embed] });
            }
        } else if (action === 'month') {
            try {
                const movies = await interaction.client.movieReminder.getMoviesFromDoc();
                const currentMonthMovies = interaction.client.movieReminder.getMoviesForCurrentMonth(movies);
                const upcomingMovies = currentMonthMovies.filter(movie => movie.date >= new Date());
                
                const embed = new EmbedBuilder()
                    .setColor('#FF6B6B')
                    .setTitle('🎬 Upcoming Movies This Month')
                    .setTimestamp();

                if (upcomingMovies.length === 0) {
                    embed.setDescription('No upcoming movie releases found for this month.');
                } else {
                    // Group movies by date
                    const moviesByDate = {};
                    upcomingMovies.forEach(movie => {
                        const dateKey = movie.date.toDateString();
                        if (!moviesByDate[dateKey]) moviesByDate[dateKey] = [];
                        moviesByDate[dateKey].push(movie);
                    });

                    // Add fields for each date (limit to 25 fields)
                    const dates = Object.keys(moviesByDate).slice(0, 25);
                    dates.forEach(dateKey => {
                        const dateMovies = moviesByDate[dateKey];
                        const movieList = dateMovies
                            .map(movie => `• **${movie.title}** (${movie.platform})`)
                            .join('\n');
                        
                        embed.addFields({
                            name: `📅 ${dateKey}`,
                            value: movieList.substring(0, 1024), // Discord field limit
                            inline: false
                        });
                    });

                    embed.setDescription(`Found **${upcomingMovies.length}** upcoming movie releases this month.`);
                }

                // Add link to full calendar
                embed.addFields({
                    name: '📋 Full Movie Calendar',
                    value: '[View Complete Calendar](https://docs.google.com/document/d/1x1V4u3GFh1zpJYwMXfQMGRBSQV50y-no/edit?pli=1)',
                    inline: false
                });
                
                await interaction.editReply({ embeds: [embed] });
            } catch (error) {
                const embed = new EmbedBuilder()
                    .setColor('#FF4444')
                    .setTitle('❌ Failed to Load Movies')
                    .setDescription(`Error: ${error.message}`)
                    .setTimestamp();
                
                await interaction.editReply({ embeds: [embed] });
            }
        }
    } catch (error) {
        console.error('Error in movies command:', error);
        const embed = new EmbedBuilder()
            .setColor('#FF4444')  
            .setTitle('❌ Command Error')
            .setDescription('There was an error processing the movies command.')
            .setTimestamp();

        await safeRespondToInteraction(interaction, { embeds: [embed], flags: 64 });
    }
}

client.once('clientReady', async () => {
    console.log('Bot is online');
    
    // Register slash commands
    await registerCommands();
    
    // Start reminder systems
    startReminders(client);
    startBirthdayReminders(client);
    
    // Start movie reminder service
    const movieReminder = new MovieReminderService(client);
    movieReminder.start();
    
    // Store reference for command access
    client.movieReminder = movieReminder;
    
    // Log monitored channels
    const taskAssignmentChannels = ['task-assignments', 'shorts-task-assignment'];
    const finishedTaskChannels = ['finished-tasks', 'shorts-finished'];
    console.log(`📋 Monitoring task assignment channels: ${taskAssignmentChannels.join(', ')}`);
    console.log(`✅ Monitoring finished task channels: ${finishedTaskChannels.join(', ')}`);
});

// Handle slash command interactions
client.on('interactionCreate', async (interaction) => {
    try {
        // Handle button interactions
        if (interaction.isButton()) {
            if (interaction.customId === 'dismiss_movie_reminder') {
                await interaction.message.delete();
                return;
            }
            

        }

        if (interaction.isChatInputCommand()) {
            // Handle slash commands
            switch (interaction.commandName) {
                case 'setup':
                    await handleSetupCommand(interaction);
                    break;
                case 'performance':
                    await handlePerformanceCommand(interaction);
                    break;
                case 'tasks':
                    await handleTasksCommand(interaction);
                    break;
                case 'movies':
                    await handleMoviesCommand(interaction);
                    break;
                default:
                    await interaction.reply({
                        content: '❌ Unknown command.',
                        flags: 64
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
                        flags: 64
                    });
            }
        }
    } catch (error) {
        console.error('Error handling interaction:', error);
        
        const errorMessage = {
            content: '❌ An error occurred while processing your request.',
            flags: 64
        };

        await safeRespondToInteraction(interaction, errorMessage);
    }
});


// Handle reactions for marking tasks as posted
client.on('messageReactionAdd', async (reaction, user) => {
    console.log(`🔔 Reaction detected: ${reaction.emoji.name} by ${user.username}`);
    
    try {
        // Ignore bot reactions
        if (user.bot) {
            console.log('⏭️ Skipping bot reaction');
            return;
        }
        
        // Fetch partial reactions/messages
        if (reaction.partial) {
            console.log('📥 Fetching partial reaction...');
            await reaction.fetch();
        }
        
        const message = reaction.message;
        console.log(`📨 Message channel: ${message.channel?.name || 'Unknown'}`);
        
        // Only process in finished-tasks channels
        const finishedTaskChannels = ['finished-tasks', 'shorts-finished'];
        const channelName = message.channel?.name?.toLowerCase() || message.channel?.parent?.name?.toLowerCase();
        
        console.log(`📍 Channel name to check: "${channelName}"`);
        
        if (!finishedTaskChannels.includes(channelName)) {
            console.log(`⏭️ Not a finished-tasks channel, skipping`);
            return;
        }
        
        // Check if reaction is a regional indicator (J/O/D/S)
        const regionalIndicators = ['🇯', '🇴', '🇩', '🇸']; // J, O, D, S
        const isRegionalIndicator = regionalIndicators.includes(reaction.emoji.name);
        
        console.log(`🔤 Is regional indicator? ${isRegionalIndicator} (emoji: ${reaction.emoji.name})`);
        
        if (!isRegionalIndicator) {
            console.log('⏭️ Not a regional indicator, skipping');
            return;
        }
        
        console.log(`📍 Post reaction detected: ${reaction.emoji.name} by ${user.username}`);
        
        // Extract subtask title from message
        const { extractSubtaskTitle, findTaskBySubtaskTitle } = require('./services/finishedTaskService');
        const subtaskTitle = extractSubtaskTitle(message.content);
        
        if (!subtaskTitle) {
            console.log('❌ Could not extract subtask title from message');
            return;
        }
        
        // Find and update the task
        const result = await findTaskBySubtaskTitle(subtaskTitle);
        if (!result) {
            console.log(`❌ Task not found for: ${subtaskTitle}`);
            return;
        }
        
        const { task, subtask } = result;
        
        // Update posted status
        subtask.posted = true;
        subtask.postedBy = user.id;
        subtask.postedAt = new Date().toISOString();
        
        // Save to Firestore
        const { updateTask } = require('./firebase/firestoreService');
        await updateTask(task.firestoreId || task.id, task);
        
        console.log(`✅ Marked "${subtaskTitle}" as posted by ${user.username}`);
        
        // React to confirm
        await message.react('📌');
        
    } catch (error) {
        console.error('❌ Error handling reaction:', error);
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
    
    // Handle finished task approvals in #finished-tasks channel
    const finishedTaskHandled = await handleFinishedTaskMessage(message);
    if (finishedTaskHandled) return;
    
    // Handle task creation (messages in task assignment channels)
    const taskAssignmentChannels = ['task-assignments', 'shorts-task-assignment'];
    if (!taskAssignmentChannels.includes(message.channel.name)) return;
    
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
    const storageData = await readData();
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
        const registrationCheck = await validateUserRegistration(assignedUserId, 'task assignment');
        
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
        const storageData = await readData();
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
        
        // Save task to Firestore
        await saveTask(task);
        
        console.log(`✅ Task ${taskId} created and saved`);
        message.reply(`✅ Task ${taskId} created for ${user.name}`);
        
        // Send congratulatory DM to the assigned user
        await sendTaskAssignmentDM(client, task, user);
        
    } catch (error) {
        console.error('Error creating task:', error);
        message.reply('❌ Error creating task. Please try again.');
    }
});

// Simple HTTP server for health checks (required by Render)
const http = require('http');
const port = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
        }));
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

server.listen(port, () => {
    console.log(`🌐 Health check server running on port ${port}`);
});

// Debug environment variables
console.log('🔍 Environment check:');
console.log(`- NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`- DISCORD_BOT_TOKEN: ${process.env.DISCORD_BOT_TOKEN ? '✅ Set' : '❌ Missing'}`);
console.log(`- CLIENT_ID: ${process.env.CLIENT_ID ? '✅ Set' : '❌ Missing'}`);
console.log(`- GOOGLE_CLOUD_CREDENTIALS: ${process.env.GOOGLE_CLOUD_CREDENTIALS ? '✅ Set' : '❌ Missing'}`);

// Validate required environment variables
const requiredEnvVars = ['DISCORD_BOT_TOKEN', 'CLIENT_ID'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingEnvVars);
    console.error('Please set these environment variables in your deployment platform.');
    process.exit(1);
}

// Start web dashboard
const webServer = require('./web/server');

console.log('🚀 Starting Discord bot...');
client.login(process.env.DISCORD_BOT_TOKEN);
