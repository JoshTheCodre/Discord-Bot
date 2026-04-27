require('dotenv').config();

const { backfillSubtasksCollection } = require('../firebase/firestoreService');

async function run() {
  try {
    console.log('🚀 Starting subtasks collection backfill...');
    const result = await backfillSubtasksCollection();
    console.log('✅ Backfill complete');
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('❌ Backfill failed:', error);
    process.exit(1);
  }
}

run();
