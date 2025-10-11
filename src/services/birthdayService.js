const cron = require('node-cron');
const { EmbedBuilder } = require('discord.js');
const { readData } = require('./storage');

const ANNOUNCEMENT_CHANNELS = ['general-chat', 'announcements'];

function startBirthdayReminders(client) {
    cron.schedule('0 8 * * *', async () => {
        console.log('🎂 Running daily birthday check...');
        await checkBirthdays(client);
    });
    console.log('🎂 Birthday reminders scheduled for 8:00 AM daily');
}


function triggerBirthdayCheck(client) {
    console.log('🎂 Manually triggering birthday check...');
    return checkBirthdays(client);
}


async function checkBirthdays(client) {
    try {
        const { users = [] } = readData();
        const today = getTodayString();
        console.log(`🎂 Checking birthdays for ${today}`);
        
        const birthdayUsers = users.filter(user => user.birthday === today);
        
        if (birthdayUsers.length === 0) {
            console.log('🎂 No birthdays today');
            return;
        }
        
        console.log(`🎂 Found ${birthdayUsers.length} birthday(s):`, birthdayUsers.map(u => u.name));
        
        for (const user of birthdayUsers) {
            await sendBirthdayMessages(client, user);
        }
    } catch (error) {
        console.error('❌ Error checking birthdays:', error);
    }
}


async function sendBirthdayMessages(client, user) {
    try {
        await sendBirthdayDM(client, user);
        await sendChannelAnnouncements(client, user);
        console.log(`🎂 Birthday messages sent for ${user.name}`);
    } catch (error) {
        console.error(`❌ Error sending birthday messages for ${user.name}:`, error);
    }
}


async function sendBirthdayDM(client, user) {
    const discordUser = await client.users.fetch(user.id);
    
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const dismissButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('dismiss_birthday_dm')
                .setLabel('Dismiss')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('❌')
        );
    
    await discordUser.send({ 
        embeds: [createBirthdayDMEmbed(user.name)], 
        components: [dismissButton] 
    });
    console.log(`📧 Birthday DM sent to ${user.name}`);
}


async function sendChannelAnnouncements(client, user) {
    for (const guild of client.guilds.cache.values()) {
        for (const channelName of ANNOUNCEMENT_CHANNELS) {
            const channel = Array.from(guild.channels.cache.values()).find(c => c.isTextBased() && c.name === channelName);
            if (channel) {
                await channel.send({ 
                    content: `<@${user.id}>`,
                    embeds: [createBirthdayAnnouncementEmbed(user)],
                    allowedMentions: { parse: ['users'] }
                });
                console.log(`📢 Birthday announcement sent to #${channel.name}`);
            }
        }
    }
}


function getTodayString() {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${month}/${day}`;
}


function createBirthdayDMEmbed(name) {
    return new EmbedBuilder()
        .setColor('#4A90E2')
        .setTitle('🎉 Happy Birthday!')
        .setDescription(`Dear ${name},\n\nWe hope your special day is filled with joy, success, and meaningful moments. Thank you for being such a valued member of our community.`)
        .addFields(
            { name: 'Birthday Wishes', value: 'May this new year bring you continued growth, happiness, and exciting opportunities.', inline: false },
            { name: 'Best Regards', value: 'The Team', inline: false }
        )
        .setTimestamp();
}


function createBirthdayAnnouncementEmbed(user) {
    return new EmbedBuilder()
        .setColor('#5B9BD5')
        .setTitle('🎂 Birthday Announcement')
        .setDescription(`Today we celebrate **${user.name}**'s birthday!`)
        .addFields(
            { name: 'Join Us in Celebrating', value: `Please join us in wishing <@${user.id}> a wonderful birthday and continued success.`, inline: false },
            { name: 'Community Message', value: 'Birthdays are special milestones that remind us to appreciate the people who make our community great.', inline: false }
        )
        .setTimestamp();
}

module.exports = {
    startBirthdayReminders,
    triggerBirthdayCheck
};
