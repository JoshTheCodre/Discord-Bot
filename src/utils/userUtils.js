/**
 * Utility functions for Discord user operations and task management
 */

const { readData } = require('../services/storage');


function generateTaskId(existingTasks) {
    const existingIds = new Set(existingTasks.map(task => task.taskId));
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(l => l !== 'T');
    
    let attempts = 0;
    const maxAttempts = 1000;
    
    while (attempts < maxAttempts) {
        // Pick two different letters
        const firstLetter = letters[Math.floor(Math.random() * letters.length)];
        let secondLetter;
        do {
            secondLetter = letters[Math.floor(Math.random() * letters.length)];
        } while (secondLetter === firstLetter);
        
        const taskId = `T${firstLetter}${secondLetter}`;
        
        if (!existingIds.has(taskId)) {
            return taskId;
        }
        
        attempts++;
    }
    
    throw new Error('Unable to generate unique task ID after maximum attempts');
}

async function resolveUserId(guild, mention) {
    // If it's already a user ID (from <@123456789>), return it
    if (/^\d+$/.test(mention)) {
        return mention;
    }
    
    // If it's a username (from @username), try to find the user
    if (mention.startsWith('@')) {
        const username = mention.slice(1);
        try {
            const members = await guild.members.fetch();
            const member = members.find(m => 
                m.user.username.toLowerCase() === username.toLowerCase() ||
                m.displayName.toLowerCase() === username.toLowerCase()
            );
            return member ? member.user.id : mention; // Fallback to raw mention if not found
        } catch (error) {
            console.error('Error resolving username:', error);
            return mention; // Fallback to raw mention
        }
    }
    
    return mention; // Return as-is if format is unexpected
}


async function getUserDisplayName(guild, userId) {
    try {
        if (/^\d+$/.test(userId)) {
            const member = await guild.members.fetch(userId);
            return member.displayName || member.user.username;
        }
    } catch (error) {
        console.error('Error getting user display name:', error);
    }
    
    // Fallback to raw mention if user ID resolution fails
    return userId.startsWith('@') ? userId : `<@${userId}>`;
}

async function ensureUser(userId, guild, readData, writeData) {
    // Read fresh data each time
    let data = readData();
    
    // Ensure users array exists
    if (!Array.isArray(data.users)) {
        data.users = [];
    }
    
    // Check if user already exists
    const existing = data.users.find(u => u.id === userId);
    if (existing) {
        console.log(`User already exists: ${existing.name} (${userId})`);
        return existing;
    }
    
    // Fetch user's display name from Discord
    let displayName = userId; // Fallback to ID
    try {
        if (/^\d+$/.test(userId)) {
            const member = await guild.members.fetch(userId);
            displayName = member.displayName || member.user.username || member.user.globalName || userId;
            console.log(`Fetched Discord name: ${displayName} for ${userId}`);
        }
    } catch (error) {
        console.error(`Error fetching display name for user ${userId}:`, error.message);
    }
    
    // Create new user
    const newUser = { 
        id: userId, 
        name: displayName,
        dateJoined: new Date().toISOString(), 
        role: "user" 
    };
    
    // Add to users array and save
    data.users.push(newUser);
    writeData(data);
    
    console.log(`✅ Created new user: ${displayName} (${userId})`);
    return newUser;
}

/**
 * Check if a user is registered (has completed /setup)
 * @param {string} userId - Discord user ID
 * @returns {boolean} - True if user is registered with birthday
 */
function isUserRegistered(userId) {
    try {
        const data = readData();
        const user = data.users?.find(u => u.id === userId);
        // User is considered registered if they have a birthday (completed /setup)
        return user && user.birthday;
    } catch (error) {
        console.error('Error checking user registration:', error);
        return false;
    }
}

/**
 * Get registered user info
 * @param {string} userId - Discord user ID
 * @returns {object|null} - User object if registered, null otherwise
 */
function getRegisteredUser(userId) {
    try {
        const data = readData();
        const user = data.users?.find(u => u.id === userId);
        // Only return user if they're registered (have birthday)
        return (user && user.birthday) ? user : null;
    } catch (error) {
        console.error('Error getting registered user:', error);
        return null;
    }
}

/**
 * Check if user is registered and return appropriate response
 * @param {string} userId - Discord user ID
 * @param {string} action - Action being attempted (e.g., "task assignment")
 * @returns {object} - {isRegistered: boolean, user: object|null, message: string}
 */
function validateUserRegistration(userId, action = 'this action') {
    const user = getRegisteredUser(userId);
    
    if (user) {
        return {
            isRegistered: true,
            user: user,
            message: `✅ User ${user.name} is registered`
        };
    } else {
        return {
            isRegistered: false,
            user: null,
            message: `❌ User must complete /setup before ${action}. Please run \`/setup\` first to register your profile with name and birthday.`
        };
    }
}

/**
 * Get user mention string for error messages
 * @param {string} userId - Discord user ID
 * @returns {string} - Formatted user mention
 */
function getUserMention(userId) {
    return `<@${userId}>`;
}

/**
 * Validate multiple users for registration
 * @param {string[]} userIds - Array of Discord user IDs
 * @param {string} action - Action being attempted
 * @returns {object} - {allRegistered: boolean, registeredUsers: object[], unregisteredUsers: string[], messages: string[]}
 */
function validateMultipleUsers(userIds, action = 'this action') {
    const results = userIds.map(userId => ({
        userId,
        ...validateUserRegistration(userId, action)
    }));
    
    const registeredUsers = results.filter(r => r.isRegistered).map(r => r.user);
    const unregisteredUsers = results.filter(r => !r.isRegistered).map(r => r.userId);
    const messages = results.map(r => r.message);
    
    return {
        allRegistered: unregisteredUsers.length === 0,
        registeredUsers,
        unregisteredUsers,
        messages
    };
}

module.exports = {
    generateTaskId,
    resolveUserId,
    getUserDisplayName,
    ensureUser,
    isUserRegistered,
    getRegisteredUser,
    validateUserRegistration,
    getUserMention,
    validateMultipleUsers
};
