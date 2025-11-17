import fs from 'fs';
import readline from 'readline';
import { jsonrepair } from 'jsonrepair';

const inputFilePath = 'southern.json';
const outputCsvPath = 'FinalCSV.csv';

// Function to create CSV file with headers
function createCsvFile(filePath, headers) {
    const headerLine = headers.join(',') + '\n';
    fs.writeFileSync(filePath, headerLine, 'utf8');
    console.log(`CSV file created at: ${filePath} with headers: ${headers.join(', ')}\n`);
}

// Function to append data to CSV file
function appendToCsv(filePath, data) {
    const row = data.join(',') + '\n';
    fs.appendFileSync(filePath, row, 'utf8');
}

let successCount = 0;
let failureCount = 0;

const legsIterateAndAppendToCsv = (legs) => {
    try {
        let contentEntityId = null;
        let notes = null;
        if (legs) {
            const legsToIterate = Array.isArray(legs) ? legs : [legs];
            legsToIterate.map(leg => {
                if (leg.ContentEntityId) {
                    contentEntityId = leg.ContentEntityId;
                }
                if (leg.Periods) {
                    leg.Periods.map(period => {
                        if (period.Notes) {
                            notes = period.Notes;
                            appendToCsv(outputCsvPath, [contentEntityId, notes]);
                            console.log(`Appended to CSV: ${contentEntityId}`);
                        }
                    })
                }
            })
        }
    } catch (err) {
        console.error("Error processing legs:", err);
    }
}


async function makeCsv(filePath) {
    // Initialize CSV file with headers
    const csvHeaders = ['ContentEntityId', 'Notes'];
    createCsvFile(outputCsvPath, csvHeaders);

    const fileStream = fs.createReadStream(filePath);

    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    console.log("Reading file line by line...\n");

    // let count = 1;

    for await (const line of rl) {
        let processedLine = line;
        let jsonData = null;
        let legs = null;

        try {
            // Check if line is valid JSON
            jsonData = JSON.parse(line);
            console.log("Valid JSON parsed");
            legs = jsonData[0].Legs;

            legsIterateAndAppendToCsv(legs);
            successCount++;
        } catch (error) {
            // If not valid JSON, append "}]}" to the line

            // processedLine = jsonrepair(line);
            // console.log("Repaired JSON", processedLine);
            processedLine = line + "\"}]}]";
            try {
                jsonData = JSON.parse(processedLine);
                legs = jsonData[0].Legs;
                console.log("Fixed malformed JSON and parsed");

                legsIterateAndAppendToCsv(legs);
                successCount++;
            } catch (retryError) {
                console.error(retryError);
                console.log("Failed to parse line:", line);
                console.log("Could not parse even after fix");
                console.log("\n----------------------------------\n");
                failureCount++;
                continue;
            }
        }

        console.log(`Success count: ${successCount}, Failure count: ${failureCount}`);

        // count++;

        console.log("\n----------------------------------\n");
    }

    console.log(`\nData appended to CSV file: ${outputCsvPath}`);
}

// Call function
makeCsv(inputFilePath);
