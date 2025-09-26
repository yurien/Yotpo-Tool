/**
 * Stool - Custom Question Parser
 * This script unnests JSON data from a "Review Custom Questions" column in a CSV,
 * creates new columns for each unique question, and provides a downloadable result.
 */

// --- 1. ELEMENT REFERENCES ---
const csvFileInput = document.getElementById('csvFileInput');
const fileNameSpan = document.getElementById('fileName');
const fileDropZone = document.getElementById('fileDropZone');
const filePrompt = document.getElementById('filePrompt');
const processBtn = document.getElementById('processBtn');
const startOverBtn = document.getElementById('startOverBtn');
const controls = document.getElementById('controls');
const logContainer = document.getElementById('logContainer');
const logOutput = document.getElementById('logOutput');
const downloadArea = document.getElementById('downloadArea');
const downloadLink = document.getElementById('downloadLink');
const downloadFileNameInput = document.getElementById('downloadFileName');

// --- 2. GLOBAL STATE ---
let parsedData = null; // Will hold the array of objects from PapaParse
const TARGET_COLUMN_NAME = "Review Custom Questions";

// --- 3. EVENT LISTENERS & SETUP ---
processBtn.addEventListener('click', processFile);
startOverBtn.addEventListener('click', startOver);
downloadFileNameInput.addEventListener('input', () => {
    const fileName = downloadFileNameInput.value.trim();
    downloadLink.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
});

setupFileInput(csvFileInput, fileDropZone);

// --- 4. CORE FUNCTIONS ---

/**
 * Main function to orchestrate the data transformation process.
 */
function processFile() {
    if (!parsedData) {
        logToScreen("Error: No file data to process.", true);
        return;
    }

    logToScreen("\n--- Starting Process ---");
    processBtn.disabled = true;
    downloadArea.classList.add('hidden');

    try {
        // Step 1: Check if the target column exists. PapaParse gives us headers as keys.
        const originalHeader = Object.keys(parsedData[0]);
        if (!originalHeader.includes(TARGET_COLUMN_NAME)) {
            throw new Error(`Column "${TARGET_COLUMN_NAME}" not found in the uploaded file.`);
        }
        logToScreen(`Found target column "${TARGET_COLUMN_NAME}".`);

        // Step 2: First pass through data to find all unique custom question keys.
        const uniqueCFHeaders = new Set();
        parsedData.forEach(row => {
            const cfCellData = row[TARGET_COLUMN_NAME];
            if (cfCellData) {
                try {
                    const parsedJson = JSON.parse(cfCellData);
                    if (typeof parsedJson === 'object' && parsedJson !== null) {
                        Object.keys(parsedJson).forEach(key => uniqueCFHeaders.add(key));
                    }
                } catch (e) { /* Ignore invalid JSON */ }
            }
        });

        if (uniqueCFHeaders.size === 0) {
            logToScreen("Warning: No valid custom question data was found to expand.", true);
            // In this case, we'll just let the user download the original file without the target column.
        } else {
            logToScreen(`Found ${uniqueCFHeaders.size} unique custom questions to expand.`);
        }
        
        const newColumnHeaders = Array.from(uniqueCFHeaders).sort();

        // Step 3: Build the new expanded data set
        const finalData = parsedData.map(row => {
            const newRow = { ...row }; // Copy the original row object
            const cfCellData = newRow[TARGET_COLUMN_NAME];
            let parsedJson = {};

            if (cfCellData) {
                try {
                    parsedJson = JSON.parse(cfCellData);
                } catch (e) { parsedJson = {}; }
            }

            // Add the new columns with their corresponding answers
            newColumnHeaders.forEach(header => {
                newRow[header] = (parsedJson && parsedJson[header]) ? parsedJson[header] : '';
            });

            // Delete the original custom questions column
            delete newRow[TARGET_COLUMN_NAME];
            return newRow;
        });

        // Step 4: Generate download link
        generateDownloadableFile(finalData);
        logToScreen("\n--- PROCESS COMPLETE ---");
        logToScreen("✅ Output file is ready for download.");

    } catch (error) {
        logToScreen(`❌ CRITICAL ERROR: ${error.message}`, true);
        processBtn.disabled = false; // Re-enable on error
    }
}

/**
 * Generates the final CSV file and makes it available for download.
 * @param {Array<Object>} data - The final array of data objects.
 */
function generateDownloadableFile(data) {
    const csvString = Papa.unparse(data);
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    downloadLink.href = url;
    downloadArea.classList.remove('hidden');
    processBtn.classList.add('hidden');
}


// --- 5. UI & UTILITY FUNCTIONS ---

/**
 * Sets up both the standard file input and drag-and-drop functionality for a zone.
 */
function setupFileInput(inputElement, dropZoneElement) {
    inputElement.addEventListener('change', (e) => {
        if (e.target.files.length) handleFile(e.target.files[0]);
    });
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZoneElement.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, false);
    });
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZoneElement.addEventListener(eventName, () => dropZoneElement.classList.add('drop-zone--over'), false);
    });
    ['dragleave', 'drop'].forEach(eventName => {
        dropZoneElement.addEventListener(eventName, () => dropZoneElement.classList.remove('drop-zone--over'), false);
    });
    dropZoneElement.addEventListener('drop', (e) => {
        if (e.dataTransfer.files.length) {
            inputElement.files = e.dataTransfer.files;
            handleFile(e.dataTransfer.files[0]);
        }
    }, false);
}

/**
 * Resets the entire interface to its initial state.
 */
function startOver() {
    parsedData = null;
    originalHeader = null;
    csvFileInput.value = '';
    
    filePrompt.classList.remove('hidden');
    fileNameSpan.classList.add('hidden');
    fileNameSpan.textContent = '';
    
    logOutput.value = '';
    controls.classList.add('hidden');
    processBtn.disabled = true;
    processBtn.classList.remove('hidden');
    
    logContainer.classList.add('hidden');
    downloadArea.classList.add('hidden');
}

/**
 * Processes a single file and triggers parsing with headers.
 */
function handleFile(file) {
    if (!file || !file.type.match('text/csv')) {
        return alert('Invalid file type. Please select a CSV file.');
    }

    filePrompt.classList.add('hidden');
    fileNameSpan.classList.remove('hidden');
    fileNameSpan.textContent = file.name;
    
    logOutput.value = '';
    logContainer.classList.remove('hidden');
    controls.classList.remove('hidden');
    logToScreen(`Parsing ${file.name}...`);

    Papa.parse(file, {
        header: true, // IMPORTANT: Parse with headers to easily find the column
        skipEmptyLines: true,
        dynamicTyping: false,
        complete: (results) => {
            parsedData = results.data;
            originalHeader = results.meta.fields;
            logToScreen(`✅ Loaded ${parsedData.length} rows.`);
            processBtn.disabled = false;
        },
        error: (error) => logToScreen(`CSV Parsing Error: ${error.message}`, true),
    });
}

/**
 * Appends a timestamped message to the log area.
 */
function logToScreen(message, isError = false) {
    const timestamp = new Date().toLocaleTimeString();
    logOutput.value += `[${timestamp}] ${message}\n`;
    if (isError) console.error(message);
    logOutput.scrollTop = logOutput.scrollHeight;
}