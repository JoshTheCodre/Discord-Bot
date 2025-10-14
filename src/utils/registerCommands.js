const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const commands = [
    new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Set up your user profile with name and birthday')
        .toJSON(),
    new SlashCommandBuilder()
        .setName('performance')
        .setDescription('Generate performance reports (Admin only)')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type of report to generate')
                .setRequired(true)
                .addChoices(
                    { name: '📊 Google Sheets - Sync All Data', value: 'sheets-sync' },
                    { name: 'Summary - Performance Overview', value: 'summary' }
                ))
        .toJSON(),
    new SlashCommandBuilder()
        .setName('tasks')
        .setDescription('View task assignments and status')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('View tasks for specific user (Admin only)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('filter')
                .setDescription('Filter tasks by status')
                .setRequired(false)
                .addChoices(
                    { name: 'Complete - Show completed tasks', value: 'complete' },
                    { name: 'Active - Show active/pending tasks', value: 'active' },
                    { name: 'Due - Show overdue tasks', value: 'due' }
                ))
        .toJSON(),
    new SlashCommandBuilder()
        .setName('movies')
        .setDescription('Movie release reminders (Admin only)')
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Action to perform')  
                .setRequired(true)
                .addChoices(
                    { name: '🧪 Test - Send test reminder now', value: 'test' },
                    { name: '📅 This Month - View upcoming movies for current month', value: 'month' }
                ))
        .toJSON(),
];

const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN);

const registerCommands = async () => {
    try {
        console.log('🔄 Registering slash commands...');
        const data = await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
        console.log(`✅ Successfully registered ${data.length} slash command(s)`);
    } catch (error) {
        console.error('❌ Error registering commands:', error);
    }
};


const registerGuildCommands = async (guildId) => {
    try {
        console.log(`🔄 Registering commands for guild ${guildId}...`);
        const data = await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId), { body: commands });
        console.log(`✅ Successfully registered ${data.length} guild command(s)`);
    } catch (error) {
        console.error('❌ Error registering guild commands:', error);
    }
};

module.exports = {
    registerCommands,
    registerGuildCommands
};
