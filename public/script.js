// =========================================================================
//                  GLOBAL VARIABLES & DOM ELEMENTS
// =========================================================================

const recordButton = document.getElementById('recordButton');
const personaSelect = document.getElementById('persona');
const statusDiv = document.getElementById('status');
const transcribedText = document.getElementById('transcribedText');
const responseText = document.getElementById('responseText');

// �������� ��� ������� ��������
const manualToggleButton = document.getElementById('manualToggleButton');
const manualInputSection = document.getElementById('manualInputSection');
const textInput = document.getElementById('textInput');
const sendTextButton = document.getElementById('sendTextButton');
const templateButtonsContainer = document.getElementById('templateButtons');

// �������� ��� ����в�
const historyList = document.getElementById('historyList'); // DOM-������� <ul>
let queryHistory = []; // ����� ��� ��������� �����

let recognition; // For Speech-to-Text (STT)

// Check for Web Speech API support
if (!('webkitSpeechRecognition' in window)) {
    statusDiv.textContent = "Error: Your browser does not support Web Speech Recognition. Try Chrome or Edge.";
    recordButton.disabled = true;
} else {
    // Initialize STT
    recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US'; // *** SETTING RECOGNITION LANGUAGE TO ENGLISH ***
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
}

// =========================================================================
//                  HISTORY LOGIC (����� ����ֲ����)
// =========================================================================

/**
 * ��������� ������ � Local Storage ��� �������.
 */
function loadHistory() {
    const storedHistory = localStorage.getItem('innerVoiceHistory');
    if (storedHistory) {
        try {
            queryHistory = JSON.parse(storedHistory);
            renderHistory();
        } catch (e) {
            console.error("Error parsing history from Local Storage:", e);
            queryHistory = [];
        }
    }
}

/**
 * ������ ������� ������ � Local Storage.
 */
function saveHistory() {
    localStorage.setItem('innerVoiceHistory', JSON.stringify(queryHistory));
}

/**
 * ������� ������ ����� ������ � HTML.
 */
function renderHistory() {
    historyList.innerHTML = ''; // ������� �������� ������
    queryHistory.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = 'history-item';

        // ³��������� ����� 40 ������� ������ �� �������
        const displayQuery = item.query.substring(0, 40) + (item.query.length > 40 ? '...' : '');
        li.innerHTML = `<strong>${item.persona}</strong>: ${displayQuery}`;

        li.dataset.index = index; // �������� ������

        // �������� ��䳿 ��� ������������ ������� ������
        li.addEventListener('click', () => loadHistoricalQuery(index));

        historyList.appendChild(li); // ������ ��������
    });
}

/**
 * ���� ����� ����� �� �����, ������ �� ������� �����������.
 * @param {string} queryText - ����� ������ �����������.
 * @param {string} responseText - ³������ AI.
 * @param {string} persona - ������ �������.
 * @param {string} source - 'voice' ��� 'manual'.
 */
function addQueryToHistory(queryText, responseText, persona, source) {
    if (!queryText) return;

    const newEntry = {
        query: queryText,
        response: responseText,
        persona: persona,
        source: source,
        timestamp: new Date().toLocaleString()
    };

    // ������ ����� �� ������� ������ (��� ��������� ��� ������)
    queryHistory.unshift(newEntry);

    // �������� ������ (���������, 20 ������)
    if (queryHistory.length > 20) {
        queryHistory.pop();
    }

    saveHistory(); // �������� � Local Storage
    renderHistory(); // ��������� �����������
}

/**
 * ��������� �������� ���������� ����� ����� � ���������.
 * @param {number} index - ������ �������� � ����� queryHistory (0 - ���������).
 */
