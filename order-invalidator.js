/**
 * Stool - Order Invalidator (Batch Processing Version)
 * This script handles a two-step process:
 * 1. Generates a uToken using an App Key and Secret Key.
 * 2. Uses the token to invalidate a list of Order IDs in batches of 2500.
 * Now with full drag-and-drop and start over support.
 */

// --- 1. ELEMENT REFERENCES ---
const csvFileInput = document.getElementById('csvFileInput');
const fileNameSpan = document.getElementById('fileName');
const fileDropZone = document.getElementById('fileDropZone');
const filePrompt = document.getElementById('filePrompt');
const orderIdsInput = document.getElementById('orderIdsInput');
const appKeyInput = document.getElementById('appKeyInput');
const secretKeyInput = document.getElementById('secretKeyInput');
const invalidateBtn = document.getElementById('invalidateBtn');
const startOverBtn = document.getElementById('startOverBtn');
const progressArea = document.getElementById('progressArea');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const etrText = document.getElementById('etrText');
const logContainer = document.getElementById('logContainer');
const logOutput = document.getElementById('logOutput');

// --- 2. GLOBAL STATE & CONFIGURATION ---
let isProcessing = false;
let isCancelled = false;
const BATCH_SIZE = 5000;

// --- 3. EVENT LISTENERS ---
invalidateBtn.addEventListener('click', handleInvalidationClick);
startOverBtn.addEventListener('click', startOver);
setupFileInput(csvFileInput, fileDropZone);


/**
 * Handles the primary button click, starting or cancelling the process.
 */
function handleInvalidationClick() {
    if (isProcessing) {
        isCancelled = true;
        logToScreen('--- CANCELLATION REQUESTED ---', true);
    } else {
        startInvalidationProcess();
    }
}

/**
 * Resets the entire interface to its initial state.
 */
function startOver() {
    isProcessing = false;
    isCancelled = false;

    // Reset file input UI
    csvFileInput.value = '';
    filePrompt.classList.remove('hidden');
    fileNameSpan.classList.add('hidden');
    fileNameSpan.textContent = '';

    // Reset text inputs
    orderIdsInput.value = '';
    appKeyInput.value = '';
    secretKeyInput.value = '';

    // Reset controls
    [appKeyInput, secretKeyInput, orderIdsInput, csvFileInput, invalidateBtn].forEach(el => el.disabled = false);
    invalidateBtn.textContent = 'Generate Token & Start Invalidation';
    invalidateBtn.classList.remove('btn-danger');

    // Hide dynamic sections
    progressArea.classList.add('hidden');
    logContainer.classList.add('hidden');
    logOutput.value = '';
}

/**
 * The main orchestrator function that runs the entire invalidation process.
 */
async function startInvalidationProcess() {
    const appKey = appKeyInput.value.trim();
    const secretKey = secretKeyInput.value.trim();
    const allOrderIds = orderIdsInput.value.trim().split('\n').map(id => id.trim()).filter(id => id !== '');

    if (allOrderIds.length === 0) return alert('Please paste or import at least one Order ID.');
    if (!appKey || !secretKey) return alert('Please provide both an App Key and a Secret Key.');

    setupUIForProcessing(allOrderIds.length);

    try {
        const generatedUtoken = await generateUToken(appKey, secretKey);
        await invalidateOrdersInBatches(generatedUtoken, appKey, allOrderIds);
    } catch (error) {
        logToScreen(`❌ CRITICAL ERROR: ${error.message}`, true);
        logToScreen('Process stopped. Please check credentials and try again.');
    } finally {
        isProcessing = false;
        invalidateBtn.textContent = 'Finished';
        invalidateBtn.disabled = true;
    }
}

/**
 * Step 1: Fetches the uToken from the API.
 * @returns {Promise<string>} The generated uToken.
 */
async function generateUToken(appKey, secretKey) {
    logToScreen('Step 1: Generating uToken...');
    const endpoint = 'https://api.yotpo.com/oauth/token';
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            grant_type: 'client_credentials',
            client_id: appKey,
            client_secret: secretKey,
        }),
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(`Token generation failed: ${data.error_description || response.statusText}`);
    }
    const uToken = data.access_token;
    if (!uToken) {
        throw new Error('Token not found in authentication response.');
    }
    logToScreen('✅ Step 1: Success! uToken generated.');
    return uToken;
}

/**
 * Step 2: Splits IDs into chunks and invalidates them batch by batch.
 */
