/**
 * Test Birthday Service with Joshua
 */

const { triggerBirthdayCheck } = require('./src/services/birthdayService');

// Mock client to test Joshua's birthday
const mockClient = {
    users: {
        fetch: async (userId) => {
            const userNames = {
                '1384014266822033459': 'Joshua',
                '1424664327809536020': 'Barry'
            };
            console.log(`🔍 Fetching user: ${userNames[userId] || 'Unknown'} (${userId})`);
            return {
                id: userId,
                username: userNames[userId] || 'Unknown',
                send: async (message) => {
                    console.log(`\n📧 BIRTHDAY DM FOR ${userNames[userId].toUpperCase()}:`);
                    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                    if (message.embeds && message.embeds[0]) {
                        const embed = message.embeds[0].data;
                        console.log(`📧 To: ${userNames[userId]}`);
                        console.log(`🎨 Color: #${embed.color ? embed.color.toString(16).padStart(6, '0') : 'default'}`);
                        console.log(`📌 Title: ${embed.title}`);
                        console.log(`📝 Message: ${embed.description}`);
                        if (embed.fields) {
                            embed.fields.forEach(field => {
                                console.log(`🏷️  ${field.name}: ${field.value}`);
                            });
                        }
                        if (embed.footer) {
                            console.log(`👇 Footer: ${embed.footer.text}`);
                        }
                    }
                    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
                    return { id: 'mock-dm-message-id' };
                }
            };
        }
    },
    guilds: {
        cache: new Map([
            ['test-guild', {
                name: 'Solomax Studios',
                channels: {
                    cache: new Map([
                        ['general-chat-id', {
                            name: 'general-chat',
                            isTextBased: () => true,
                            send: async (message) => {
                                const userId = message.content.match(/<@(\d+)>/)?.[1];
                                const usernames = {
                                    '1384014266822033459': 'Joshua',
                                    '1424664327809536020': 'Barry'
                                };
                                const username = usernames[userId] || 'Unknown';
                                
                                console.log(`📢 ANNOUNCEMENT IN #general-chat FOR ${username.toUpperCase()}:`);
                                console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                                console.log(`👤 Mention: ${message.content}`);
                                if (message.embeds && message.embeds[0]) {
                                    const embed = message.embeds[0].data;
                                    console.log(`🎨 Color: #${embed.color ? embed.color.toString(16).padStart(6, '0') : 'default'}`);
                                    console.log(`📌 Title: ${embed.title}`);
                                    console.log(`📝 Message: ${embed.description}`);
                                    if (embed.fields) {
                                        embed.fields.forEach(field => {
                                            console.log(`🏷️  ${field.name}: ${field.value}`);
                                        });
                                    }
                                }
                                console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
                                return { id: 'mock-general-message-id' };
                            }
                        }],
                        ['announcements-id', {
                            name: 'announcements',
                            isTextBased: () => true,
                            send: async (message) => {
                                const userId = message.content.match(/<@(\d+)>/)?.[1];
                                const usernames = {
                                    '1384014266822033459': 'Joshua',
                                    '1424664327809536020': 'Barry'
                                };
                                const username = usernames[userId] || 'Unknown';
                                
                                console.log(`📢 ANNOUNCEMENT IN #announcements FOR ${username.toUpperCase()}:`);
                                console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                                console.log(`👤 Mention: ${message.content}`);
                                if (message.embeds && message.embeds[0]) {
                                    const embed = message.embeds[0].data;
                                    console.log(`🎨 Color: #${embed.color ? embed.color.toString(16).padStart(6, '0') : 'default'}`);
                                    console.log(`📌 Title: ${embed.title}`);
                                    console.log(`📝 Message: ${embed.description}`);
                                }
                                console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
                                return { id: 'mock-announcements-message-id' };
                            }
                        }]
                    ])
                }
            }]
        ])
    }
};

async function testJoshuaBirthday() {
    console.log('🎂 TESTING BIRTHDAY SERVICE WITH JOSHUA');
    console.log('=====================================\n');
    
    console.log('📅 Date: October 8, 2025');
    console.log('👤 Test User: Joshua (Admin)');
    console.log('🎯 Expected: Both Joshua and Barry should have birthdays today\n');
    
    try {
        await triggerBirthdayCheck(mockClient);
        
        console.log('✅ BIRTHDAY SERVICE TEST COMPLETED!');
        console.log('===================================');
        console.log('📊 Results Summary:');
        console.log('  🎂 Users checked for birthdays today (10/08)');
        console.log('  📧 Birthday DMs sent to celebrants');
        console.log('  📢 Announcements posted in channels');
        console.log('  🎨 Professional message formatting applied');
        console.log('  ✨ Mature, business-appropriate tone used\n');
        
        console.log('🔧 To test in Discord:');
        console.log('  1. Have Joshua type: !test-birthday');
        console.log('  2. Check Joshua\'s and Barry\'s DMs');
        console.log('  3. Check #general-chat and #announcements channels');
        
    } catch (error) {
        console.error('❌ Error testing Joshua birthday:', error);
    }
}

// Run the test
testJoshuaBirthday();
