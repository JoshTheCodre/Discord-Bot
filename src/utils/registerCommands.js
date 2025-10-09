/**
 * Command Registration
 * Registers slash commands with Discord API
 */

const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const commands = [
    new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Set up your user profile with name and birthday (one-time only)')
        .toJSON(),
    new SlashCommandBuilder()
        .setName('performance')
        .setDescription('Generate performance reports (Admin only)')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type of performance report to generate')
                .setRequired(true)
                .addChoices(
                    { name: 'Excel Report - User Titles & Totals', value: 'excel' },
                    { name: 'Excel Report - Channel Titles & Total', value: 'channels' },
                    { name: 'Summary - Quick Performance Overview', value: 'summary' }
                ))
        .toJSON(),
    new SlashCommandBuilder()
        .setName('tasks')
        .setDescription('View task assignments and status')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('View tasks for a specific user (Admin only)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('filter')
                .setDescription('Filter tasks by status')
                .setRequired(false)
                .addChoices(
                    { name: 'Complete (-c) - Show only completed tasks', value: 'complete' },
                    { name: 'Active (-a) - Show only active/pending tasks', value: 'active' },
                    { name: 'Due (-d) - Show only overdue tasks', value: 'due' }
                ))
        .toJSON(),
];

const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN);

/**
 * Register commands globally
 */
const registerCommands = async () => {
    try {
        console.log('🔄 Registering slash commands...');

        const data = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );

        console.log(`✅ Successfully registered ${data.length} slash command(s)`);
    } catch (error) {
        console.error('❌ Error registering commands:', error);
    }
};

/**
 * Register commands for a specific guild (for testing)
 */
const registerGuildCommands = async (guildId) => {
    try {
        console.log(`🔄 Registering slash commands for guild ${guildId}...`);

        const data = await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
            { body: commands }
        );

        console.log(`✅ Successfully registered ${data.length} guild command(s)`);
    } catch (error) {
        console.error('❌ Error registering guild commands:', error);
    }
};

module.exports = {
    registerCommands,
    registerGuildCommands
};
