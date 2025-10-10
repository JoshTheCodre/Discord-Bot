/**
 * String Utilities
 * Common string manipulation functions
 */

class StringUtils {
  /**
   * Truncate string with ellipsis
   */
  static truncate(str, maxLength = 100) {
    if (!str || str.length <= maxLength) return str;
    return str.substring(0, maxLength).trim() + '...';
  }

  /**
   * Clean and normalize text
   */
  static clean(text) {
    if (!text) return '';
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extract movie title from line
   */
  static extractMovieTitle(line) {
    if (!line || line.length < 3) return null;
    
    // Skip day names, empty lines, or calendar formatting
    if (/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/.test(line) || 
        /^[\s\t]*$/.test(line) || 
        line.includes('CALENDAR') || 
        line.includes('MOVIES')) {
      return null;
    }
    
    // Clean up the title
    let title = line
      .replace(/\(Web\)/gi, '')
      .replace(/\(Netflix\)/gi, '')
      .replace(/\(Amazon\)/gi, '')
      .replace(/\(Disney\)/gi, '')
      .replace(/WebRelease/gi, '')
      .trim();
    
    // Return if it looks like a movie title
    if (title.length > 2 && /[A-Za-z]/.test(title)) {
      return title;
    }
    
    return null;
  }

  /**
   * Extract platform from movie line
   */
  static extractPlatform(line) {
    if (!line) return 'Cinema';
    
    const lowerLine = line.toLowerCase();
    if (lowerLine.includes('netflix')) return 'Netflix';
    if (lowerLine.includes('amazon')) return 'Amazon Prime';
    if (lowerLine.includes('disney')) return 'Disney+';
    if (lowerLine.includes('web')) return 'Web Release';
    return 'Cinema';
  }

  /**
   * Check if line is month/year header
   */
  static isMonthYearHeader(line) {
    const monthYearPattern = /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})$/i;
    return monthYearPattern.test(line);
  }

  /**
   * Parse month and year from header
   */
  static parseMonthYear(line) {
    const monthYearPattern = /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})$/i;
    const match = line.match(monthYearPattern);
    
    if (match) {
      return {
        month: match[1],
        year: parseInt(match[2])
      };
    }
    
    return null;
  }

  /**
   * Capitalize first letter
   */
  static capitalize(str) {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Create safe filename from string
   */
  static toFilename(str) {
    return str
      .replace(/[^a-z0-9]/gi, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_|_$/g, '')
      .toLowerCase();
  }
}

module.exports = StringUtils;
