/**
 * Stool - Review Product Remapper
 * This script performs a VLOOKUP-like operation to remap product IDs in a reviews CSV,
 * removes specified columns, and provides a downloadable result.
 * Includes diagnostic logging to the console and drag-and-drop functionality.
 */

// --- 1. ELEMENT REFERENCES ---
const remappingFileInput = document.getElementById('remappingFileInput');
const remappingFileName = document.getElementById('remappingFileName');
const remappingDropZone = document.getElementById('remappingDropZone');
const remappingPrompt = document.getElementById('remappingPrompt');

const reviewsFileInput = document.getElementById('reviewsFileInput');
const reviewsFileName = document.getElementById('reviewsFileName');
const reviewsDropZone = document.getElementById('reviewsDropZone');
const reviewsPrompt = document.getElementById('reviewsPrompt');

const processBtn = document.getElementById('processBtn');
const logContainer = document.getElementById('logContainer');
const logOutput = document.getElementById('logOutput');
const downloadArea = document.getElementById('downloadArea');
const downloadLink = document.getElementById('downloadLink');
const downloadFileNameInput = document.getElementById('downloadFileName');
const startOverBtn = document.getElementById('startOverBtn');

// --- 2. GLOBAL STATE ---
let remappingData = null;
let reviewsData = null;
let reviewsHeader = null;

// --- 3. EVENT LISTENERS & SETUP ---
processBtn.addEventListener('click', processFiles);
startOverBtn.addEventListener('click', startOver);
downloadFileNameInput.addEventListener('input', () => {
    const fileName = downloadFileNameInput.value.trim();
    downloadLink.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
});

// Setup file inputs and drop zones for both sections
setupFileInput('remapping', remappingFileInput, remappingDropZone);
setupFileInput('reviews', reviewsFileInput, reviewsDropZone);


/**
 * Sets up both the standard file input and drag-and-drop functionality for a zone.
 * @param {string} type - 'remapping' or 'reviews'.
 * @param {HTMLElement} inputElement - The <input type="file"> element.
 * @param {HTMLElement} dropZoneElement - The div acting as the drop zone.
 */
function setupFileInput(type, inputElement, dropZoneElement) {
    // Handle file selection via the "Choose File" button
    inputElement.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFile(e.target.files[0], type);
        }
    });

    // Prevent default browser behavior for drag events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZoneElement.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, false);
    });

    // Add visual feedback for dragging over
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZoneElement.addEventListener(eventName, () => dropZoneElement.classList.add('drop-zone--over'), false);
    });

    // Remove visual feedback
    ['dragleave', 'drop'].forEach(eventName => {
        dropZoneElement.addEventListener(eventName, () => dropZoneElement.classList.remove('drop-zone--over'), false);
    });

    // Handle the file drop
    dropZoneElement.addEventListener('drop', (e) => {
        if (e.dataTransfer.files.length) {
            inputElement.files = e.dataTransfer.files; // Assign dropped file to the hidden input
            handleFile(e.dataTransfer.files[0], type);
        }
    }, false);
}


/**
 * Resets the entire interface to its initial state.
 */
function startOver() {
    // Reset state variables
    remappingData = null;
    reviewsData = null;
    reviewsHeader = null;

    // Reset file inputs to allow re-uploading the same file
    remappingFileInput.value = '';
    reviewsFileInput.value = '';
    
    // Reset Remapping Zone UI
    remappingPrompt.classList.remove('hidden');
    remappingFileName.classList.add('hidden');
    remappingFileName.textContent = '';
    
    // Reset Reviews Zone UI
    reviewsPrompt.classList.remove('hidden');
    reviewsFileName.classList.add('hidden');
    reviewsFileName.textContent = '';
    
    // Reset buttons and log/download areas
    logOutput.value = '';
    processBtn.disabled = true;
    processBtn.classList.remove('hidden');

    logContainer.classList.add('hidden');
    downloadArea.classList.add('hidden');
}


/**
 * Processes a single file (from either drop or input) and triggers parsing.
 * @param {File} file - The file to process.
 * @param {string} type - 'remapping' or 'reviews'.
 */