async function invalidateOrdersInBatches(uToken, appKey, allOrderIds) {
    logToScreen(`Step 2: Starting invalidation for ${allOrderIds.length} orders in batches of ${BATCH_SIZE}...`);
    
    const orderIdChunks = chunkArray(allOrderIds, BATCH_SIZE);
    let totalSuccessCount = 0;
    let totalFailCount = 0;
    let processedIdCount = 0;
    const totalIds = allOrderIds.length;
    const startTime = Date.now();
    const endpoint = `https://api.yotpo.com/apps/${appKey}/purchases`;

    for (let i = 0; i < orderIdChunks.length; i++) {
        if (isCancelled) {
            logToScreen('Process cancelled by user.', true);
            break;
        }

        const batch = orderIdChunks[i];
        const batchNumber = i + 1;
        logToScreen(`Processing Batch ${batchNumber}/${orderIdChunks.length}...`);

        const ordersPayload = batch.map(id => ({ order_id: id }));

        try {
            const response = await fetch(endpoint, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    utoken: uToken,
                    orders: ordersPayload,
                }),
            });

            if (response.status === 200 || response.status === 204) {
                logToScreen(`✅ SUCCESS: Batch ${batchNumber} invalidated successfully.`);
                totalSuccessCount += batch.length;
            } else {
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData.error || errorData.status?.message || `HTTP ${response.status}`;
                logToScreen(`FAILED: Batch ${batchNumber} - ${errorMessage}`, true);
                totalFailCount += batch.length;
            }
        } catch (networkError) {
            logToScreen(`FAILED: Batch ${batchNumber} - Network error: ${networkError.message}`, true);
            totalFailCount += batch.length;
        }
        
        processedIdCount += batch.length;
        updateProgressUI(processedIdCount, totalIds, startTime);
        await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit between batches
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logToScreen('--- PROCESSING COMPLETE ---');
    logToScreen(`Summary: ${totalSuccessCount} succeeded, ${totalFailCount} failed.`);
    logToScreen(`Total time: ${duration} seconds.`);
}


// --- 4. UI & UTILITY HELPER FUNCTIONS ---

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

function handleFile(file) {
    if (!file || !file.type.match('text/csv')) {
        return alert('Invalid file type. Please select a CSV file.');
    }

    filePrompt.classList.add('hidden');
    fileNameSpan.classList.remove('hidden');
    fileNameSpan.textContent = file.name;
    
    logOutput.value = '';
    logContainer.classList.remove('hidden');
    logToScreen(`Parsing ${file.name}...`);

    Papa.parse(file, {
        complete: (results) => {
            const parsedOrderIds = results.data.slice(1).map(row => row[0]).filter(id => id && id.trim() !== '');
            if (parsedOrderIds.length > 0) {
                orderIdsInput.value = parsedOrderIds.join('\n');
                logToScreen(`✅ Successfully imported ${parsedOrderIds.length} Order IDs.`);
            } else {
                logToScreen('Error: No valid Order IDs found in the CSV file.', true);
            }
        },
        error: (error) => logToScreen(`CSV Parsing Error: ${error.message}`, true),
    });
}

function chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

function setupUIForProcessing(totalOrders) {
    isProcessing = true;
    isCancelled = false;
    invalidateBtn.textContent = 'Cancel';
    invalidateBtn.classList.add('btn-danger');
    [appKeyInput, secretKeyInput, orderIdsInput, csvFileInput].forEach(el => el.disabled = true);
    progressArea.classList.remove('hidden');
    logContainer.classList.remove('hidden');
    progressBar.style.width = '0%';
    progressText.textContent = `0/${totalOrders} (0%)`;
    etrText.textContent = 'Est. time remaining: N/A';
    logOutput.value = '';
    logToScreen(`Starting process for ${totalOrders} orders...`);
}

function updateProgressUI(current, total, startTime) {
    const percentage = (current / total) * 100;
    progressBar.style.width = `${percentage}%`;
    progressText.textContent = `${current}/${total} (${Math.round(percentage)}%)`;
    const elapsedTime = Date.now() - startTime;
    const timePerItem = elapsedTime / current;
    const etrMs = (total - current) * timePerItem;
    etrText.textContent = `Est. time remaining: ${formatTime(etrMs)}`;
}

function logToScreen(message, isError = false) {
    const timestamp = new Date().toLocaleTimeString();
    logOutput.value += `[${timestamp}] ${message}\n`;
    if (isError) console.error(message);
    logOutput.scrollTop = logOutput.scrollHeight;
}

function formatTime(ms) {
    if (ms < 0 || !isFinite(ms)) return 'N/A';
    let seconds = Math.round(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    seconds %= 60;
    return `${minutes > 0 ? `${minutes}m ` : ''}${seconds}s`;

}
