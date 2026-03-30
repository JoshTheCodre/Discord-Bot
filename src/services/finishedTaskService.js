const { EmbedBuilder } = require('discord.js');
const { readData, getTaskByTaskId } = require('./storage');
const { updateTask } = require('../firebase/firestoreService');
const { ADMIN_IDS } = require('./setupService');
const DiscordUtils = require('../utils/discordUtils');


const FINISHED_TASK_CHANNELS = ['finished-tasks', 'shorts-finished'];
const PATTERNS = {
  taskId: /\b[A-Za-z]{2,10}\d{1,6}\b/,
  approval: /@approved/i,
  copyright: /@copyright/i,
  taskIdSplit: /^([A-Za-z]+)(\d+)$/
}; 


const getOriginalMessage = async (message) => {
  try {
    if (message.reference?.messageId && message.channel?.isTextBased()) {
      return await message.channel.messages.fetch(message.reference.messageId);
    }
    if (message.channel?.isThread()) {
      return await message.channel.fetchStarterMessage();
    }
    return null;
  } catch (error) {
    console.error('❌ Error fetching original message:', error);
    return null;
  }
};


const extractTaskId = (text) => {
  const backtickMatch = text.match(/`([^`]+)`/);
  return backtickMatch?.[1] || text.match(PATTERNS.taskId)?.[0] || null;
};


// Extract subtask title from message content
// Format: @user @user Title of Subtask
const extractSubtaskTitle = (text) => {
  console.log(`📝 Original text: "${text}"`);
  
  // Remove all mentions (@user or @role) - handles <@ID>, <@!ID>, <@&ID>
  let title = text.replace(/<@[!&]?\d+>/g, '').trim();
  console.log(`📝 After removing mentions: "${title}"`);
  
  // Remove multiple spaces (replace with single space)
  title = title.replace(/\s+/g, ' ').trim();
  console.log(`📝 After normalizing spaces: "${title}"`);
  
  // Remove any other Discord formatting
  title = title.replace(/[*_~`]/g, '').trim();
  console.log(`📝 Final title: "${title}"`);
  
  return title || null;
};


// Find task containing the subtask with given title
const findTaskBySubtaskTitle = async (subtaskTitle) => {
  try {
    const data = await readData();
    const tasks = data.tasks || [];
    
    console.log(`🔎 Searching ${tasks.length} tasks for subtask: "${subtaskTitle}"`);
    
    // Search through all tasks for matching subtask
    for (const task of tasks) {
      if (task.subTasks && Array.isArray(task.subTasks)) {
        console.log(`  Checking task ${task.taskId} with ${task.subTasks.length} subtasks`);
        
        const subtask = task.subTasks.find(st => {
          const titleMatch = st.title === subtaskTitle;
          const idMatch = st.subTaskID === subtaskTitle;
          
          if (titleMatch || idMatch) {
            console.log(`  ✅ Found match! Title: "${st.title}", ID: "${st.subTaskID}"`);
          }
          
          return titleMatch || idMatch;
        });
        
        if (subtask) {
          console.log(`✅ Found subtask in task ${task.taskId}`);
          return { 
            task, 
            subtask,
            taskGroup: task.taskId 
          };
        }
      }
    }
    
    console.log(`❌ No matching subtask found for: "${subtaskTitle}"`);
    return null;
  } catch (error) {
    console.error('❌ Error finding task by subtask title:', error);
    return null;
  }
};



const isInTargetChannel = (message) => {
  const channel = message.channel;
  const channelNames = FINISHED_TASK_CHANNELS.map(name => name.toLowerCase());
  const currentChannelName = channel?.name?.toLowerCase();
  const parentChannelName = channel?.parent?.name?.toLowerCase();
  
  const isDirectMatch = channelNames.includes(currentChannelName);
  const isThreadInTarget = channel?.isThread() && channelNames.includes(parentChannelName);
  
  return isDirectMatch || isThreadInTarget;
};


const isUserAdmin = (userId) => ADMIN_IDS.includes(userId);


