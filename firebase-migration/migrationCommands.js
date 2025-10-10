/**
 * Firebase Migration Commands
 * 
 * IMPORTANT: DO NOT RUN THESE COMMANDS YET!
 * These are prepared for when you're ready to migrate.
 * 
 * Before running migration:
 * 1. Ensure Firebase project is properly configured
 * 2. Test Firebase connection
 * 3. Create backup of current data
 * 4. Run migration in stages
 * 5. Verify migration results
 */

const migrationService = require('./migrationService');
const firestoreService = require('./firestoreService');

// Test Firebase connection
async function testConnection() {
  try {
    console.log('🔄 Testing Firebase connection...');
    
    // Try to get settings (will create if doesn't exist)
    await firestoreService.setSetting('test_connection', new Date().toISOString());
    const testValue = await firestoreService.getSetting('test_connection');
    
    if (testValue) {
      console.log('✅ Firebase connection successful!');
      console.log('🔗 Connected to database: sm-discord-bot-db');
      return true;
    } else {
      console.log('❌ Firebase connection failed');
      return false;
    }
  } catch (error) {
    console.error('💥 Firebase connection error:', error.message);
    return false;
  }
}

// Create backup before migration
async function createBackup() {
  try {
    console.log('💾 Creating backup...');
    const result = await migrationService.createBackup();
    
    if (result.success) {
      console.log('✅ Backup created successfully');
      console.log(`📁 Backup location: ${result.backupFile}`);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Backup creation failed:', error.message);
    throw error;
  }
}

// Run full migration
async function runMigration() {
  try {
    console.log('🚀 Starting full migration...');
    
    // Create backup first
    await createBackup();
    
    // Run migration
    const result = await migrationService.migrateAll();
    
    if (result.success) {
      console.log('🎉 Migration completed successfully!');
      console.log(`📊 Total records migrated: ${result.totalMigrated}`);
      
      // Verify migration
      await verifyMigration();
    }
    
    return result;
  } catch (error) {
    console.error('💥 Migration failed:', error.message);
    throw error;
  }
}

// Verify migration results
async function verifyMigration() {
  try {
    console.log('🔍 Verifying migration...');
    const result = await migrationService.verifyMigration();
    
    if (result.allMatch) {
      console.log('✅ Migration verification successful!');
    } else {
      console.log('⚠️  Migration verification warnings detected');
      console.log('📋 Check the verification details above');
    }
    
    return result;
  } catch (error) {
    console.error('❌ Migration verification failed:', error.message);
    throw error;
  }
}

// Migration steps (run individually if needed)
async function migrateUsers() {
  return await migrationService.migrateUsers();
}

async function migrateChannels() {
  return await migrationService.migrateChannels();
}

async function migrateTasks() {
  return await migrationService.migrateTasks();
}

async function migratePerformance() {
  return await migrationService.migratePerformance();
}

// Export functions for use
module.exports = {
  testConnection,
  createBackup,
  runMigration,
  verifyMigration,
  migrateUsers,
  migrateChannels,
  migrateTasks,
  migratePerformance
};

// If this file is run directly, show instructions
if (require.main === module) {
  console.log(`
🔥 Firebase Migration Commands Ready!

⚠️  IMPORTANT: Do not run migration yet!

To test and migrate when ready:

1. Test connection:
   node firebase-migration/migrationCommands.js test

2. Create backup:
   node firebase-migration/migrationCommands.js backup

3. Run full migration:
   node firebase-migration/migrationCommands.js migrate

4. Verify migration:
   node firebase-migration/migrationCommands.js verify

Individual migrations:
   node firebase-migration/migrationCommands.js users
   node firebase-migration/migrationCommands.js channels
   node firebase-migration/migrationCommands.js tasks
   node firebase-migration/migrationCommands.js performance

🔗 Database URL: https://console.firebase.google.com/project/solomaxstudios-246c0/firestore/databases/sm-discord-bot-db/data
`);

  // Handle command line arguments
  const command = process.argv[2];
  
  if (command) {
    switch (command.toLowerCase()) {
      case 'test':
        testConnection();
        break;
      case 'backup':
        createBackup();
        break;
      case 'migrate':
        runMigration();
        break;
      case 'verify':
        verifyMigration();
        break;
      case 'users':
        migrateUsers();
        break;
      case 'channels':
        migrateChannels();
        break;
      case 'tasks':
        migrateTasks();
        break;
      case 'performance':
        migratePerformance();
        break;
      default:
        console.log('❌ Unknown command. Use: test, backup, migrate, verify, users, channels, tasks, or performance');
    }
  }
}
