/**
 * Finished Task Service
 * Handles task completion forwarding and approvals in #finished-tasks channel
 */

const { EmbedBuilder } = require('discord.js');
const { addTaskToChannel } = require('./channelService');
const { readData, writeData } = require('./storage');
const { validateUserRegistration, getUserMention } = require('../utils/userUtils');
const { getUserRole, ADMIN_IDS } = require('./setupService');

// Constants
const CHANNEL_NAME = 'finished-tasks';
const PATTERNS = {
  taskId: /\b[A-Za-z]{2,10}\d{1,6}\b/,
  forwarding: /(for|->)\s+(.+)/i,
  approval: /@approved/i,
  channelName: /(?:for|->)\s+@?([A-Za-z0-9\-]+)\b/i,
  taskIdSplit: /^([A-Za-z]+)(\d+)$/
}; 

// Helper Functions
const buildCompletionEmbed = ({ taskId, sender, receiver, taskUrl }) => 
  new EmbedBuilder()
    .setColor('#4CAF50')
    .setTitle(`🧩 Task: ${taskId} Complete`)
    .setDescription(`${sender || '*Unknown*'} has finished this task`)
    .addFields(
      { name: '📋 Next Steps', value: `Ready for ${receiver || '*Unassigned*'}`, inline: false },
      { name: '🔗 Original Task', value: `**[Click here to view task](${taskUrl || 'https://discord.com'})**`, inline: false }
    )
    .setFooter({ text: 'Task completion notification' })
    .setTimestamp();

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

const findTargetChannel = async (message) => {
  const [user] = Array.from(message.mentions.users.values());
  const [channel] = Array.from(message.mentions.channels.values());
  
  let targetChannel = channel;
  
  if (!targetChannel) {
    const channelName = message.content.match(PATTERNS.channelName)?.[1];
    if (channelName) {
      targetChannel = message.guild.channels.cache.find(
        c => c.isTextBased() && c.name.toLowerCase() === channelName.toLowerCase()
      );
      
      if (!targetChannel) {
        try {
          const allChannels = await message.guild.channels.fetch();
          targetChannel = Array.from(allChannels.values()).find(
            c => c?.isTextBased?.() && c.name.toLowerCase() === channelName.toLowerCase()
          );
        } catch (error) {
          console.error('❌ Error fetching channels:', error);
        }
      }
    }
  }
  
  return { receiverMention: user?.toString() || null, targetChannel };
};

const isInTargetChannel = (message) => {
  const channel = message.channel;
  const channelName = CHANNEL_NAME.toLowerCase();
  const isDirectMatch = channel?.name?.toLowerCase() === channelName;
  const isThreadInTarget = channel?.isThread() && channel.parent?.name?.toLowerCase() === channelName;
  return isDirectMatch || isThreadInTarget;
};

const isUserAdmin = (userId) => {
  return ADMIN_IDS.includes(userId);
};

const createAdminOnlyEmbed = (action) => {
  return new EmbedBuilder()
    .setColor('#FF4444')
    .setTitle('🔒 Admin Only Action')
    .setDescription(`Only administrators can ${action}.`)
    .addFields(
      { name: '👑 Required Permission', value: 'Admin role required', inline: false },
      { name: '💡 Need Help?', value: 'Contact an administrator if you believe this is an error', inline: false }
    )
    .setFooter({ text: 'Access restricted to admins' })
    .setTimestamp();
};

// Task Management Functions
const parseTaskId = (taskId) => {
  const match = taskId.match(PATTERNS.taskIdSplit);
  return match ? { taskGroup: match[1], subtaskId: parseInt(match[2]) } : null;
};