const createAdminOnlyEmbed = (action) => 
  DiscordUtils.createAdminOnlyEmbed(action);


// Task Management Functions
const parseTaskId = (taskId) => {
  // Task ID format: TASKGROUP or full title
  // For approval, we extract from the thread/message context
  const match = taskId.match(PATTERNS.taskIdSplit);
  
  if (match) {
    // Legacy numeric format for backwards compatibility
    return { taskGroup: match[1], subtaskId: parseInt(match[2]) };
  }
  
  // Otherwise, treat the whole taskId as the subtask title
  return { taskGroup: null, subtaskId: taskId };
};


const completeSubtask = async (taskGroup, subtaskId) => {
  try {
    // Get task from Firestore
    console.log(`🔍 Looking for task ${taskGroup} in Firestore...`);
    let task = await getTaskByTaskId(taskGroup);
    
    if (!task) {   
      console.log(`❌ Task ${taskGroup} not found in Firestore`);
      return null;
    }
    
    console.log(`✅ Found task ${taskGroup} in Firestore`);
    
    if (!task) {
      console.log(`❌ Task group ${taskGroup} not found in local storage or Firestore`);
      return { success: false, reason: 'task_not_found' };
    }
    
    // Find subtask by ID (title or legacy numeric ID)
    const subtask = task.subTasks?.find(st => {
      // Compare as strings for title-based IDs
      return st.subTaskID === subtaskId || 
             st.subTaskID == subtaskId ||  // Loose equality for numbers
             st.title === subtaskId;        // Also try matching by title directly
    });
    
    if (!subtask) {
      console.log(`❌ Subtask ${subtaskId} not found in task ${taskGroup}`);
      console.log(`Available subtasks: ${task.subTasks?.map(st => `"${st.subTaskID}"`).join(', ')}`);
      return { success: false, reason: 'subtask_not_found' };
    }
    
    // Check if already completed
    if (subtask.status === 'completed') {
      console.log(`⚠️ Subtask ${taskGroup}_${subtaskId} already completed at ${subtask.completedAt}`);
      return { 
        success: false, 
        reason: 'already_completed',
        completedAt: subtask.completedAt 
      };
    }
    
    // Mark subtask as completed
    subtask.status = 'completed';
    subtask.completedAt = new Date().toISOString();
    
    // Update task in Firestore
    await updateTask(task.firestoreId || task.id, task);
    console.log(`✅ Updated task ${taskGroup} in Firestore`);
    
    console.log(`✅ Marked subtask ${taskGroup}${subtaskId} as completed`);
    return { success: true };
    
  } catch (error) {
    console.error('Error marking subtask as completed:', error);
    return { success: false, reason: 'error', error };
  }
};


// Main Handler Functions
const formatCompletedDate = (isoString) => {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'Unknown date';
  }
};


