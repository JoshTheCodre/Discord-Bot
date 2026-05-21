const { createLog } = require('../firebase/firestoreService');

async function log(type, message, meta = {}) {
  console.log(`[LOG] ${type}: ${message}`);
  await createLog({ type, message, ...meta });
}

module.exports = { log };
