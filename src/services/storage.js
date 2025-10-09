const fs = require('fs');
const path = require('path');

const STORAGE_FILE = path.join(__dirname, '../../data/storage.json');

/**
 * Read data from storage.json
 * @returns {Object} Object with tasks array
 */
function readData() {
    try {
        if (!fs.existsSync(STORAGE_FILE)) {
            // Create initial storage file if it doesn't exist
            const initialData = { tasks: [] };
            fs.writeFileSync(STORAGE_FILE, JSON.stringify(initialData, null, 2));
            return initialData;
        }
        
        const rawData = fs.readFileSync(STORAGE_FILE, 'utf8');
        return JSON.parse(rawData);
    } catch (error) {
        console.error('Error reading storage file:', error);
        // Return default structure if file is corrupted
        return { tasks: [] };
    }
}

/**
 * Write data to storage.json
 * @param {Object} data Object with tasks array
 */
function writeData(data) {
    try {
        fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error writing to storage file:', error);
        throw error;
    }
}

module.exports = {
    readData,
    writeData
};
