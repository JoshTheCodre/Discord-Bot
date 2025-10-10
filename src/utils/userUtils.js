const { readData } = require('../services/storage');

function generateTaskId(existingTasks) {
    const existingIds = new Set(existingTasks.map(task => task.taskId));
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.replace('T', '').split('');
    
    for (let attempts = 0; attempts < 1000; attempts++) {
        const firstLetter = letters[Math.floor(Math.random() * letters.length)];
        let secondLetter;
        do {
            secondLetter = letters[Math.floor(Math.random() * letters.length)];
        } while (secondLetter === firstLetter);
        
        const taskId = `T${firstLetter}${secondLetter}`;
        if (!existingIds.has(taskId)) return taskId;
    }
    
    throw new Error('Unable to generate unique task ID');
}


async function resolveUserId(guild, mention) {
    if (/^\d+$/.test(mention)) return mention;
    
    if (mention.startsWith('@')) {
        const username = mention.slice(1);
        try {
            const members = await guild.members.fetch();
            const member = members.find(m => 
                m.user.username.toLowerCase() === username.toLowerCase() ||
                m.displayName.toLowerCase() === username.toLowerCase()
            );
            return member ? member.user.id : mention;
        } catch (error) {
            console.error('Error resolving username:', error);
            return mention;
        }
    }
    
    return mention;
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
    return userId.startsWith('@') ? userId : `<@${userId}>`;
}


async function ensureUser(userId, guild, readData, writeData) {
    let data = readData();
    if (!Array.isArray(data.users)) data.users = [];
    
    const existing = data.users.find(u => u.id === userId);
    if (existing) {
        console.log(`User exists: ${existing.name} (${userId})`);
        return existing;
    }
    
    let displayName = userId;
    try {
        if (/^\d+$/.test(userId)) {
            const member = await guild.members.fetch(userId);
            displayName = member.displayName || member.user.username || member.user.globalName || userId;
            console.log(`Fetched name: ${displayName} for ${userId}`);
        }
    } catch (error) {
        console.error(`Error fetching name for ${userId}:`, error.message);
    }
    
    const newUser = { 
        id: userId, 
        name: displayName,
        dateJoined: new Date().toISOString(), 
        role: "user" 
    };
    
    data.users.push(newUser);
    writeData(data);
    console.log(`✅ Created user: ${displayName} (${userId})`);
    return newUser;
}


function isUserRegistered(userId) {
    try {
        const data = readData();
        const user = data.users?.find(u => u.id === userId);
        return user && user.birthday;
    } catch (error) {
        console.error('Error checking registration:', error);
        return false;
    }
}


function getRegisteredUser(userId) {
    try {
        const data = readData();
        const user = data.users?.find(u => u.id === userId);
        return (user && user.birthday) ? user : null;
    } catch (error) {
        console.error('Error getting user:', error);
        return null;
    }
}


function validateUserRegistration(userId, action = 'this action') {
    const user = getRegisteredUser(userId);
    return user ? {
        isRegistered: true,
        user: user,
        message: `✅ User ${user.name} is registered`
    } : {
        isRegistered: false,
        user: null,
        message: `❌ User must complete /setup before ${action}. Please run \`/setup\` first.`
    };
}


function getUserMention(userId) {
    return `<@${userId}>`;
}


function validateMultipleUsers(userIds, action = 'this action') {
    const results = userIds.map(userId => ({ userId, ...validateUserRegistration(userId, action) }));
    const registeredUsers = results.filter(r => r.isRegistered).map(r => r.user);
    const unregisteredUsers = results.filter(r => !r.isRegistered).map(r => r.userId);
    
    return {
        allRegistered: unregisteredUsers.length === 0,
        registeredUsers,
        unregisteredUsers,
        messages: results.map(r => r.message)
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