const handleApproval = async (message) => {
  let taskId = null; // Declare taskId at function scope
  
  try {
    const parentChannelName = message.channel?.parent?.name?.toLowerCase();
    if (!message.channel?.isThread() || 
        !FINISHED_TASK_CHANNELS.includes(parentChannelName) ||
        !PATTERNS.approval.test(message.content)) {
      return false;
    }
    
    // Check if user is admin before allowing approval
    if (!isUserAdmin(message.author.id)) {
      console.log(`❌ NON-ADMIN APPROVAL: ${message.author.username} (${message.author.id}) tried to approve task`);
      const embed = createAdminOnlyEmbed('approve tasks');
      await message.reply({ embeds: [embed] });
      return false;
    }
    
    const starterMessage = await message.channel.fetchStarterMessage();
    if (!starterMessage) return false;
    
    taskId = extractTaskId(starterMessage.content || '');
    if (!taskId) return false;
    
    const parsed = parseTaskId(taskId);
    if (!parsed) {
      console.log(`❌ Could not parse task ID: ${taskId}`);
      await message.reply(`❌ Could not parse task ID: **${taskId}**`);
      return false;
    }
    
    const result = await completeSubtask(parsed.taskGroup, parsed.subtaskId);
    
    if (result.success) {
      await message.react('✅');
      await message.reply(`✅ Subtask **${taskId}** approved and completed!`);
      
      // Task approved successfully - Firestore-only system handles data automatically
      
      return true;
    } else {
      // Handle different failure reasons
      switch (result.reason) {
        case 'already_completed':
          await message.react('⚠️');
          const completedDate = formatCompletedDate(result.completedAt);
          await message.reply(`⚠️ **${taskId}** was already approved and completed on **${completedDate}**\n\n*No action needed - this task is already done!* ✨`);
          break;
          
        case 'task_not_found':
          await message.react('❌');
          await message.reply(`❌ Task group **${parsed.taskGroup}** not found in database.`);
          break;
          
        case 'subtask_not_found':
          await message.react('❌');
          await message.reply(`❌ Subtask **${parsed.subtaskId}** not found in task **${parsed.taskGroup}**.`);
          break;
          
        default:
          await message.react('❌');
          await message.reply(`❌ Failed to approve **${taskId}**. Please try again or contact an admin.`);
      }
      return false;
    }
    
  } catch (error) {
    console.error('Error handling approval:', error);
    await message.reply(`❌ An error occurred while processing approval for **${taskId || 'unknown task'}**.`);
    return false;
  }
};


