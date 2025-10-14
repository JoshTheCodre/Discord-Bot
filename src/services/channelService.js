const { readData, writeData } = require('./storage');

async function addTaskToChannel(channelName, channelId, taskId, forwardedBy, forwardedTo) {
  try {
    const data = await readData();
    data.channels = data.channels || {};
    data.channels[channelName] = data.channels[channelName] || [];
    
    const forwardedTask = {
      taskId,
      channelId,
      forwardedBy,
      forwardedTo,
      forwardedAt: new Date().toISOString(),
      status: 'forwarded'
    };
    
    const existingIndex = data.channels[channelName].findIndex(task => task.taskId === taskId);
    const action = existingIndex >= 0 ? 'Updated' : 'Added';
    
    if (existingIndex >= 0) {
      data.channels[channelName][existingIndex] = forwardedTask;
    } else {
      data.channels[channelName].push(forwardedTask);
    }
    
    await writeData(data);
    console.log(`📝 ${action} task ${taskId} in channel ${channelName}`);
    return true;
  } catch (error) {
    console.error('Error adding task to channel:', error);
    return false;
  }
}


async function getChannelTasks(channelName) {
  try {
    const data = await readData();
    return data.channels?.[channelName] || [];
  } catch (error) {
    console.error('Error getting channel tasks:', error);
    return [];
  }
}


async function getChannelSummary() {
  try {
    const data = await readData();
    const channels = data.channels || {};
    return Object.keys(channels).reduce((summary, channelName) => {
      summary[channelName] = channels[channelName].length;
      return summary;
    }, {});
  } catch (error) {
    console.error('Error getting channel summary:', error);
    return {};
  }
}


async function markTaskCompleted(channelName, taskId) {
  try {
    const data = await readData();
    const channelTasks = data.channels?.[channelName];
    
    if (!channelTasks) return false;
    
    const taskIndex = channelTasks.findIndex(task => task.taskId === taskId);
    if (taskIndex < 0) return false;
    
    channelTasks[taskIndex].status = 'completed';
    channelTasks[taskIndex].completedAt = new Date().toISOString();
    
    await writeData(data);
    console.log(`✅ Marked task ${taskId} as completed in channel ${channelName}`);
    return true;
  } catch (error) {
    console.error('Error marking task as completed:', error);
    return false;
  }
}

module.exports = {
  addTaskToChannel,
  getChannelTasks,
  getChannelSummary,
  markTaskCompleted
};