function loadHistoricalQuery(index) {
    const entry = queryHistory[index];
    if (!entry) return;

    // 1. ��������� �������� �����������
    transcribedText.textContent = entry.query;
    responseText.textContent = entry.response || 'No saved response for this query.';
    statusDiv.textContent = `Loaded history from ${entry.timestamp} (Persona: ${entry.persona}).`;

    // 2. ��������� ������� �������
    personaSelect.value = entry.persona;

    // 3. ��������� ������ ��������� ����������
    if (entry.source === 'manual' || manualInputSection.style.display === 'block') {
        manualInputSection.style.display = 'block';
        recordButton.style.display = 'none';
        manualToggleButton.textContent = 'Hide Manual Input';
        // ������� ���� �����
        textInput.value = '';
    } else {
        manualInputSection.style.display = 'none';
        recordButton.style.display = 'inline-block';
        manualToggleButton.textContent = 'Type Manually (Text)';
    }

    // ��������� TTS, ���� �� ������
    speechSynthesis.cancel();

    // 4. �������� �������
    if (entry.response) {
        speakResponse(entry.response);
    }
}

// =========================================================================
// TTS FUNCTION (Using ENGLISH voice)
// =========================================================================
function speakResponse(text) {
    // Cancel any previous speech
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;

    const setAndSpeak = () => {
        // Search for an ENGLISH voice ('en') for guaranteed TTS function
        const voices = speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'));

        if (voices.length > 0) {
            // Found an English voice
            utterance.voice = voices[0];
            utterance.lang = voices[0].lang;
            console.warn("Using English voice.");
        } else {
            // Fallback to default English voice
            utterance.lang = 'en-US';
            console.warn("English voice not found. Using default voice.");
        }

        // Speak the text
        speechSynthesis.speak(utterance);
    };

    // Wait for voices to load
    if (speechSynthesis.getVoices().length === 0) {
        speechSynthesis.onvoiceschanged = setAndSpeak;
    } else {
        setAndSpeak();
    }
}
// =========================================================================


// Clear results
function clearResults() {
    speechSynthesis.cancel();
    transcribedText.textContent = '';
    responseText.textContent = '';
}

// -------------------------------------------------------------------------
// STT / Voice Logic
// -------------------------------------------------------------------------

// STT event handlers
recognition.onresult = event => {
    const transcript = event.results[0][0].transcript;
    transcribedText.textContent = transcript;
    sendTextToServer(transcript, personaSelect.value, 'voice');
};
recognition.onerror = event => {
    if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        statusDiv.textContent = 'Error: Microphone access denied. Allow access in browser settings.';
    } else if (event.error === 'no-speech') {
        statusDiv.textContent = 'Error: No speech recognized. Try again.';
    } else {
        statusDiv.textContent = `Recognition error: ${event.error}`;
    }
    recordButton.textContent = 'Start Recording (Voice)';
    recordButton.classList.remove('recording');
    recordButton.disabled = false;
};

recognition.onend = () => {
    if (recordButton.classList.contains('recording')) {
        recordButton.textContent = 'Processing...';
        statusDiv.textContent = 'Transcription complete. Generating AI response...';
        recordButton.classList.remove('recording');
    }
};


// Toggle recording state
recordButton.addEventListener('click', () => {
    clearResults();

    if (recordButton.classList.contains('recording')) {
        // ��������� �����
        recognition.stop();
        recordButton.disabled = true;

    } else {
        // ��������� �����
        try {
            recognition.start();
            recordButton.textContent = 'Stop Listening';
            recordButton.classList.add('recording');
            statusDiv.textContent = 'Listening... Speak now.';

        } catch (error) {
            if (error.name !== 'InvalidStateError') {
                console.error('Error starting STT:', error);
            }
        }
    }
});


// -------------------------------------------------------------------------
// Manual Text Input Logic
// -------------------------------------------------------------------------