// Handle finished task submission (not approval)
const handleTaskSubmission = async (message) => {
  try {
    // Check if it's in finished task channel but NOT approval
    if (PATTERNS.approval.test(message.content)) {
      return false; // Let handleApproval handle this
    }
    
    // Extract subtask title from message
    const subtaskTitle = extractSubtaskTitle(message.content);
    if (!subtaskTitle) {
      console.log('❌ No subtask title found in message');
      return false;
    }
    
    console.log(`🔍 Looking for subtask: "${subtaskTitle}"`);
    
    // Find the task containing this subtask
    const result = await findTaskBySubtaskTitle(subtaskTitle);
    if (!result) {
      console.log(`❌ No task found with subtask: "${subtaskTitle}"`);
      await message.reply(`❌ Could not find a task with subtask: **${subtaskTitle}**\n\nMake sure the title matches exactly.`);
      return false;
    }
    
    const { task, subtask, taskGroup } = result;
    
    // Check if already completed
    if (subtask.status === 'completed') {
      const completedDate = formatCompletedDate(subtask.completedAt);
      await message.react('⚠️');
      await message.reply(`⚠️ **${subtaskTitle}** was already completed on **${completedDate}**\n\n*This task is already done!* ✨`);
      return true;
    }
    
    // Mark subtask as completed immediately
    subtask.status = 'completed';
    subtask.completedAt = new Date().toISOString();
    subtask.posted = subtask.posted !== undefined ? subtask.posted : false; // Ensure posted field exists
    
    // Update task in Firestore
    await updateTask(task.firestoreId || task.id, task);
    console.log(`✅ Marked subtask "${subtaskTitle}" as completed`);
    
    // Create a thread for this submission if not already in one
    if (!message.channel.isThread()) {
      const thread = await message.startThread({
        name: `${subtaskTitle} - Completed ✅`,
        autoArchiveDuration: 1440 // 24 hours
      });
      
      await thread.send(`✅ **Task Completed:** ${subtaskTitle}\n👤 **Completed by:** ${message.author}\n📅 **Completed at:** ${new Date().toLocaleString('en-NG')}`);
      console.log(`✅ Created thread for completed subtask: ${subtaskTitle}`);
    } else {
      await message.react('✅');
      await message.reply(`✅ **Task Completed:** ${subtaskTitle}\n\nGreat work! 🎉`);
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Error handling task submission:', error);
    return false;
  }
};


// Handle copyright issue reporting
const handleCopyrightIssue = async (message) => {
  try {
    // Check if message contains @copyright
    if (!PATTERNS.copyright.test(message.content)) {
      return false;
    }
    
    // Check if user is admin
    if (!isUserAdmin(message.author.id)) {
      console.log(`❌ NON-ADMIN COPYRIGHT: ${message.author.username} tried to report copyright`);
      const embed = createAdminOnlyEmbed('report copyright issues');
      await message.reply({ embeds: [embed] });
      return false;
    }
    
    // Get the original message (either referenced or thread starter)
    const originalMessage = await getOriginalMessage(message);
    if (!originalMessage) {
      await message.reply('❌ Could not find the original task message.');
      return false;
    }
    
    // Extract subtask title from original message
    const subtaskTitle = extractSubtaskTitle(originalMessage.content);
    if (!subtaskTitle) {
      console.log('❌ No subtask title found in original message');
      await message.reply('❌ Could not extract task title from the message.');
      return false;
    }
    
    console.log(`⚠️ Copyright issue reported for: "${subtaskTitle}"`);
    
    // Find the task
    const result = await findTaskBySubtaskTitle(subtaskTitle);
    if (!result) {
      console.log(`❌ No task found with subtask: "${subtaskTitle}"`);
      await message.reply(`❌ Could not find task: **${subtaskTitle}**`);
      return false;
    }
    
    const { task, subtask } = result;
    
    // Extract copyright note (text after @copyright)
    const copyrightNote = message.content.replace(PATTERNS.copyright, '').trim();
    
    // Mark task with copyright issue
    subtask.copyrightIssue = true;
    subtask.copyrightNote = copyrightNote || 'Copyright issue detected';
    subtask.copyrightReportedBy = message.author.id;
    subtask.copyrightReportedAt = new Date().toISOString();
    
    // Update in Firestore
    await updateTask(task.firestoreId || task.id, task);
    console.log(`⚠️ Marked "${subtaskTitle}" with copyright issue`);
    
    // Get the user who submitted the task (from task assignedTo)
    const userId = task.assignedTo;
    if (!userId) {
      await message.reply('⚠️ Copyright issue recorded, but could not find user to notify.');
      return true;
    }
    
    // Send DM to user
    try {
      const user = await message.client.users.fetch(userId);
      if (user) {
        const dmEmbed = DiscordUtils.createEmbed({
          color: DiscordUtils.colors.error,
          title: '⚠️ Copyright Issue Detected',
          description: `Your submitted video has a copyright issue and needs to be fixed.`,
          fields: [
            { name: '📋 Task', value: subtaskTitle, inline: false },
            { name: '⚠️ Issue', value: copyrightNote || 'Copyright claim detected', inline: false },
            { name: '🔧 Action Required', value: '1. Fix the copyright issue\n2. Re-upload the video\n3. Submit again', inline: false }
          ],
          footer: 'Please resolve this as soon as possible'
        });
        
        await user.send({ embeds: [dmEmbed] });
        console.log(`📧 Sent copyright notice DM to user ${user.username}`);
        
        // Confirm in channel
        await message.react('✅');
        await message.reply(`✅ Copyright issue recorded for **${subtaskTitle}**.\n\n📧 <@${userId}> has been notified via DM to fix and reupload.`);
      }
    } catch (dmError) {
      console.error('❌ Could not send DM:', dmError);
      await message.reply(`✅ Copyright issue recorded for **${subtaskTitle}**.\n\n⚠️ Could not send DM to <@${userId}>. Please notify them manually.`);
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Error handling copyright issue:', error);
    return false;
  }
};


const handleFinishedTaskMessage = async (message) => {
  // Guard checks
  if (!message.guild || message.author.bot || !isInTargetChannel(message)) {
    return false;
  }
  
  console.log(`🚀 Processing: "${message.content}" from ${message.author.username}`);
  
  // Try copyright check first, then approval, then task submission
  return await handleCopyrightIssue(message) || await handleApproval(message) || await handleTaskSubmission(message);
};

module.exports = {
    handleFinishedTaskMessage,
    extractSubtaskTitle,
    findTaskBySubtaskTitle
};
