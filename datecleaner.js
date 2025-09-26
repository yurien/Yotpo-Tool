// --- 1. ELEMENT REFERENCES ---
const inputText = document.getElementById('inputText');
const outputText = document.getElementById('outputText');
const cleanBtn = document.getElementById('cleanBtn');
const copyBtn = document.getElementById('copyBtn');
const clearBtn = document.getElementById('clearBtn');

// --- 2. EVENT LISTENERS ---
cleanBtn.addEventListener('click', cleanDates);
copyBtn.addEventListener('click', copyToClipboard);
clearBtn.addEventListener('click', clearFields);

// --- 3. CORE FUNCTIONS ---

const monthMap = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
};

/**
 * Converts a month name (e.g., "September" or "Sep") to its number.
 * @param {string} monthName - The name of the month.
 * @returns {string|null} The two-digit month number or null.
 */
function getMonthNumber(monthName) {
    if (!monthName) return null;
    const shortMonth = monthName.substring(0, 3).toLowerCase();
    return monthMap[shortMonth] || null;
}

/**
 * Parses a single date string using Regex to preserve the exact date.
 * @param {string} dateString - The raw date string.
 * @returns {string} The formatted date or an error message.
 */
function formatSingleDate(dateString) {
    const trimmedString = dateString.trim();
    if (trimmedString === '') return '';

    const patterns = [
        { regex: /(\w+)\s+(\d{1,2}),?\s+(\d{4})/, monthIndex: 1, dayIndex: 2, yearIndex: 3, isMonthName: true },
        { regex: /(\d{1,2})[-\s](\w+)[-\s](\d{4})/, dayIndex: 1, monthIndex: 2, yearIndex: 3, isMonthName: true },
        { regex: /(\d{4})[/-](\d{1,2})[/-](\d{1,2})/, yearIndex: 1, monthIndex: 2, dayIndex: 3 },
        { regex: /(\d{1,2})[/-](\d{1,2})[/-](\d{4})/, monthIndex: 1, dayIndex: 2, yearIndex: 3 }
    ];

    for (const pattern of patterns) {
        const match = pattern.regex.exec(trimmedString);
        if (match) {
            const year = match[pattern.yearIndex];
            const day = String(match[pattern.dayIndex]).padStart(2, '0');
            const month = pattern.isMonthName 
                ? getMonthNumber(match[pattern.monthIndex]) 
                : String(match[pattern.monthIndex]).padStart(2, '0');
            
            if (year && month && day) return `${year}-${month}-${day}`;
        }
    }
    
    return `${trimmedString} -> Invalid Format`;
}

/**
 * Main function to process the entire input text.
 */
function cleanDates() {
    const lines = inputText.value.split('\n');
    const processedLines = lines.map(formatSingleDate);
    outputText.value = processedLines.join('\n');
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