/**
 * Stool - Review Product Remapper
 * This script performs a VLOOKUP-like operation to remap product IDs,
 * dynamically unnests custom question data from a JSON column,
 * removes specified columns, and provides a downloadable result.
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

setupFileInput('remapping', remappingFileInput, remappingDropZone);
setupFileInput('reviews', reviewsFileInput, reviewsDropZone);

// --- 4. CORE FUNCTIONS ---

/**
 * Main function to orchestrate the entire remapping and data transformation process.
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
        // --- STEP 1: Remap Product IDs ---
        const lookupMap = createLookupMap(remappingData);
        const { remappedReviews, notFoundCount } = remapProductIds(reviewsData, lookupMap);
        logToScreen(`Remapped ${remappedReviews.length - notFoundCount} product IDs.`);
        if (notFoundCount > 0) {
            logToScreen(`Warning: ${notFoundCount} unique product IDs from reviews file were not found. Check developer console (F12) for a list.`, true);
        }

        // --- STEP 2: Process Custom Questions (Column Z) ---
        const customQuestionsColumnIndex = 25; // Column Z
        const { uniqueCFHeaders, reviewsWithParsedCFs } = parseCustomQuestions(remappedReviews, customQuestionsColumnIndex);

        if (uniqueCFHeaders.length > 0) {
            logToScreen(`Found and processed ${uniqueCFHeaders.length} unique custom questions.`);
        } else {
            logToScreen("No custom question data found in Column Z.");
        }

        // --- STEP 3: Construct the Final CSV Data ---
        // Define original columns to remove (A, B, M, N, O, P, Q, W, and Z)
        // Note: Column C (index 2) is no longer removed.
        const originalIndicesToRemove = new Set([0, 1, 12, 13, 14, 15, 16, 22, customQuestionsColumnIndex]);
        
        // Create the new header row
        const finalHeader = reviewsHeader.filter((_, index) => !originalIndicesToRemove.has(index))
                                       .concat(uniqueCFHeaders);
        
        // Create the new data rows
        const finalData = reviewsWithParsedCFs.map(reviewItem => {
            const baseRow = reviewItem.rowData.filter((_, index) => !originalIndicesToRemove.has(index));
            const cfAnswers = uniqueCFHeaders.map(header => reviewItem.parsedCFs[header] || '');
            return baseRow.concat(cfAnswers);
        });

        logToScreen(`Cleaned and removed columns, and added new custom question columns.`);

        // --- STEP 4: Generate Download Link ---
        generateDownloadableFile([finalHeader, ...finalData]);
        logToScreen("\n--- PROCESS COMPLETE ---");
        logToScreen("✅ Output file is ready for download.");

    } catch (error) {
        logToScreen(`❌ CRITICAL ERROR: ${error.message}`, true);
        processBtn.disabled = false;
    }
}

/**
 * Creates a lookup map from the remapping data.
 * @param {Array} data - The remapping CSV data.
 * @returns {Map} A map of oldId -> newId.
 */
function createLookupMap(data) {
    const map = new Map();
    data.forEach(row => {
        const oldId = row[0]; // Column A
        const newId = row[4]; // Column E
        if (oldId && newId) {
            map.set(cleanString(oldId), newId.toString().trim());
        }
    });
    logToScreen(`Created lookup map with ${map.size} entries.`);
    return map;
}

/**
 * Remaps product IDs in the reviews data using the lookup map.
 * @param {Array} reviews - The original reviews data.
 * @param {Map} lookupMap - The map of oldId -> newId.
 * @returns {{remappedReviews: Array, notFoundCount: number}}
 */
function remapProductIds(reviews, lookupMap) {
    let notFoundSet = new Set();
    const productIdColumnIndex = 11; // Column L

    const remappedReviews = reviews.map(reviewRow => {
        const newRow = [...reviewRow];
        const oldProductId = newRow[productIdColumnIndex];
        
        if (oldProductId) {
            const lookupKey = cleanString(oldProductId);
            if (lookupMap.has(lookupKey)) {
                newRow[productIdColumnIndex] = lookupMap.get(lookupKey);
            } else if (!notFoundSet.has(oldProductId)) {
                console.warn(`ID not found in map: '${oldProductId}' (cleaned to '${lookupKey}')`);
                notFoundSet.add(oldProductId);
            }
        }
        return newRow;
    });

    return { remappedReviews, notFoundCount: notFoundSet.size };
}

