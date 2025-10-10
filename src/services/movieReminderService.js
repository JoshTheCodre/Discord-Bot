const cron = require('node-cron');
const SimpleGoogleDocsReader = require('../utils/simpleGoogleDocsReader');
const { ADMIN_IDS } = require('./setupService');
const DiscordUtils = require('../utils/discordUtils');
const DateUtils = require('../utils/dateUtils');
const StringUtils = require('../utils/stringUtils');

/**
 * Movie Reminder Service
 * Checks movie calendar daily at 8 AM and sends DMs to admins
 * for movies releasing the next day and today
 */
class MovieReminderService {
  constructor(client) {
    this.client = client;
    this.docReader = new SimpleGoogleDocsReader();
    this.movieDocUrl = 'https://docs.google.com/document/d/1x1V4u3GFh1zpJYwMXfQMGRBSQV50y-no/edit?pli=1';
    
    // Admin IDs from setup service
    this.adminIds = ADMIN_IDS;
  }

  /**
   * Start the movie reminder scheduler
   */
  start() {
    console.log('🎬 Movie Reminder Service started');
    
    // Schedule for 8:00 AM daily
    cron.schedule('0 8 * * *', () => {
      this.checkMovieReminders();
    }, {
      timezone: 'America/New_York' // Adjust timezone as needed
    });
  }

  /**
   * Main function to check and send movie reminders
   */
  async checkMovieReminders() {
    try {
      console.log('🔍 Checking movie reminders...');
      
      const movies = await this.getMoviesFromDoc();
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const todayMovies = this.getMoviesForDate(movies, today);
      const tomorrowMovies = this.getMoviesForDate(movies, tomorrow);
      
      if (todayMovies.length > 0 || tomorrowMovies.length > 0) {
        await this.sendReminders(todayMovies, tomorrowMovies);
      } else {
        console.log('📅 No movie releases today or tomorrow');
      }
      
    } catch (error) {
      console.error('❌ Movie reminder error:', error.message);
    }
  }

  /**
   * Get movies from Google Doc
   */
  async getMoviesFromDoc() {
    const result = await this.docReader.readDocument(this.movieDocUrl);
    
    if (!result.success) {
      throw new Error('Failed to read movie document');
    }
    
    return this.parseMovies(result.content);
  }

  /**
   * Parse movies from document content
   */
  parseMovies(content) {
    const movies = [];
    const lines = content.split('\n');
    let currentMonth = null;
    let currentYear = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check for month/year header
      if (StringUtils.isMonthYearHeader(line)) {
        const monthYear = StringUtils.parseMonthYear(line);
        currentMonth = monthYear.month;
        currentYear = monthYear.year;
        continue;
      }
      
      // Check for day number followed by movies
      const dayMatch = line.match(/^\d+$/);
      if (dayMatch && currentMonth && currentYear) {
        const day = parseInt(line);
        
        // Look ahead for movie titles on subsequent lines
        for (let j = i + 1; j < lines.length && j < i + 10; j++) {
          const movieLine = lines[j].trim();
          
          // Stop if we hit another day number or month
          if (/^\d+$/.test(movieLine) || /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}$/i.test(movieLine)) {
            break;
          }
          
          // Parse movie from line
          const movieTitle = StringUtils.extractMovieTitle(movieLine);
          if (movieTitle) {
            movies.push({
              title: movieTitle,
              date: new Date(currentYear, DateUtils.getMonthIndex(currentMonth), day),
              platform: StringUtils.extractPlatform(movieLine),
              rawLine: movieLine
            });
          }
        }
      }
    }
    
    return movies;
  }



  /**
   * Get movies for specific date
   */
  getMoviesForDate(movies, targetDate) {
    return movies.filter(movie => DateUtils.isSameDay(movie.date, targetDate));
  }

  /**
   * Get movies for current month
   */
  getMoviesForCurrentMonth(movies) {
    const today = new Date();
    return movies.filter(movie => DateUtils.isCurrentMonth(movie.date, today));
  }

  /**
   * Get upcoming movies (from today onwards)
   */
  getUpcomingMovies(movies) {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    return movies.filter(movie => movie.date >= today);
  }

  /**
   * Send reminder DMs to admins
   */
  async sendReminders(todayMovies, tomorrowMovies) {
    const embed = this.createReminderEmbed(todayMovies, tomorrowMovies);
    
    // Add action row with dismiss button and document link
    const components = [{
      type: 1, // ACTION_ROW
      components: [
        {
          type: 2, // BUTTON
          style: 5, // LINK
          label: '📋 View Full Calendar',
          url: this.movieDocUrl
        },
        {
          type: 2, // BUTTON  
          style: 4, // DANGER
          label: '✖️ Dismiss',
          custom_id: 'dismiss_movie_reminder'
        }
      ]
    }];
    
    for (const adminId of this.adminIds) {
      const user = await DiscordUtils.fetchUser(this.client, adminId);
      if (user) {
        const sent = await DiscordUtils.sendDM(user, { 
          embeds: [embed],
          components: components
        });
        if (sent) {
          console.log(`📨 Sent movie reminder to ${user.username}`);
        }
      }
    }
  }

  /**
   * Create reminder embed
   */
  createReminderEmbed(todayMovies, tomorrowMovies) {
    const today = DateUtils.formatReadable(new Date());
    const tomorrow = DateUtils.formatReadable(DateUtils.getTomorrow());

    const fields = [];

    if (todayMovies.length > 0) {
      const todayList = todayMovies.map(movie => `• **${movie.title}** (${movie.platform})`).join('\n');
      fields.push({
        name: `🎯 Releasing Today - ${today}`,
        value: todayList,
        inline: false
      });
    }

    if (tomorrowMovies.length > 0) {
      const tomorrowList = tomorrowMovies.map(movie => `• **${movie.title}** (${movie.platform})`).join('\n');
      fields.push({
        name: `📅 Releasing Tomorrow - ${tomorrow}`,
        value: tomorrowList,
        inline: false
      });
    }

    return DiscordUtils.createEmbed({
      title: '🎬 Movie Release Reminders',
      color: DiscordUtils.colors.movie,
      fields,
      footer: `Movie Reminder Service • ${todayMovies.length + tomorrowMovies.length} releases`
    });
  }



  /**
   * Manual trigger for testing
   */
  async testReminder() {
    console.log('🧪 Testing movie reminder service...');
    await this.checkMovieReminders();
  }
}

module.exports = MovieReminderService;
