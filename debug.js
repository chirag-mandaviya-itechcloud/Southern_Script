const fs = require('fs');

let rawData = fs.readFileSync('southern.json', 'utf-8');
if (rawData.charCodeAt(0) === 0xFEFF) {
    rawData = rawData.slice(1);
}

console.log("File size:", rawData.length);
console.log("Characters around 30415:", JSON.stringify(rawData.substring(30410, 30420)));
console.log("First 200 chars:", rawData.substring(0, 200));
console.log("Last 200 chars:", rawData.substring(rawData.length - 200));
