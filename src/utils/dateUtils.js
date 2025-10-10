/**
 * Date Utilities
 * Common date manipulation functions
 */

class DateUtils {
  /**
   * Get start of month
   */
  static getStartOfMonth(date = new Date()) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  /**
   * Get end of month
   */
  static getEndOfMonth(date = new Date()) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  }

  /**
   * Get month name
   */
  static getMonthName(monthIndex) {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[monthIndex];
  }

  /**
   * Get month index from name
   */
  static getMonthIndex(monthName) {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months.indexOf(monthName);
  }

  /**
   * Check if two dates are the same day
   */
  static isSameDay(date1, date2) {
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
  }

  /**
   * Get tomorrow's date
   */
  static getTomorrow(date = new Date()) {
    const tomorrow = new Date(date);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }

  /**
   * Format date as readable string
   */
  static formatReadable(date) {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }

  /**
   * Check if date is in current month
   */
  static isCurrentMonth(date, referenceDate = new Date()) {
    return date.getMonth() === referenceDate.getMonth() &&
           date.getFullYear() === referenceDate.getFullYear();
  }

  /**
   * Get all dates in month
   */
  static getDatesInMonth(year, month) {
    const dates = [];
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    for (let day = 1; day <= daysInMonth; day++) {
      dates.push(new Date(year, month, day));
    }
    
    return dates;
  }
}

module.exports = DateUtils;
