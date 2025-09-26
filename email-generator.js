// --- 1. ELEMENT REFERENCES ---
const generateBtn = document.getElementById('generateBtn');
const emailCountInput = document.getElementById('emailCount');
const emailOutput = document.getElementById('emailOutput');
const domainSelector = document.getElementById('domainSelector');

// --- 2. EVENT LISTENERS ---
generateBtn.addEventListener('click', generateEmails);
emailCountInput.addEventListener('keyup', (event) => {
    if (event.key === 'Enter') {
        generateEmails();
    }
});

// --- 3. CORE FUNCTIONS ---

/**
 * Generates a random alphanumeric string of a given length.
 * @param {number} length - The desired length of the string.
 * @returns {string} The randomly generated string.
 */
function generateRandomString(length) {
    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

/**
 * Main function to generate and display the list of dummy emails.
 */
function generateEmails() {
    const count = parseInt(emailCountInput.value, 10);
    const selectedDomain = domainSelector.value;

    if (isNaN(count) || count <= 0) {
        alert('Please enter a valid positive number.');
        return;
    }

    const randomDomains = ['example.com', 'mail.net', 'test.org', 'dummy.io', 'gmail.com', 'yahoo.com'];
    let generatedEmails = [];

    for (let i = 0; i < count; i++) {
        const usernameLength = Math.floor(Math.random() * 5) + 8; // 8-12 characters
        const username = generateRandomString(usernameLength);
        
        const domain = (selectedDomain === 'random')
            ? randomDomains[Math.floor(Math.random() * randomDomains.length)]
            : selectedDomain;

        generatedEmails.push(`${username}@${domain}`);
    }

    emailOutput.value = generatedEmails.join('\n');
}