function handleFile(file, type) {
    const promptElement = (type === 'remapping') ? remappingPrompt : reviewsPrompt;
    const fileNameElement = (type === 'remapping') ? remappingFileName : reviewsFileName;

    if (!file || !file.type.match('text/csv')) {
        alert('Invalid file type. Please select a CSV file.');
        return;
    }

    // Update UI to show the selected file name
    promptElement.classList.add('hidden');
    fileNameElement.classList.remove('hidden');
    fileNameElement.textContent = file.name;
    
    logOutput.value = '';
    logContainer.classList.remove('hidden');
    logToScreen(`Parsing ${file.name}...`);

    Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        dynamicTyping: false,
        complete: (results) => {
            if (type === 'remapping') {
                if (results.data.length > 0) results.data.shift();
                remappingData = results.data;
                logToScreen(`✅ Loaded ${remappingData.length} mapping rows.`);
            } else {
                reviewsHeader = results.data.shift();
                reviewsData = results.data;
                logToScreen(`✅ Loaded ${reviewsData.length} reviews.`);
            }
            checkEnableProcessButton();
        },
        error: (error) => logToScreen(`CSV Parsing Error: ${error.message}`, true),
    });
}


/**
 * Enables the process button only when both files have been loaded.
 */
function checkEnableProcessButton() {
    if (remappingData && reviewsData) {
        processBtn.disabled = false;
        logToScreen("Both files loaded. Ready to process.");
    }
}

/**
 * A robust cleaning function to normalize product IDs for comparison.
 */
function cleanString(str) {
    if (typeof str !== 'string') return '';
    let cleaned = str.replace(/[\s\u00A0]+/g, '').toLowerCase();
    if (/^\d+$/.test(cleaned)) {
        cleaned = cleaned.replace(/^0+/, '');
    }
    return cleaned;
}

/**
 * Main function to orchestrate the remapping and cleaning process.
 */
function processFiles() {
    if (!remappingData || !reviewsData) {
        logToScreen("Error: Both files must be uploaded before processing.", true);
        return;
    }

    logToScreen("\n--- Starting Process ---");
    console.clear();
    processBtn.disabled = true;
    downloadArea.classList.add('hidden');

    try {
        const lookupMap = new Map();
        remappingData.forEach(row => {
            const oldId = row[0];
            const newId = row[4];
            if (oldId && newId) {
                lookupMap.set(cleanString(oldId), newId.toString().trim());
            }
        });
        logToScreen(`Created lookup map with ${lookupMap.size} entries.`);

        console.log("--- DIAGNOSTICS: Remapping Keys (Sample) ---");
        const mapKeys = Array.from(lookupMap.keys());
        for(let i = 0; i < Math.min(mapKeys.length, 5); i++) {
            console.log(`'${mapKeys[i]}'`);
        }
        console.log("------------------------------------");

        let remapCount = 0;
        let notFoundSet = new Set();
        const remappedReviews = reviewsData.map(reviewRow => {
            const newRow = [...reviewRow];
            const oldProductId = newRow[11]; // Column L
            if (oldProductId) {
                const lookupKey = cleanString(oldProductId);
                if (lookupMap.has(lookupKey)) {
                    newRow[11] = lookupMap.get(lookupKey);
                    remapCount++;
                } else {
                    if (!notFoundSet.has(oldProductId)) {
                        console.warn(`ID not found in map: '${oldProductId}' (cleaned to '${lookupKey}')`);
                        notFoundSet.add(oldProductId);
                    }
                }
            }
            return newRow;
        });

        logToScreen(`Remapped ${remapCount} product IDs in the reviews file.`);
        if (notFoundSet.size > 0) {
            logToScreen(`Warning: ${notFoundSet.size} unique product IDs from reviews file were not found. Check developer console (F12) for a list.`, true);
        }

        const indicesToRemove = new Set([0, 1, 12, 13, 14, 15, 16, 22]);
        const finalHeader = reviewsHeader.filter((_, index) => !indicesToRemove.has(index));
        const finalData = remappedReviews.map(row => row.filter((_, index) => !indicesToRemove.has(index)));
        logToScreen(`Cleaned and removed columns from ${finalData.length} rows.`);

        const finalCsvData = [finalHeader, ...finalData];
        const csvString = Papa.unparse(finalCsvData);
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        downloadLink.href = url;
        downloadArea.classList.remove('hidden');
        processBtn.classList.add('hidden');
        logToScreen("\n--- PROCESS COMPLETE ---");
        logToScreen("✅ Output file is ready for download.");

    } catch (error) {
        logToScreen(`❌ CRITICAL ERROR: ${error.message}`, true);
        processBtn.disabled = false;
    }
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