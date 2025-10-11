const { EmbedBuilder } = require('discord.js');

/**
 * Discord Utilities
 * Common Discord-related functions to reduce code duplication
 */

class DiscordUtils {
  /**
   * Common embed colors
   */
  static colors = {
    success: 0x4CAF50,   // Green
    error: 0xFF4444,     // Red  
    warning: 0xFFA726,   // Orange
    info: 0x2196F3,      // Blue
    primary: 0x9C27B0,   // Purple
    movie: 0xFF6B6B,     // Movie red
    task: 0x00BCD4,      // Task cyan
    birthday: 0xE91E63   // Birthday pink
  };

  /**
   * Create a standard embed with common properties
   */
  static createEmbed(options = {}) {
    const embed = new EmbedBuilder()
      .setColor(options.color || this.colors.info)
      .setTimestamp();

    if (options.title) embed.setTitle(options.title);
    if (options.description) embed.setDescription(options.description);
    if (options.footer) embed.setFooter({ text: options.footer });
    if (options.thumbnail) embed.setThumbnail(options.thumbnail);
    if (options.image) embed.setImage(options.image);
    if (options.author) embed.setAuthor(options.author);
    if (options.fields) embed.addFields(options.fields);

    return embed;
  }

  /**
   * Create success embed
   */
  static createSuccessEmbed(title, description, options = {}) {
    return this.createEmbed({
      title: `✅ ${title}`,
      description,
      color: this.colors.success,
      ...options
    });
  }

  /**
   * Create error embed
   */
  static createErrorEmbed(title, description, options = {}) {
    return this.createEmbed({
      title: `❌ ${title}`,
      description,
      color: this.colors.error,
      ...options
    });
  }

  /**
   * Create admin-only error embed
   */
  static createAdminOnlyEmbed(commandName = 'command') {
    return this.createErrorEmbed(
      'Admin Only Command',
      `Only administrators can use the ${commandName} command.`
    );
  }

  /**
   * Create loading embed
   */
  static createLoadingEmbed(message = 'Processing...') {
    return this.createEmbed({
      title: '⏳ Loading',
      description: message,
      color: this.colors.warning
    });
  }

  /**
   * Send ephemeral reply (dismissible)
   */
  static async sendEphemeral(interaction, embed, deferred = false) {
    const options = { embeds: [embed], flags: 64 };
    
    if (deferred) {
      return await interaction.editReply(options);
    } else {
      return await interaction.reply(options);
    }
  }

  /**
   * Safe user fetch with error handling
   */
  static async fetchUser(client, userId) {
    try {
      return await client.users.fetch(userId);
    } catch (error) {
      console.error(`Failed to fetch user ${userId}:`, error.message);
      return null;
    }
  }

  /**
   * Safe DM send with error handling
   */
  static async sendDM(user, content) {
    try {
      const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
      const dismissButton = new ActionRowBuilder()
          .addComponents(
              new ButtonBuilder()
                  .setCustomId('dismiss_general_dm')
                  .setLabel('Dismiss')
                  .setStyle(ButtonStyle.Secondary)
                  .setEmoji('❌')
          );

      // If content is a string, convert to proper message object
      const messageContent = typeof content === 'string' 
          ? { content, components: [dismissButton] }
          : { ...content, components: [...(content.components || []), dismissButton] };

      return await user.send(messageContent);
    } catch (error) {
      console.error(`Failed to send DM to ${user.username}:`, error.message);
      return null;
    }
  }

  /**
   * Format date for Discord
   */
  static formatDate(date, style = 'f') {
    const timestamp = Math.floor(date.getTime() / 1000);
    return `<t:${timestamp}:${style}>`;
  }

  /**
   * Create movie embed
   */
  static createMovieEmbed(movies, title, options = {}) {
    const embed = this.createEmbed({
      title: `🎬 ${title}`,
      color: this.colors.movie,
      ...options
    });

    if (movies.length === 0) {
      embed.setDescription('No movies found for this period.');
      return embed;
    }

    // Group movies by date
    const moviesByDate = {};
    movies.forEach(movie => {
      const dateKey = movie.date.toDateString();
      if (!moviesByDate[dateKey]) moviesByDate[dateKey] = [];
      moviesByDate[dateKey].push(movie);
    });

    // Add fields for each date
    Object.entries(moviesByDate).slice(0, 25).forEach(([date, dateMovies]) => {
      const movieList = dateMovies
        .map(movie => `• **${movie.title}** (${movie.platform})`)
        .join('\n');
      
      embed.addFields({
        name: `📅 ${date}`,
        value: movieList.substring(0, 1024), // Discord field limit
        inline: false
      });
    });

    return embed;
  }
}

module.exports = DiscordUtils;
