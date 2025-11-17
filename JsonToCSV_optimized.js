const fs = require('fs');
const path = require('path');

// -------- CONFIG --------
const INPUT_FILE = process.argv[2] || "southern.json";
const OUTPUT_CSV = "output.csv";
const BAD_LINES = "bad_lines.log";
// -------- EXTRACTION CONFIG --------
const KEY_1 = "ContentEntityId";
const KEY_2 = "Notes";
// ------------------------------------

function extractRows(jsonArray) {
    const rows = [];

    // Handle if input is array or single object
    const objects = Array.isArray(jsonArray) ? jsonArray : [jsonArray];

    for (const obj of objects) {
        // Extract from Legs array (main structure)
        if (obj.Legs && Array.isArray(obj.Legs)) {
            for (const leg of obj.Legs) {
                const id = leg.ContentEntityId;
                if (!leg.Periods || !Array.isArray(leg.Periods)) continue;

                for (const period of leg.Periods) {
                    if (period.Notes && period.Notes.trim() !== "") {
                        // Remove HTML tags and normalize whitespace
                        let notes = period.Notes
                            .replace(/<[^>]*>/g, "")           // Remove HTML tags
                            .replace(/\n/g, " ")               // Replace newlines with space
                            .replace(/&quot;/g, '"')            // Unescape quotes
                            .replace(/&amp;/g, "&")             // Unescape ampersand
                            .replace(/&apos;/g, "'")            // Unescape apostrophe
                            .replace(/&#39;/g, "'")             // Unescape numeric apostrophe
                            .replace(/&#(\d+);/g, (m, dec) => String.fromCharCode(dec)) // Decode numeric entities
                            .replace(/&\w+;/g, "")              // Remove remaining unknown entities
                            .replace(/\s+/g, " ")               // Collapse multiple spaces
                            .trim();

                        rows.push({
                            [KEY_1]: id,
                            [KEY_2]: notes
                        });
                    }
                }
            }
        }
    }

    return rows;
}

async function processFile() {
    if (!fs.existsSync(INPUT_FILE)) {
        console.error(`❌ Error: Input file "${INPUT_FILE}" not found!`);
        process.exit(1);
    }

    try {
        const fileStats = fs.statSync(INPUT_FILE);
        const fileSizeMB = (fileStats.size / 1024 / 1024).toFixed(2);

        console.log(`📂 Processing file: ${INPUT_FILE}`);
        console.log(`   File size: ${fileSizeMB} MB`);
        console.log(`   Reading JSON...`);

        // Read the entire file
        let rawData = fs.readFileSync(INPUT_FILE, 'utf-8');

        // Remove BOM if present
        if (rawData.charCodeAt(0) === 0xFEFF) {
            rawData = rawData.slice(1);
        }

        console.log(`   Parsing JSON...`);

        let jsonArray = [];

        try {
            // First try parsing as single complete JSON
            const parsed = JSON.parse(rawData);
            if (parsed.value && Array.isArray(parsed.value)) {
                jsonArray = parsed.value;
            } else if (Array.isArray(parsed)) {
                jsonArray = parsed;
            } else {
                jsonArray = [parsed];
            }
        } catch (e1) {
            // File may contain multiple JSON arrays (one per line)
            console.log(`   Detected multiple JSON arrays - parsing line by line...`);
            const lines = rawData.split('\n').filter(line => line.trim());

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                try {
                    const parsed = JSON.parse(line);

                    if (Array.isArray(parsed)) {
                        jsonArray.push(...parsed);
                    } else if (parsed.value && Array.isArray(parsed.value)) {
                        jsonArray.push(...parsed.value);
                    } else {
                        jsonArray.push(parsed);
                    }
                } catch (e2) {
                    console.warn(`   ⚠️  Skipped malformed line ${i + 1}`);
                }
            }
        }

        console.log(`   Extracting data from ${jsonArray.length} object(s)...`);
        let rows = extractRows(jsonArray);

        // Write CSV
        console.log(`   Writing CSV...`);
        fs.writeFileSync(OUTPUT_CSV, `${KEY_1},${KEY_2}\n`);
        fs.writeFileSync(BAD_LINES, "");

        const csvLines = rows.map(r => {
            const val1 = String(r[KEY_1]).replace(/"/g, '""');
            const val2 = String(r[KEY_2]).replace(/"/g, '""');
            return `"${val1}","${val2}"`;
        });

        if (csvLines.length > 0) {
            fs.appendFileSync(OUTPUT_CSV, csvLines.join("\n") + "\n");
        }

        console.log("\n✅ Processing Complete!");
        console.log(`   ✓ Total rows extracted: ${rows.length}`);
        console.log(`\n📄 Output: ${OUTPUT_CSV}`);

    } catch (err) {
        console.error("❌ Error:", err.message);
        fs.appendFileSync(BAD_LINES, `Error: ${err.message}\n`);
        process.exit(1);
    }
} processFile();
