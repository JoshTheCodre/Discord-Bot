const fs = require('fs');
const path = require('path');

const STORAGE_FILE = path.join(__dirname, '../../data/storage.json');

function readData() {
    try {
        if (!fs.existsSync(STORAGE_FILE)) {
            const initialData = { tasks: [], users: [], channels: {} };
            fs.writeFileSync(STORAGE_FILE, JSON.stringify(initialData, null, 2));
            return initialData;
        }
        return JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf8'));
    } catch (error) {
        console.error('Error reading storage:', error);
        return { tasks: [], users: [], channels: {} };
    }
}


function writeData(data) {
    try {
        fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error writing storage:', error);
        throw error;
    }
}

module.exports = { readData, writeData };
