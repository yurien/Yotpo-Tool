// --- 1. ELEMENT REFERENCES ---
const inputText = document.getElementById('inputText');
const outputText = document.getElementById('outputText');
const joinBtn = document.getElementById('joinBtn');
const copyBtn = document.getElementById('copyBtn');
const clearBtn = document.getElementById('clearBtn');
const separatorInput = document.getElementById('separator');
const quoteTypeSelector = document.getElementById('quoteType');

// --- 2. EVENT LISTENERS ---
joinBtn.addEventListener('click', joinText);
copyBtn.addEventListener('click', copyToClipboard);
clearBtn.addEventListener('click', clearFields);

// --- 3. CORE FUNCTIONS ---

/**
 * The main function to process and join the text.
 */
function joinText() {
    const quoteType = quoteTypeSelector.value;
    const separator = separatorInput.value;

    const lines = inputText.value.split('\n')
        .map(line => line.trim())
        .filter(line => line !== '');

    const processedLines = lines.map(line => `${quoteType}${line}${quoteType}`);
    const result = processedLines.join(separator);
    outputText.value = result;
}

/**
 * Copies the result to the user's clipboard.
 */
async function copyToClipboard() {
    if (!outputText.value) return;
    try {
        await navigator.clipboard.writeText(outputText.value);
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = originalText; }, 1500);
    } catch (err) {
        console.error('Failed to copy text: ', err);
        alert('Failed to copy text.');
    }
}

/**
 * Clears both input and output textareas.
 */
function clearFields() {
    inputText.value = '';
    outputText.value = '';
}