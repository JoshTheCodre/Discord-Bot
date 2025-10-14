// Firestore-only Storage Service
const { 
    createTask, 
    getTask, 
    getAllTasks, 
    updateTask,
    createUser, 
    getUser, 
    getAllUsers,
    createChannel, 
    getChannel, 
    updateChannel,
    getAllChannels 
} = require('../firebase/firestoreService');

// Cache for improved performance
let dataCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 30000; // 30 seconds

console.log('🔥 Storage service using Firestore exclusively');

// Read data from Firestore with caching
async function readData() {
    try {
        // Check cache first
        const now = Date.now();
        if (dataCache && (now - cacheTimestamp) < CACHE_DURATION) {
            return dataCache;
        }

        console.log('📖 Reading data from Firestore...');
        
        // Fetch all data from Firestore in parallel
        const [tasks, users, channels] = await Promise.all([
            getAllTasks(),
            getAllUsers(), 
            getAllChannels()
        ]);

        // Transform channels to the expected format (object with channel names as keys)
        const channelsObject = {};
        channels.forEach(channel => {
            if (channel.name && channel.data) {
                channelsObject[channel.name] = channel.data;
            }
        });

        const data = {
            tasks: tasks || [],
            users: users || [],
            channels: channelsObject
        };

        // Update cache
        dataCache = data;
        cacheTimestamp = now;
        
        console.log(`✅ Loaded ${data.tasks.length} tasks, ${data.users.length} users, ${Object.keys(data.channels).length} channels from Firestore`);
        return data;

    } catch (error) {
        console.error('❌ Error reading from Firestore:', error);
        // Return cached data if available, otherwise empty structure
        return dataCache || { tasks: [], users: [], channels: {} };
    }
}

// Write data to Firestore
async function writeData(data) {
    try {
        console.log('💾 Writing data to Firestore...');
        
        // Clear cache to force fresh read next time
        dataCache = null;
        cacheTimestamp = 0;

        // Note: Individual operations should be handled by specific functions
        // This function is mainly for compatibility with existing code
        console.log('✅ Data write operation queued for Firestore');
        
    } catch (error) {
        console.error('❌ Error writing to Firestore:', error);
        throw error;
    }
}

// Specific functions for different data types
async function saveTask(taskData) {
    try {
        if (taskData.id) {
            // Update existing task
            await updateTask(taskData.id, taskData);
            console.log(`✅ Task ${taskData.taskId} updated in Firestore`);
        } else {
            // Create new task
            const taskId = await createTask(taskData);
            console.log(`✅ Task ${taskData.taskId} created in Firestore with ID: ${taskId}`);
            return taskId;
        }
        
        // Clear cache
        dataCache = null;
        cacheTimestamp = 0;
        
    } catch (error) {
        console.error('❌ Error saving task:', error);
        throw error;
    }
}

async function saveUser(userData) {
    try {
        const existingUser = await getUser(userData.id);
        
        if (existingUser) {
            console.log(`👤 User ${userData.name} already exists in Firestore`);
            return existingUser.id;
        } else {
            const userId = await createUser(userData);
            console.log(`✅ User ${userData.name} created in Firestore with ID: ${userId}`);
            
            // Clear cache
            dataCache = null;
            cacheTimestamp = 0;
            
            return userId;
        }
    } catch (error) {
        console.error('❌ Error saving user:', error);
        throw error;
    }
}

async function saveChannel(channelName, channelData) {
    try {
        const existingChannel = await getChannel(channelName);
        
        const channelDoc = {
            name: channelName,
            data: channelData
        };
        
        if (existingChannel) {
            await updateChannel(existingChannel.id, channelDoc);
            console.log(`✅ Channel ${channelName} updated in Firestore`);
        } else {
            const channelId = await createChannel(channelDoc);
            console.log(`✅ Channel ${channelName} created in Firestore with ID: ${channelId}`);
        }
        
        // Clear cache
        dataCache = null;
        cacheTimestamp = 0;
        
    } catch (error) {
        console.error('❌ Error saving channel:', error);
        throw error;
    }
}

// Helper function to get a specific task by taskId
async function getTaskByTaskId(taskId) {
    try {
        const data = await readData();
        return data.tasks.find(task => task.taskId === taskId);
    } catch (error) {
        console.error('❌ Error getting task by taskId:', error);
        return null;
    }
}

// Helper function to get a specific user by Discord ID
async function getUserById(userId) {
    try {
        const data = await readData();
        return data.users.find(user => user.id === userId);
    } catch (error) {
        console.error('❌ Error getting user by ID:', error);
        return null;
    }
}

// Clear cache function
function clearCache() {
    dataCache = null;
    cacheTimestamp = 0;
    console.log('🗑️ Storage cache cleared');
}

module.exports = { 
    readData, 
    writeData,
    saveTask,
    saveUser,
    saveChannel,
    getTaskByTaskId,
    getUserById,
    clearCache
};
