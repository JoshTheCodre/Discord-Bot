const { getTaskByTaskId } = require('./storage');
const {
  findTaskBySubtaskTitle: findTaskBySubtaskTitleInFirestore,
  patchSubtaskAtomic,
  patchSubtaskByTitleAtomic,
  normalizeTextKey
} = require('../firebase/firestoreService');
const { ADMIN_IDS } = require('./setupService');
const DiscordUtils = require('../utils/discordUtils');
const { log } = require('./logService');


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
    const normalizedTitle = normalizeTextKey(subtaskTitle);
    if (!normalizedTitle) {
      return null;
    }

    const result = await findTaskBySubtaskTitleInFirestore(normalizedTitle);

    if (result) {
      console.log(`✅ Found subtask in task ${result.task.taskId || result.task.id}`);
      return result;
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
    console.log(`🔍 Looking for task ${taskGroup} in Firestore...`);
    const task = await getTaskByTaskId(taskGroup);

    if (!task) {
      console.log(`❌ Task ${taskGroup} not found in Firestore`);
      return { success: false, reason: 'task_not_found' };
    }

    const existingSubtask = task.subTasks?.find((subtask) => {
      const candidateKey = normalizeTextKey(subtask.titleKey || subtask.title || subtask.subTaskID);
      const targetKey = normalizeTextKey(subtaskId);
      return candidateKey === targetKey || String(subtask.subTaskID) === String(subtaskId);
    });

    if (!existingSubtask) {
      console.log(`❌ Subtask ${subtaskId} not found in task ${taskGroup}`);
      return { success: false, reason: 'subtask_not_found' };
    }

    if (existingSubtask.status === 'completed') {
      console.log(`⚠️ Subtask ${taskGroup}_${subtaskId} already completed at ${existingSubtask.completedAt}`);
      return {
        success: false,
        reason: 'already_completed',
        completedAt: existingSubtask.completedAt
      };
    }

    const updateResult = await patchSubtaskAtomic(task.id || task.taskId, subtaskId, {
      status: 'completed',
      completedAt: new Date().toISOString()
    });

    if (!updateResult.success) {
      return updateResult;
    }

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
      await log('approval', `Subtask ${taskId} approved by ${message.author.username}`, {
        subtaskTitle: taskId, username: message.author.username, userId: message.author.id
      });

      // DM the task owner if we can find them
      try {
        const allTasks = await findTaskBySubtaskTitle(taskId);
        if (allTasks?.task?.assignedTo) {
          const owner = await message.client.users.fetch(allTasks.task.assignedTo);
          await owner.send(`Good news — your submission for **${taskId}** has been approved and marked as complete. Nice work!`);
          await log('dm_sent', `Approval DM sent to ${owner.username} for ${taskId}`, {
            subtaskTitle: taskId, userId: allTasks.task.assignedTo, username: owner.username
          });
        }
      } catch (_) {}

      return true;
    } else {
      switch (result.reason) {
        case 'already_completed': {
          await message.react('⚠️');
          const completedDate = formatCompletedDate(result.completedAt);
          await log('error', `Approval attempted on already-completed subtask ${taskId} (completed ${completedDate})`, { subtaskTitle: taskId });
          break;
        }
        case 'task_not_found':
          await message.react('❌');
          await log('error', `Approval failed — task group ${parsed.taskGroup} not found`, { subtaskTitle: taskId });
          break;
        case 'subtask_not_found':
          await message.react('❌');
          await log('error', `Approval failed — subtask ${parsed.subtaskId} not found in ${parsed.taskGroup}`, { subtaskTitle: taskId });
          break;
        default:
          await message.react('❌');
          await log('error', `Approval failed for ${taskId}: unknown reason`, { subtaskTitle: taskId });
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
      await log('error', `"${subtaskTitle}" was already marked complete (${completedDate})`, {
        subtaskTitle, userId: message.author.id, username: message.author.username
      });
      // DM the submitter privately so the channel stays clean
      try {
        await message.author.send(`Just so you know — "${subtaskTitle}" was already marked as complete on ${completedDate}. No action needed on your end.`);
      } catch (_) {}
      return true;
    }
    
    // Mark subtask as completed immediately (atomic update)
    const updateResult = await patchSubtaskByTitleAtomic(subtaskTitle, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      posted: subtask.posted !== undefined ? subtask.posted : false
    });

    if (!updateResult.success) {
      console.log(`Failed to update subtask "${subtaskTitle}": ${updateResult.reason}`);
      await message.react('❌');
      try {
        await message.author.send(`There was a problem recording your submission for "${subtaskTitle}". Please try again, or let an admin know if it keeps happening.`);
      } catch (_) {}
      return false;
    }

    console.log(`Marked subtask "${subtaskTitle}" as completed`);

    // React only — no public reply, no thread
    await message.react('✅');

    await log('subtask_submitted', `"${subtaskTitle}" submitted by ${message.author.username}`, {
      subtaskTitle, userId: message.author.id, username: message.author.username
    });

    // Confirm via DM so the submitter knows it was received
    try {
      await message.author.send(`Your submission for "${subtaskTitle}" has been received and is pending admin review. You'll hear back once it's approved.`);
      await log('dm_sent', `Submission confirmation DM sent to ${message.author.username}`, {
        subtaskTitle, userId: message.author.id, username: message.author.username
      });
    } catch (_) {}

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
    
    if (!isUserAdmin(message.author.id)) {
      console.log(`Non-admin copyright attempt: ${message.author.username}`);
      try { await message.author.send('Only admins can flag copyright issues. If you spotted a problem, please let an admin know.'); } catch (_) {}
      return false;
    }

    const originalMessage = await getOriginalMessage(message);
    if (!originalMessage) {
      try { await message.author.send('Couldn\'t find the original task message to flag. Make sure you\'re replying to or in the right thread.'); } catch (_) {}
      return false;
    }

    const subtaskTitle = extractSubtaskTitle(originalMessage.content);
    if (!subtaskTitle) {
      console.log('No subtask title found in original message');
      try { await message.author.send('Couldn\'t extract the task title from that message. Check the format and try again.'); } catch (_) {}
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
    
    // Mark task with copyright issue (atomic update)
    const issueTimestamp = new Date().toISOString();
    const patchResult = await patchSubtaskByTitleAtomic(subtaskTitle, {
      copyrightIssue: true,
      copyrightNote: copyrightNote || 'Copyright issue detected',
      copyrightReportedBy: message.author.id,
      copyrightReportedAt: issueTimestamp
    });

    if (!patchResult.success) {
      await message.reply(`❌ Could not update copyright status for **${subtaskTitle}**.`);
      return false;
    }

    console.log(`⚠️ Marked "${subtaskTitle}" with copyright issue`);
    
    await log('copyright_flagged', `Copyright flagged on "${subtaskTitle}" by ${message.author.username}${copyrightNote ? ': ' + copyrightNote : ''}`, {
      subtaskTitle, userId: task.assignedTo, username: message.author.username
    });

    // React in channel — no public reply
    await message.react('⚠️');

    const userId = task.assignedTo;
    if (!userId) return true;

    try {
      const user = await message.client.users.fetch(userId);
      if (user) {
        let dm = `Hi ${user.username}, there's a copyright issue with your submission for "${subtaskTitle}".`;
        if (copyrightNote) dm += `\n\nNote from the team: "${copyrightNote}"`;
        dm += `\n\nPlease review this, make the necessary changes, and resubmit. If you have questions, reach out to an admin.`;
        await user.send(dm);
        await log('dm_sent', `Copyright DM sent to ${user.username} for "${subtaskTitle}"`, {
          subtaskTitle, userId, username: user.username
        });
      }
    } catch (dmError) {
      console.error('Could not send copyright DM:', dmError);
      await log('dm_failed', `Could not DM user ${userId} about copyright on "${subtaskTitle}"`, {
        subtaskTitle, userId
      });
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
