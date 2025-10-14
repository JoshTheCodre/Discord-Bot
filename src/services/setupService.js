const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const { readData, saveUser } = require('./storage');


const ADMIN_IDS = ['1384014266822033459', '1424163883584585840'];

const hasUserCompletedSetup = async (userId) => {
    const data = await readData();
    const user = data.users?.find(u => u.id === userId);
    return user && user.birthday;
};


const getUserRole = (userId) => ADMIN_IDS.includes(userId) ? 'admin' : 'user';


const createSetupModal = () => {
    const modal = new ModalBuilder()
        .setCustomId('user_setup_modal')
        .setTitle('👋 Welcome! Set up your profile');

    const nameInput = new TextInputBuilder()
        .setCustomId('setup_name')
        .setLabel('What\'s your preferred name?')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Enter your name (e.g., John, Sarah)')
        .setRequired(true)
        .setMaxLength(50);

    const birthdayInput = new TextInputBuilder()
        .setCustomId('setup_birthday')
        .setLabel('When\'s your birthday?')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('MM/DD format (e.g., 03/15)')
        .setRequired(true)
        .setMaxLength(5)
        .setMinLength(4);

    return modal.addComponents(
        new ActionRowBuilder().addComponents(nameInput),
        new ActionRowBuilder().addComponents(birthdayInput)
    );
};


const validateBirthday = (birthday) => {
    const birthdayRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])$/;
    if (!birthdayRegex.test(birthday)) {
        return { valid: false, error: 'Birthday must be in MM/DD format (e.g., 03/15)' };
    }

    const [month, day] = birthday.split('/').map(Number);
    const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    
    return day > daysInMonth[month - 1] 
        ? { valid: false, error: 'Invalid day for the given month' }
        : { valid: true };
};


const handleSetupCommand = async (interaction) => {
    try {
        if (await hasUserCompletedSetup(interaction.user.id)) {
            return await interaction.reply({ 
                embeds: [new EmbedBuilder()
                    .setColor('#FF6B6B')
                    .setTitle('⚠️ Setup Already Completed')
                    .setDescription('You have already completed your profile setup!')
                    .setTimestamp()], 
                flags: 64
            });
        }

        await interaction.showModal(createSetupModal());
    } catch (error) {
        console.error('Error handling setup command:', error);
        await interaction.reply({
            content: '❌ An error occurred while processing your setup request.',
            flags: 64
        });
    }
};


const handleSetupModalSubmit = async (interaction) => {
    try {
        const userId = interaction.user.id;
        
        if (await hasUserCompletedSetup(userId)) {
            return await interaction.reply({
                content: '⚠️ You have already completed setup!',
                flags: 64
            });
        }

        const name = interaction.fields.getTextInputValue('setup_name').trim();
        const birthday = interaction.fields.getTextInputValue('setup_birthday').trim();

        const birthdayValidation = validateBirthday(birthday);
        if (!birthdayValidation.valid) {
            return await interaction.reply({
                content: `❌ ${birthdayValidation.error}`,
                flags: 64
            });
        }

        const role = getUserRole(userId);
        const isAdmin = role === 'admin';
        const now = new Date().toISOString();
        
        const userData = {
            id: userId,
            name: name,
            birthday: birthday,
            role: role,
            dateJoined: now,
            setupCompletedAt: now
        };

        // Save user to Firestore
        await saveUser(userData);

        await interaction.reply({ 
            embeds: [new EmbedBuilder()
                .setColor(isAdmin ? '#FFD700' : '#4CAF50')
                .setTitle('🎉 Profile Setup Complete!')
                .setDescription(`Welcome to the team, **${name}**!`)
                .addFields(
                    { name: '👤 Name', value: name, inline: true },
                    { name: '🎂 Birthday', value: birthday, inline: true },
                    { name: '🏷️ Role', value: `${isAdmin ? '👑 Admin' : '👤 User'}`, inline: true }
                )
                .setTimestamp()], 
            flags: 64
        });

        console.log(`✅ Setup completed for ${name} (${userId}) - Role: ${role}`);

        // User setup completed successfully - Firestore-only system handles data automatically

    } catch (error) {
        console.error('Error handling setup modal:', error);
        await interaction.reply({
            content: '❌ An error occurred while saving your setup. Please try again.',
            flags: 64
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
