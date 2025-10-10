/**
 * Firebase Configuration Test
 * Run this to test Firebase setup before migration
 */

const { testConnection } = require('./migrationCommands');

async function runTest() {
  console.log('🔥 Firebase Configuration Test\n');
  
  try {
    const connected = await testConnection();
    
    if (connected) {
      console.log('\n✅ Firebase is properly configured and ready for migration!');
      console.log('📝 Next steps:');
      console.log('   1. Create backup: node src/utils/migrationCommands.js backup');
      console.log('   2. Run migration: node src/utils/migrationCommands.js migrate');
      console.log('   3. Verify results: node src/utils/migrationCommands.js verify');
    } else {
      console.log('\n❌ Firebase configuration issues detected');
      console.log('🔧 Please check:');
      console.log('   - Firebase project permissions');
      console.log('   - Internet connection');
      console.log('   - Configuration in config/firebase.js');
    }
  } catch (error) {
    console.error('\n💥 Test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   - Verify Firebase project exists');
    console.log('   - Check database name: sm-discord-bot-db');
    console.log('   - Ensure Firestore is enabled');
    console.log('   - Review configuration keys');
  }
}

// Run the test
runTest();
