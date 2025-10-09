/**
 * Setup Service
 * Handles user profile setup with name, birthday, and role assignment
 */

const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const { readData, writeData } = require('./storage');

// Admin user IDs - users in this list get 'admin' role, others get 'user' role
const ADMIN_IDS = [
    '1384014266822033459', // Joshua
    '1424163883584585840' 
];

/**
 * Check if user has already completed setup
 */
const hasUserCompletedSetup = (userId) => {
    const data = readData();
    const user = data.users?.find(u => u.id === userId);
    return user && user.birthday; // If birthday exists, setup was completed
};

/**
 * Determine user role based on admin list
 */
const getUserRole = (userId) => {
    return ADMIN_IDS.includes(userId) ? 'admin' : 'user';
};

/**
 * Create setup modal for collecting user information
 */
const createSetupModal = () => {
    const modal = new ModalBuilder()
        .setCustomId('user_setup_modal')
        .setTitle('👋 Welcome! Let\'s set up your profile');

    const nameInput = new TextInputBuilder()
        .setCustomId('setup_name')
        .setLabel('What\'s your preferred name?')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Enter your name (e.g., John, Sarah, Alex)')
        .setRequired(true)
        .setMaxLength(50);

    const birthdayInput = new TextInputBuilder()
        .setCustomId('setup_birthday')
        .setLabel('When\'s your birthday?')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('MM/DD format (e.g., 03/15, 12/25)')
        .setRequired(true)
        .setMaxLength(5)
        .setMinLength(4);

    const nameRow = new ActionRowBuilder().addComponents(nameInput);
    const birthdayRow = new ActionRowBuilder().addComponents(birthdayInput);

    modal.addComponents(nameRow, birthdayRow);
    return modal;
};

/**
 * Validate birthday format (MM/DD)
 */
const validateBirthday = (birthday) => {
    const birthdayRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])$/;
    if (!birthdayRegex.test(birthday)) {
        return { valid: false, error: 'Birthday must be in MM/DD format (e.g., 03/15)' };
    }

    const [month, day] = birthday.split('/').map(Number);
    
    // Basic validation for days per month
    const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (day > daysInMonth[month - 1]) {
        return { valid: false, error: 'Invalid day for the given month' };
    }

    return { valid: true };
};

/**
 * Handle setup slash command
 */
const handleSetupCommand = async (interaction) => {
    try {
        const userId = interaction.user.id;
        
        // Check if user has already completed setup
        if (hasUserCompletedSetup(userId)) {
            const embed = new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle('⚠️ Setup Already Completed')
                .setDescription('You have already completed your profile setup!')
                .addFields({
                    name: '💡 Need to update your info?',
                    value: 'Contact an administrator to update your profile.',
                    inline: false
                })
                .setFooter({ text: 'One setup per user allowed' })
                .setTimestamp();

            return await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Show setup modal
        const modal = createSetupModal();
        await interaction.showModal(modal);
        
    } catch (error) {
        console.error('Error handling setup command:', error);
        await interaction.reply({
            content: '❌ An error occurred while processing your setup request.',
            ephemeral: true
        });
    }
};

/**
 * Handle setup modal submission
 */
const handleSetupModalSubmit = async (interaction) => {
    try {
        const userId = interaction.user.id;
        const guildId = interaction.guild?.id;
        
        // Double-check setup completion (in case of race conditions)
        if (hasUserCompletedSetup(userId)) {
            return await interaction.reply({
                content: '⚠️ You have already completed setup!',
                ephemeral: true
            });
        }

        // Extract form data
        const name = interaction.fields.getTextInputValue('setup_name').trim();
        const birthday = interaction.fields.getTextInputValue('setup_birthday').trim();

        // Validate birthday format
        const birthdayValidation = validateBirthday(birthday);
        if (!birthdayValidation.valid) {
            return await interaction.reply({
                content: `❌ ${birthdayValidation.error}`,
                ephemeral: true
            });
        }

        // Determine role
        const role = getUserRole(userId);
        const isAdmin = role === 'admin';

        // Save user data
        const data = readData();
        if (!Array.isArray(data.users)) data.users = [];

        // Find existing user or create new entry
        let user = data.users.find(u => u.id === userId);
        
        if (user) {
            // Update existing user
            user.name = name;
            user.birthday = birthday;
            user.role = role;
            user.setupCompletedAt = new Date().toISOString();
        } else {
            // Create new user
            user = {
                id: userId,
                name: name,
                birthday: birthday,
                role: role,
                dateJoined: new Date().toISOString(),
                setupCompletedAt: new Date().toISOString()
            };
            data.users.push(user);
        }

        writeData(data);

        // Create success embed
        const embed = new EmbedBuilder()
            .setColor(isAdmin ? '#FFD700' : '#4CAF50') // Gold for admin, green for user
            .setTitle('🎉 Profile Setup Complete!')
            .setDescription(`Welcome to the team, **${name}**! Your profile has been successfully created.`)
            .addFields(
                { name: '👤 Name', value: name, inline: true },
                { name: '🎂 Birthday', value: birthday, inline: true },
                { name: '🏷️ Role', value: `${isAdmin ? '👑 Admin' : '👤 User'}`, inline: true }
            )
            .setFooter({ 
                text: isAdmin ? 'Admin privileges granted' : 'Welcome to the community!' 
            })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });

        console.log(`✅ Setup completed for ${name} (${userId}) - Role: ${role}`);

    } catch (error) {
        console.error('Error handling setup modal submission:', error);
        await interaction.reply({
            content: '❌ An error occurred while saving your setup. Please try again.',
            ephemeral: true
        });
    }
};

module.exports = {
    handleSetupCommand,
    handleSetupModalSubmit,
    hasUserCompletedSetup,
    getUserRole,
    ADMIN_IDS
};
