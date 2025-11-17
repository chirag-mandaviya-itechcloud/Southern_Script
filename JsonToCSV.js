const fs = require('fs');
const readline = require('readline');
const path = require('path');

// -------- CONFIG --------
const INPUT_FILE = process.argv[2] || "southern.json";  // Default to JSON file
const OUTPUT_CSV = "output.csv";
const BAD_LINES = "bad_lines.log";
// -------- EXTRACTION CONFIG --------
const KEY_1 = "ContentEntityId";    // First key to extract
const KEY_2 = "Notes";              // Second key to extract
// ------------------------------------

// Simple attempt to auto-fix JSON by balancing braces
function fixJsonString(str) {
    try {
        // Try removing common problematic patterns
        let cleaned = str.trim();

        // Remove trailing commas before closing braces/brackets
        cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

        let openCurly = (cleaned.match(/{/g) || []).length;
        let closeCurly = (cleaned.match(/}/g) || []).length;

        while (openCurly > closeCurly) {
            cleaned += "}";
            closeCurly++;
        }

        let openSquare = (cleaned.match(/\[/g) || []).length;
        let closeSquare = (cleaned.match(/]/g) || []).length;

        while (openSquare > closeSquare) {
            cleaned += "]";
            closeSquare++;
        }

        return cleaned;
    } catch (e) {
        return str;
    }
}

function extractRows(jsonObj) {
    const rows = [];

    // Handle array of objects (if file has multiple top-level objects)
    const objects = Array.isArray(jsonObj) ? jsonObj : [jsonObj];

    for (const obj of objects) {
        // If Legs exists, extract from there
        if (obj.Legs && Array.isArray(obj.Legs)) {
            for (const leg of obj.Legs) {
                const id = leg.ContentEntityId;
                if (!leg.Periods) continue;

                for (const p of leg.Periods) {
                    if (p.Notes && p.Notes.trim() !== "") {
                        rows.push({
                            [KEY_1]: id,
                            [KEY_2]: p.Notes.replace(/\n/g, " ").replace(/<[^>]*>/g, "").trim()
                        });
                    }
                }
            }
        }
        // If ItineraryLegs exists (old structure), extract from there
        else if (obj.ItineraryLegs && Array.isArray(obj.ItineraryLegs)) {
            for (const leg of obj.ItineraryLegs) {
                const id = leg.ContentEntityId;
                if (!leg.Periods) continue;

                for (const p of leg.Periods) {
                    if (p.Notes && p.Notes.trim() !== "") {
                        rows.push({
                            [KEY_1]: id,
                            [KEY_2]: p.Notes.replace(/\n/g, " ").replace(/<[^>]*>/g, "").trim()
                        });
                    }
                }
            }
        }
        // If direct keys exist, extract them
        else if (obj[KEY_1] && obj[KEY_2]) {
            rows.push({
                [KEY_1]: obj[KEY_1],
                [KEY_2]: String(obj[KEY_2]).replace(/\n/g, " ").replace(/<[^>]*>/g, "").trim()
            });
        }
    }

    return rows;
}

async function processFile() {
    // Validate input file exists
    if (!fs.existsSync(INPUT_FILE)) {
        console.error(`❌ Error: Input file "${INPUT_FILE}" not found!`);
        process.exit(1);
    }

    let successCount = 0;
    let errorCount = 0;
    const csvLines = [];

    // Write CSV header
    fs.writeFileSync(OUTPUT_CSV, `${KEY_1},${KEY_2}\n`);
    fs.writeFileSync(BAD_LINES, "");

    try {
        // Check if file is JSON or JSONL (lines of JSON)
        const fileExtension = path.extname(INPUT_FILE).toLowerCase();

        if (fileExtension === '.json') {
            // Single large JSON file
            console.log("📂 Detected single JSON file - reading entire file...");
            console.log(`   File size: ${(fs.statSync(INPUT_FILE).size / 1024 / 1024).toFixed(2)} MB`);
            let rawData = fs.readFileSync(INPUT_FILE, 'utf-8');
            
            // Remove BOM if present
            if (rawData.charCodeAt(0) === 0xFEFF) {
                rawData = rawData.slice(1);
            }

            try {
                const jsonObj = JSON.parse(rawData);
                let rows = extractRows(jsonObj);

                rows.forEach(r => {
                    const val1 = String(r[KEY_1]).replace(/"/g, '""');
                    const val2 = String(r[KEY_2]).replace(/"/g, '""');
                    csvLines.push(`"${val1}","${val2}"`);
                    successCount++;
                });

                console.log(`✓ Extracted ${successCount} rows from JSON`);
            } catch (err) {
                console.error("❌ Failed to parse JSON file:", err.message);
                errorCount++;
                fs.appendFileSync(BAD_LINES, `Failed to parse entire JSON file:\n${err.message}\n\n`);
            }
        } else {
            // Line-by-line JSON (JSONL format or txt with JSON lines)
            console.log("📂 Detected line-by-line format - processing line by line...");
            const rl = readline.createInterface({
                input: fs.createReadStream(INPUT_FILE),
                crlfDelay: Infinity
            });

            let lineCount = 0;
            for await (const line of rl) {
                lineCount++;
                if (!line.trim()) continue;

                let jsonLine = line.trim();
                let originalLine = jsonLine;

                try {
                    let json = JSON.parse(jsonLine);
                    let rows = extractRows(json);

                    rows.forEach(r => {
                        const val1 = String(r[KEY_1]).replace(/"/g, '""');
                        const val2 = String(r[KEY_2]).replace(/"/g, '""');
                        csvLines.push(`"${val1}","${val2}"`);
                        successCount++;
                    });

                } catch (err1) {
                    try {
                        jsonLine = fixJsonString(jsonLine);
                        let json = JSON.parse(jsonLine);
                        let rows = extractRows(json);

                        rows.forEach(r => {
                            const val1 = String(r[KEY_1]).replace(/"/g, '""');
                            const val2 = String(r[KEY_2]).replace(/"/g, '""');
                            csvLines.push(`"${val1}","${val2}"`);
                            successCount++;
                        });
                    } catch (err2) {
                        fs.appendFileSync(BAD_LINES, `Line ${lineCount}:\n${originalLine}\n\n`);
                        errorCount++;
                    }
                }
            }
        }

        // Write all CSV rows at once
        if (csvLines.length > 0) {
            fs.appendFileSync(OUTPUT_CSV, csvLines.join("\n") + "\n");
        }

        console.log("\n✅ Processing Complete!");
        console.log(`   ✓ Successfully extracted: ${successCount}`);
        console.log(`   ✗ Errors: ${errorCount}`);
        console.log(`\n📄 Output: ${OUTPUT_CSV}`);
        if (errorCount > 0) {
            console.log(`⚠️  Bad lines logged in: ${BAD_LINES}`);
        }
    } catch (err) {
        console.error("❌ Fatal error:", err.message);
        process.exit(1);
    }
}

processFile().catch(err => {
    console.error("❌ Fatal error:", err.message);
    process.exit(1);
});
