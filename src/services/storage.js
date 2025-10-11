const fs = require('fs');
const path = require('path');

// Import Firestore service functions
let createTask, getTask, createUser, getUser, createChannel, getChannel, updateChannel;
try {
    const firestoreService = require('../firebase/firestoreService');
    ({ createTask, getTask, createUser, getUser, createChannel, getChannel, updateChannel } = firestoreService);
    console.log('🔥 Firebase/Firestore integration enabled');
} catch (error) {
    console.log('⚠️ Firestore service not available, using JSON storage');
    createTask = getTask = createUser = getUser = createChannel = getChannel = updateChannel = null;
}

const STORAGE_FILE = path.join(__dirname, '../../data/storage.json');

// Cache for improved performance
let dataCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 30000; // 30 seconds

function readData() {
    try {
        // Check cache first
        const now = Date.now();
        if (dataCache && (now - cacheTimestamp) < CACHE_DURATION) {
            return dataCache;
        }

        if (!fs.existsSync(STORAGE_FILE)) {
            const initialData = { tasks: [], users: [], channels: {} };
            fs.writeFileSync(STORAGE_FILE, JSON.stringify(initialData, null, 2));
            dataCache = initialData;
            cacheTimestamp = now;
            return initialData;
        }
        
        const data = JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf8'));
        dataCache = data;
        cacheTimestamp = now;
        return data;
    } catch (error) {
        console.error('❌ Error reading storage:', error);
        return { tasks: [], users: [], channels: {} };
    }
}

function writeData(data) {
    try {
        // Write to JSON file immediately
        fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));
        
        // Update cache
        dataCache = {...data};
        cacheTimestamp = Date.now();
        
        // Also write to Firestore if available (async, non-blocking)
        if (createTask && createUser && createChannel) {
            writeToFirestore(data).catch(error => {
                console.error('⚠️ Error writing to Firestore (continuing with JSON):', error.message);
            });
        }
        
    } catch (error) {
        console.error('❌ Error writing storage:', error);
        throw error;
    }
}

// Async function to write to Firestore in background
async function writeToFirestore(data) {
    try {
        // Handle new tasks - only create if they don't exist in Firestore
        if (data.tasks && Array.isArray(data.tasks)) {
            for (const task of data.tasks) {
                if (task.taskId && task.createdAt) {
                    // Check if this is a new task (created recently)
                    const taskCreatedAt = new Date(task.createdAt);
                    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
                    
                    if (taskCreatedAt > fiveMinutesAgo) {
                        // This is a recent task, check if it exists in Firestore
                        try {
                            const existingTask = await getTask(task.taskId);
                            if (!existingTask) {
                                console.log(`🔥 Creating new task in Firestore: ${task.taskId}`);
                                await createTask(task);
                            }
                        } catch (error) {
                            // Task doesn't exist, create it
                            console.log(`🔥 Creating new task in Firestore: ${task.taskId}`);
                            await createTask(task);
                        }
                    }
                }
            }
        }

        // Handle users (for new registrations)
        if (data.users && Array.isArray(data.users)) {
            for (const user of data.users) {
                if (user.id && user.dateJoined) {
                    const userJoinedAt = new Date(user.dateJoined);
                    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
                    
                    if (userJoinedAt > oneHourAgo) {
                        try {
                            const existingUser = await getUser(user.id);
                            if (!existingUser) {
                                console.log(`🔥 Creating new user in Firestore: ${user.name}`);
                                await createUser(user);
                            }
                        } catch (error) {
                            console.log(`🔥 Creating new user in Firestore: ${user.name}`);
                            await createUser(user);
                        }
                    }
                }
            }
        }

        // Handle channels (for new channel data)
        if (data.channels && typeof data.channels === 'object') {
            for (const [channelName, channelData] of Object.entries(data.channels)) {
                if (channelData && Array.isArray(channelData) && channelData.length > 0) {
                    // Check for recent channel activity
                    const recentActivity = channelData.some(item => {
                        if (item.forwardedAt) {
                            const forwardedAt = new Date(item.forwardedAt);
                            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
                            return forwardedAt > tenMinutesAgo;
                        }
                        return false;
                    });
                    
                    if (recentActivity) {
                        try {
                            const existingChannel = await getChannel(channelName);
                            if (!existingChannel) {
                                console.log(`🔥 Creating new channel in Firestore: ${channelName}`);
                                await createChannel({
                                    name: channelName,
                                    data: channelData
                                });
                            } else {
                                console.log(`🔥 Updating channel in Firestore: ${channelName}`);
                                await updateChannel(channelName, {
                                    name: channelName,
                                    data: channelData
                                });
                            }
                        } catch (error) {
                            console.log(`🔥 Creating new channel in Firestore: ${channelName}`);
                            await createChannel({
                                name: channelName,
                                data: channelData
                            });
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error('❌ Error in writeToFirestore:', error);
        // Don't throw - this is a background operation
    }
}

// Helper function to manually trigger Firestore sync
async function syncToFirestore() {
    if (!createTask || !createUser || !createChannel) {
        console.log('⚠️ Firestore service not available');
        return false;
    }
    
    try {
        const data = readData();
        await writeToFirestore(data);
        console.log('✅ Manual Firestore sync completed');
        return true;
    } catch (error) {
        console.error('❌ Manual Firestore sync failed:', error);
        return false;
    }
}

module.exports = { 
    readData, 
    writeData, 
    syncToFirestore
};