// 1. �������� ����������� ������� ��������
manualToggleButton.addEventListener('click', () => {
    clearResults(); // ������� ���������� ��� �����������

    const isHidden = manualInputSection.style.display === 'none' || manualInputSection.style.display === '';

    if (isHidden) {
        // �������� ������
        manualInputSection.style.display = 'block';
        manualToggleButton.textContent = 'Hide Manual Input';
        recordButton.style.display = 'none'; // ��������� ������ ������
        statusDiv.textContent = 'Type your thought or select a template.';
    } else {
        // ��������� ������
        manualInputSection.style.display = 'none';
        manualToggleButton.textContent = 'Type Manually (Text)';
        recordButton.style.display = 'inline-block'; // �������� ������ ������
        statusDiv.textContent = 'Press "Start Recording" or "Type Manually" to begin.';
    }
});


// 2. �������� ������-��������
templateButtonsContainer.addEventListener('click', (event) => {
    const target = event.target;
    if (target.classList.contains('template-button')) {
        const templateText = target.getAttribute('data-template');
        textInput.value = templateText;
        textInput.focus();
        statusDiv.textContent = `Template selected. Finish your thought and click Send.`;
    }
});


// 3. �������� ������ �������� ������
sendTextButton.addEventListener('click', () => {
    const text = textInput.value.trim();
    if (text) {
        transcribedText.textContent = text; // ³��������� �������� ����� �� "Your Thought"
        sendTextToServer(text, personaSelect.value, 'manual');
        statusDiv.textContent = 'Text sent. Generating AI response...';
        sendTextButton.disabled = true; // ������� ������, ���� ��� �������
        textInput.disabled = true;
    } else {
        statusDiv.textContent = 'Please enter text or select a template.';
    }
});

// -------------------------------------------------------------------------
// Server Communication Logic (� �������ֲ�� ����в�)
// -------------------------------------------------------------------------

// Send TEXT to the backend (Gemini)
async function sendTextToServer(text, persona, source) {
    if (text.length === 0) {
        statusDiv.textContent = 'Nothing was entered. Try again.';
        if (source === 'voice') {
            recordButton.disabled = false;
            recordButton.textContent = 'Start Recording (Voice)';
        }
        return;
    }

    let aiResponse = ''; // �������� ������� ���

    try {
        const response = await fetch('/api/process-text', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userText: text, persona: persona })
        });

        const data = await response.json();

        if (!response.ok) {
            aiResponse = `Error: ${data.error || 'Unknown server error.'}`;
            responseText.textContent = aiResponse;
            statusDiv.textContent = 'Error. Check the console and your Gemini API key.';
            throw new Error(`Server returned an error: ${data.details || data.error}`);
        }

        // Display and speak the results
        aiResponse = data.responseText;
        responseText.textContent = aiResponse;
        speakResponse(aiResponse); // Call the TTS function
        statusDiv.textContent = 'Processing complete. Inner Voice Response:';

    } catch (error) {
        console.error('Error sending/receiving data:', error);
        statusDiv.textContent = 'An error occurred. Details in console.';
        aiResponse = aiResponse || 'Failed to get a response.'; // ������������ �������, ����� ���� �� �������
    } finally {
        // *** ���в����� � ����в� ***
        addQueryToHistory(text, aiResponse, persona, source);

        // ³��������� ���� �������� �������� �� �������
        if (source === 'voice') {
            recordButton.textContent = 'Start Recording (Voice)';
            recordButton.disabled = false;
        } else if (source === 'manual') {
            sendTextButton.disabled = false;
            textInput.disabled = false;
            textInput.value = ''; // ������� ���� �����
        }
    }
}


// -------------------------------------------------------------------------
// INITIALIZATION
// -------------------------------------------------------------------------

// ������������ ����� ��� ������� ������������ �������
document.addEventListener('DOMContentLoaded', () => {
    loadHistory();
    // ����������, �� �������� ������ ��� �� �������������
    if (manualInputSection.style.display !== 'block') {
        manualInputSection.style.display = 'none'; // ����������� ��������� ������������
        recordButton.style.display = 'inline-block';
    } else {
        manualToggleButton.textContent = 'Hide Manual Input';
        recordButton.style.display = 'none';
    }

    if (!recordButton.disabled) {
        statusDiv.textContent = 'Press "Start Recording" or "Type Manually" to begin.';
    }
});