/**
 * Parses JSON data from a specific column, extracts unique headers, and pairs answers.
 * @param {Array} reviews - The reviews data.
 * @param {number} columnIndex - The index of the column containing JSON.
 * @returns {{uniqueCFHeaders: string[], reviewsWithParsedCFs: Object[]}}
 */
function parseCustomQuestions(reviews, columnIndex) {
    const uniqueCFHeaders = new Set();
    const reviewsWithParsedCFs = reviews.map(rowData => {
        const cfCellData = rowData[columnIndex];
        let parsedCFs = {};
        if (cfCellData) {
            try {
                const parsed = JSON.parse(cfCellData);
                // Handle cases where the parsed data is an object
                if (typeof parsed === 'object' && parsed !== null) {
                    Object.keys(parsed).forEach(key => {
                        uniqueCFHeaders.add(key);
                        parsedCFs[key] = parsed[key];
                    });
                }
            } catch (e) {
                // Ignore cells that are not valid JSON
            }
        }
        return { rowData, parsedCFs };
    });

    return {
        uniqueCFHeaders: Array.from(uniqueCFHeaders).sort(), // Sort headers alphabetically
        reviewsWithParsedCFs,
    };
}


/**
 * Generates the final CSV file and makes it available for download.
 * @param {Array} data - The final data array (including header).
 */
function generateDownloadableFile(data) {
    const csvString = Papa.unparse(data);
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    downloadLink.href = url;
    downloadArea.classList.remove('hidden');
    processBtn.classList.add('hidden');
}


// --- 5. UI & UTILITY FUNCTIONS (Setup, Reset, Logging, etc.) ---

function setupFileInput(type, inputElement, dropZoneElement) {
    inputElement.addEventListener('change', (e) => {
        if (e.target.files.length) handleFile(e.target.files[0], type);
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
            handleFile(e.dataTransfer.files[0], type);
        }
    }, false);
}

function startOver() {
    remappingData = reviewsData = reviewsHeader = null;
    remappingFileInput.value = reviewsFileInput.value = '';
    
    remappingPrompt.classList.remove('hidden');
    remappingFileName.classList.add('hidden');
    remappingFileName.textContent = '';
    
    reviewsPrompt.classList.remove('hidden');
    reviewsFileName.classList.add('hidden');
    reviewsFileName.textContent = '';
    
    logOutput.value = '';
    processBtn.disabled = true;
    processBtn.classList.remove('hidden');
    logContainer.classList.add('hidden');
    downloadArea.classList.add('hidden');
}

function handleFile(file, type) {
    const promptElement = (type === 'remapping') ? remappingPrompt : reviewsPrompt;
    const fileNameElement = (type === 'remapping') ? remappingFileName : reviewsFileName;

    if (!file || !file.type.match('text/csv')) {
        return alert('Invalid file type. Please select a CSV file.');
    }

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

function checkEnableProcessButton() {
    if (remappingData && reviewsData) {
        processBtn.disabled = false;
        logToScreen("Both files loaded. Ready to process.");
    }
}

function cleanString(str) {
    if (typeof str !== 'string') return '';
    let cleaned = str.replace(/[\s\u00A0]+/g, '').toLowerCase();
    if (/^\d+$/.test(cleaned)) {
        cleaned = cleaned.replace(/^0+/, '');
    }
    return cleaned;
}

function logToScreen(message, isError = false) {
    const timestamp = new Date().toLocaleTimeString();
    logOutput.value += `[${timestamp}] ${message}\n`;
    if (isError) console.error(message);
    logOutput.scrollTop = logOutput.scrollHeight;
}

