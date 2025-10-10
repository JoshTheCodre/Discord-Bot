const firestoreService = require('./firestoreService');
const storage = require('../src/services/storage');

/**
 * Migration Service
 * Handles migration from JSON storage to Firebase Firestore
 * Only run this when ready to migrate data
 */
class MigrationService {
  constructor() {
    this.firestoreService = firestoreService;
    this.storage = storage;
  }

  /**
   * Migrate all users from JSON to Firestore
   */
  async migrateUsers() {
    console.log('🔄 Starting user migration...');
    
    try {
      const users = this.storage.getAllUsers();
      let migratedCount = 0;
      
      for (const [userId, userData] of Object.entries(users)) {
        await this.firestoreService.createUser(userId, {
          username: userData.username,
          displayName: userData.displayName,
          joinedAt: userData.joinedAt ? new Date(userData.joinedAt) : new Date(),
          isActive: userData.isActive !== undefined ? userData.isActive : true,
          preferences: userData.preferences || {},
          stats: userData.stats || {}
        });
        migratedCount++;
      }
      
      console.log(`✅ Successfully migrated ${migratedCount} users`);
      return { success: true, migratedCount };
    } catch (error) {
      console.error('❌ Error migrating users:', error);
      throw error;
    }
  }

  /**
   * Migrate all channels from JSON to Firestore
   */
  async migrateChannels() {
    console.log('🔄 Starting channel migration...');
    
    try {
      const channels = this.storage.getAllChannels();
      let migratedCount = 0;
      
      for (const [channelId, channelData] of Object.entries(channels)) {
        await this.firestoreService.createChannel(channelId, {
          name: channelData.name,
          type: channelData.type,
          isActive: channelData.isActive !== undefined ? channelData.isActive : true,
          settings: channelData.settings || {},
          stats: channelData.stats || {}
        });
        migratedCount++;
      }
      
      console.log(`✅ Successfully migrated ${migratedCount} channels`);
      return { success: true, migratedCount };
    } catch (error) {
      console.error('❌ Error migrating channels:', error);
      throw error;
    }
  }

  /**
   * Migrate all tasks from JSON to Firestore
   */
  async migrateTasks() {
    console.log('🔄 Starting tasks migration...');
    
    try {
      const tasks = this.storage.getAllTasks();
      let migratedCount = 0;
      
      for (const [taskId, taskData] of Object.entries(tasks)) {
        await this.firestoreService.createTask({
          title: taskData.title,
          description: taskData.description,
          assignedTo: taskData.assignedTo,
          channelId: taskData.channelId,
          status: taskData.status || 'pending',
          priority: taskData.priority || 'medium',
          dueDate: taskData.dueDate ? new Date(taskData.dueDate) : null,
          completedAt: taskData.completedAt ? new Date(taskData.completedAt) : null,
          metadata: taskData.metadata || {}
        });
        migratedCount++;
      }
      
      console.log(`✅ Successfully migrated ${migratedCount} tasks`);
      return { success: true, migratedCount };
    } catch (error) {
      console.error('❌ Error migrating tasks:', error);
      throw error;
    }
  }

  /**
   * Migrate performance data from JSON to Firestore
   */
  async migratePerformance() {
    console.log('🔄 Starting performance migration...');
    
    try {
      // Get performance data from storage
      const performanceData = this.storage.getPerformanceData();
      let migratedCount = 0;
      
      // Migrate user performance records
      if (performanceData.users) {
        for (const [userId, userPerf] of Object.entries(performanceData.users)) {
          await this.firestoreService.recordPerformance(userId, {
            type: 'user_summary',
            data: userPerf,
            period: 'all_time'
          });
          migratedCount++;
        }
      }
      
      // Migrate channel performance records
      if (performanceData.channels) {
        for (const [channelId, channelPerf] of Object.entries(performanceData.channels)) {
          await this.firestoreService.recordPerformance('system', {
            type: 'channel_summary',
            channelId,
            data: channelPerf,
            period: 'all_time'
          });
          migratedCount++;
        }
      }
      
      console.log(`✅ Successfully migrated ${migratedCount} performance records`);
      return { success: true, migratedCount };
    } catch (error) {
      console.error('❌ Error migrating performance:', error);
      throw error;
    }
  }

  /**
   * Full migration process
   */
  async migrateAll() {
    console.log('🚀 Starting complete migration to Firebase Firestore...');
    
    try {
      const results = {
        users: await this.migrateUsers(),
        channels: await this.migrateChannels(),
        tasks: await this.migrateTasks(),
        performance: await this.migratePerformance()
      };
      
      const totalMigrated = Object.values(results).reduce((sum, result) => 
        sum + (result.migratedCount || 0), 0
      );
      
      console.log(`🎉 Migration completed! Total records migrated: ${totalMigrated}`);
      console.log('📊 Migration summary:', results);
      
      return { success: true, results, totalMigrated };
    } catch (error) {
      console.error('💥 Migration failed:', error);
      throw error;
    }
  }

  /**
   * Verify migration by comparing counts
   */
  async verifyMigration() {
    console.log('🔍 Verifying migration...');
    
    try {
      // Get counts from JSON storage
      const localUsers = Object.keys(this.storage.getAllUsers()).length;
      const localChannels = Object.keys(this.storage.getAllChannels()).length;
      
      // Get counts from Firestore
      const firestoreUsers = (await this.firestoreService.getAllUsers()).length;
      const firestoreChannels = (await this.firestoreService.getAllChannels()).length;
      
      const verification = {
        users: { local: localUsers, firestore: firestoreUsers, match: localUsers === firestoreUsers },
        channels: { local: localChannels, firestore: firestoreChannels, match: localChannels === firestoreChannels }
      };
      
      console.log('📋 Migration verification:', verification);
      
      const allMatch = Object.values(verification).every(item => item.match);
      
      if (allMatch) {
        console.log('✅ Migration verification successful - all counts match!');
      } else {
        console.log('⚠️  Migration verification warning - some counts don\'t match');
      }
      
      return { success: true, verification, allMatch };
    } catch (error) {
      console.error('❌ Error verifying migration:', error);
      throw error;
    }
  }

  /**
   * Create backup of current JSON data before migration
   */
  async createBackup() {
    console.log('💾 Creating backup of current data...');
    
    try {
      const fs = require('fs').promises;
      const path = require('path');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      const backupDir = path.join(__dirname, '../backups');
      const backupFile = path.join(backupDir, `backup-${timestamp}.json`);
      
      // Ensure backup directory exists
      await fs.mkdir(backupDir, { recursive: true });
      
      // Create backup data
      const backupData = {
        timestamp: new Date().toISOString(),
        users: this.storage.getAllUsers(),
        channels: this.storage.getAllChannels(),
        tasks: this.storage.getAllTasks(),
        performance: this.storage.getPerformanceData(),
        metadata: {
          version: '1.0.0',
          source: 'json-storage',
          destination: 'firebase-firestore'
        }
      };
      
      await fs.writeFile(backupFile, JSON.stringify(backupData, null, 2));
      
      console.log(`✅ Backup created: ${backupFile}`);
      return { success: true, backupFile };
    } catch (error) {
      console.error('❌ Error creating backup:', error);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new MigrationService();