const completeSubtask = (taskGroup, subtaskId) => {
  try {
    const data = readData();
    const task = data.tasks?.find(t => t.taskId === taskGroup);
    
    if (!task) {
      console.log(`❌ Task group ${taskGroup} not found`);
      return { success: false, reason: 'task_not_found' };
    }
    
    const subtask = task.subTasks?.find(st => st.subTaskID === subtaskId);
    if (!subtask) {
      console.log(`❌ Subtask ${subtaskId} not found in task ${taskGroup}`);
      return { success: false, reason: 'subtask_not_found' };
    }
    
    // Check if already completed
    if (subtask.status === 'completed') {
      console.log(`⚠️ Subtask ${taskGroup}${subtaskId} already completed at ${subtask.completedAt}`);
      return { 
        success: false, 
        reason: 'already_completed',
        completedAt: subtask.completedAt 
      };
    }
    
    subtask.status = 'completed';
    subtask.completedAt = new Date().toISOString();
    
    writeData(data);
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
  try {
    if (!message.channel?.isThread() || 
        !message.channel.parent?.name?.toLowerCase() === CHANNEL_NAME.toLowerCase() ||
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
    
    const taskId = extractTaskId(starterMessage.content || '');
    if (!taskId) return false;
    
    const parsed = parseTaskId(taskId);
    if (!parsed) {
      console.log(`❌ Could not parse task ID: ${taskId}`);
      await message.reply(`❌ Could not parse task ID: **${taskId}**`);
      return false;
    }
    
    const result = completeSubtask(parsed.taskGroup, parsed.subtaskId);
    
    if (result.success) {
      await message.react('✅');
      await message.reply(`✅ Subtask **${taskId}** approved and completed!`);
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

const checkForDuplicates = (taskId, targetChannelName) => {
  const { getChannelTasks } = require('./channelService');
  const data = readData();
  const allChannels = data.channels || {};
  
  // Check target channel
  const existingTasks = getChannelTasks(targetChannelName);
  const sameChannelDuplicate = existingTasks.find(task => task.taskId === taskId);
  
  // Check other channels
  let crossChannelDuplicate = null;
  for (const [channelName, tasks] of Object.entries(allChannels)) {
    if (channelName !== targetChannelName) {
      const taskInOtherChannel = tasks.find(task => task.taskId === taskId);
      if (taskInOtherChannel) {
        crossChannelDuplicate = { channelName, task: taskInOtherChannel };
        break;
      }
    }
  }
  
  return { sameChannelDuplicate, crossChannelDuplicate };
};

const createDuplicateAlert = (type, taskId, duplicate, targetChannel, author) => {
  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  
  if (type === 'same') {
    return new EmbedBuilder()
      .setColor('#FF6B6B')
      .setTitle('⚠️ Duplicate Forwarding Detected!')
      .setDescription(`Task **${taskId}** has already been forwarded to this channel.`)
      .addFields(
        { name: '📅 Originally Forwarded', value: formatDate(duplicate.forwardedAt), inline: true },
        { name: '👤 Original Forwarder', value: `<@${duplicate.forwardedBy}>`, inline: true },
        { name: '🚨 Current Attempt', value: `${author} tried to forward this task again`, inline: false }
      )
      .setFooter({ text: 'Duplicate prevention system' })
      .setTimestamp();
  } else {
    return new EmbedBuilder()
      .setColor('#FF9500')
      .setTitle('🔄 Cross-Channel Forwarding Alert!')
      .setDescription(`Task **${taskId}** has already been forwarded to a different channel.`)
      .addFields(
        { name: '📍 Already In Channel', value: `#${duplicate.channelName}`, inline: true },
        { name: '📅 Forwarded On', value: formatDate(duplicate.task.forwardedAt), inline: true },
        { name: '👤 Forwarded By', value: `<@${duplicate.task.forwardedBy}>`, inline: true },
        { name: '🎯 Current Attempt', value: `${author} tried to forward to #${targetChannel.name}`, inline: false }
      )
      .setFooter({ text: 'Cross-channel duplicate prevention' })
      .setTimestamp();
  }
};

const isTaskApproved = (taskId) => {
  try {
    const data = readData();
    const parsed = parseTaskId(taskId);
    if (!parsed) return false;
    
    const task = data.tasks?.find(t => t.taskId === parsed.taskGroup);
    if (!task) return false;
    
    const subtask = task.subTasks?.find(st => st.subTaskID === parsed.subtaskId);
    return subtask?.status === 'completed';
  } catch (error) {
    console.error('Error checking task approval:', error);
    return false;
  }
};

const handleForwarding = async (message) => {
  try {
    // Validate forwarding pattern and message type
    if (!PATTERNS.forwarding.test(message.content)) return false;
    if (!message.reference?.messageId && !message.channel?.isThread()) return false;
    
    // Check if user is admin before allowing forwarding
    if (!isUserAdmin(message.author.id)) {
      console.log(`❌ NON-ADMIN FORWARDING: ${message.author.username} (${message.author.id}) tried to forward task`);
      const embed = createAdminOnlyEmbed('forward tasks');
      await message.reply({ embeds: [embed] });
      return false;
    }
    
    // Find target channel and original message
    const { receiverMention, targetChannel } = await findTargetChannel(message);
    if (!targetChannel) return false;
    
    const originalMessage = await getOriginalMessage(message);
    if (!originalMessage) return false;
    
    const taskId = extractTaskId(originalMessage.content || '');
    if (!taskId) return false;
    
    console.log(`🔍 Checking task ${taskId} for forwarding to #${targetChannel.name}`);
    
    // Check if task is approved BEFORE forwarding
    if (!isTaskApproved(taskId)) {
      console.log(`❌ UNAPPROVED: Task ${taskId} is not approved for forwarding`);
      const embed = new EmbedBuilder()
        .setColor('#FF4444')
        .setTitle('🚫 Task Not Approved')
        .setDescription(`Task **${taskId}** must be approved before it can be forwarded.`)
        .addFields(
          { name: '📋 Required Action', value: 'The task needs to be approved with `@approved` first', inline: false },
          { name: '⚡ Next Steps', value: 'Ask an admin to approve the task before forwarding', inline: false }
        )
        .setFooter({ text: 'Approval required for forwarding' })
        .setTimestamp();
      
      await message.reply({ embeds: [embed] });
      return false;
    }
    
    // Check for duplicates BEFORE sending any messages
    const { sameChannelDuplicate, crossChannelDuplicate } = checkForDuplicates(taskId, targetChannel.name);
    
    if (sameChannelDuplicate) {
      console.log(`⚠️ DUPLICATE: Task ${taskId} already in #${targetChannel.name}`);
      const alert = createDuplicateAlert('same', taskId, sameChannelDuplicate, targetChannel, message.author);
      await message.reply({ embeds: [alert] });
      return false;
    }
    
    if (crossChannelDuplicate) {
      console.log(`⚠️ CROSS-CHANNEL: Task ${taskId} already in #${crossChannelDuplicate.channelName}`);
      const alert = createDuplicateAlert('cross', taskId, crossChannelDuplicate, targetChannel, message.author);
      await message.reply({ embeds: [alert] });
      
      // Notify original channel
      const originalChannel = message.guild.channels.cache.find(c => c.name === crossChannelDuplicate.channelName);
      if (originalChannel) {
        await originalChannel.send(
          `🔄 **Alert**: Task **${taskId}** attempted duplicate forwarding to #${targetChannel.name}`
        );
      }
      return false;
    }
    
    // No duplicates found - proceed with forwarding approved task
    console.log(`✅ APPROVED: Task ${taskId} is approved and will be forwarded`);
    const embed = buildCompletionEmbed({
      taskId,
      sender: message.author.toString(),
      receiver: receiverMention,
      taskUrl: originalMessage.url
    });
    
    const attachments = Array.from(originalMessage.attachments?.values?.() || []).map(att => ({
      attachment: att.url, name: att.name
    }));
    
    await targetChannel.send({ embeds: [embed], files: attachments, allowedMentions: { parse: ['users'] } });
    
    // Check receiver registration
    const receiverUserId = message.mentions.users.first()?.id;
    if (receiverUserId && !validateUserRegistration(receiverUserId, 'task forwarding').isRegistered) {
      await targetChannel.send(
        `⚠️ **Note**: ${getUserMention(receiverUserId)} needs to run \`/setup\` before being assigned tasks.`
      );
    }
    
    // Store in database
    addTaskToChannel(targetChannel.name, targetChannel.id, taskId, message.author.id, receiverUserId);
    console.log(`✅ Forwarded task ${taskId} to #${targetChannel.name}`);
    return true;
    
  } catch (error) {
    console.error('❌ Forwarding error:', error);
    return false;
  }
};

const handleFinishedTaskMessage = async (message) => {
  // Guard checks
  if (!message.guild || message.author.bot || !isInTargetChannel(message)) {
    return false;
  }
  
  console.log(`🚀 Processing: "${message.content}" from ${message.author.username}`);
  
  // Try approval first, then forwarding
  return await handleApproval(message) || await handleForwarding(message);
};

module.exports = {
    handleFinishedTaskMessage
};
