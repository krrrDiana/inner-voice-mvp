// Отримання елементів DOM
const recordButton = document.getElementById('recordButton');
const personaSelect = document.getElementById('persona');
const statusDiv = document.getElementById('status');
const transcribedText = document.getElementById('transcribedText');
const responseText = document.getElementById('responseText');
const historyList = document.getElementById('historyContainer'); // <--- ПЕРЕВІРКА: Правильно отримує контейнер історії

// Елементи для ручного введення
const manualToggleButton = document.getElementById('manualToggleButton');
const manualInputSection = document.getElementById('manualInputSection');
const textInput = document.getElementById('textInput');
const sendTextButton = document.getElementById('sendTextButton');
const templateButtonsContainer = document.getElementById('templateButtons');

let recognition; // Для Speech-to-Text (STT)
let chatHistory = []; // МАСИВ ДЛЯ ЗБЕРІГАННЯ КОНТЕКСТУ ДІАЛОГУ

// Перевірка підтримки Web Speech API
if (!('webkitSpeechRecognition' in window)) {
    statusDiv.textContent = "Error: Your browser does not support Web Speech Recognition. Try Chrome or Edge.";
    recordButton.disabled = true;
} else {
    // Ініціалізація STT
    recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US'; // *** Встановлення мови розпізнавання на англійську ***
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
}

// =========================================================================
// TTS FUNCTION (Використовує АНГЛІЙСЬКИЙ голос)
// =========================================================================
function speakResponse(text) {
    // Скасувати будь-яке попереднє мовлення
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;

    const setAndSpeak = () => {
        // Пошук АНГЛІЙСЬКОГО голосу ('en') для гарантованої роботи TTS
        const voices = speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'));

        if (voices.length > 0) {
            // Знайдено англійський голос
            utterance.voice = voices[0];
            utterance.lang = voices[0].lang;
            console.warn("Using English voice.");
        } else {
            // Резервний варіант: голос за замовчуванням
            utterance.lang = 'en-US';
            console.warn("English voice not found. Using default voice.");
        }

        // Відтворення тексту
        speechSynthesis.speak(utterance);
    };

    // Чекати, поки голоси завантажаться
    if (speechSynthesis.getVoices().length === 0) {
        speechSynthesis.onvoiceschanged = setAndSpeak;
    } else {
        setAndSpeak();
    }
}
// =========================================================================

/**
 * Очищає результати та історію чату.
 */
function clearResults() {
    speechSynthesis.cancel();
    transcribedText.textContent = '';
    responseText.textContent = '';

    // Очищення історії
    chatHistory = [];
    if (historyList) {
        // Залишаємо лише заголовок
        historyList.innerHTML = '<h3>Conversation History</h3>';
    }
}

/**
 * Додає елемент діалогу до контейнера історії.
 * ВИКОРИСТОВУЄТЬСЯ ДЛЯ ВІДОБРАЖЕННЯ
 * @param {string} role - "user" або "model".
 * @param {string} text - Текст діалогу.
 */
function displayHistoryItem(role, text) {
    if (!historyList) {
        console.error("History container not found! Check index.html ID.");
        return;
    }

    // Встановлення класів для стилізації (використовуючи класи з index.html)
    const roleClass = role === 'user' ? 'bg-blue-100 text-blue-800 self-end' : 'bg-green-100 text-green-800 self-start';
    const alignClass = role === 'user' ? 'text-right' : 'text-left';

    const itemDiv = document.createElement('div');
    itemDiv.className = `p-2 rounded-xl max-w-[90%] break-words ${roleClass} ${alignClass}`;

    // Додаємо мітку ролі та сам текст
    itemDiv.innerHTML = `<span class="font-bold text-xs capitalize">${role}:</span> ${text}`;

    const wrapper = document.createElement('div');
    // Використовуємо flex та justify-end/start для вирівнювання бульбашок
    wrapper.className = `flex ${role === 'user' ? 'justify-end' : 'justify-start'}`;
    wrapper.appendChild(itemDiv);

    historyList.appendChild(wrapper);
    // Прокручуємо до кінця
    historyList.scrollTop = historyList.scrollHeight;
}


// -------------------------------------------------------------------------
// STT / Voice Logic
// -------------------------------------------------------------------------

// Обробники подій STT
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


// Перемикання стану запису
recordButton.addEventListener('click', () => {
    // Припиняємо розмову лише якщо ми не в процесі обробки
    if (!recordButton.disabled) {
        clearResults();
    }

    if (recordButton.classList.contains('recording')) {
        // Припинити запис
        recognition.stop();
        recordButton.disabled = true;

    } else {
        // Запустити запис
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

// 1. Обробник перемикання ручного введення
manualToggleButton.addEventListener('click', () => {
    clearResults(); // Очищаємо результати та історію при перемиканні

    const isHidden = manualInputSection.style.display === 'none' || manualInputSection.style.display === '';

    if (isHidden) {
        // Показати секцію
        manualInputSection.style.display = 'block';
        manualToggleButton.textContent = 'Hide Manual Input';
        recordButton.style.display = 'none'; // Приховати кнопку запису
        statusDiv.textContent = 'Type your thought or select a template.';
    } else {
        // Приховати секцію
        manualInputSection.style.display = 'none';
        manualToggleButton.textContent = 'Type Manually (Text)';
        recordButton.style.display = 'inline-block'; // Показати кнопку запису
        statusDiv.textContent = 'Press "Start Recording" or "Type Manually" to begin.';
    }
});


// 2. Обробник кнопок-шаблонів
templateButtonsContainer.addEventListener('click', (event) => {
    const target = event.target;
    if (target.classList.contains('template-button')) {
        const templateText = target.getAttribute('data-template');
        textInput.value = templateText;
        textInput.focus();
        statusDiv.textContent = `Template selected. Finish your thought and click Send.`;
        // Автоматично відправляти не будемо
    }
});


// 3. Обробник кнопки відправки тексту
sendTextButton.addEventListener('click', () => {
    const text = textInput.value.trim();
    if (text) {
        transcribedText.textContent = text;
        sendTextToServer(text, personaSelect.value, 'manual');
        statusDiv.textContent = 'Text sent. Generating AI response...';
        sendTextButton.disabled = true;
        textInput.disabled = true;
    } else {
        statusDiv.textContent = 'Please enter text or select a template.';
    }
});

// -------------------------------------------------------------------------
// Server Communication Logic
// -------------------------------------------------------------------------

// Надсилання ТЕКСТУ до бекенду (Gemini)
async function sendTextToServer(text, persona, source) {
    if (text.length === 0) {
        statusDiv.textContent = 'Nothing was entered. Try again.';
        if (source === 'voice') {
            recordButton.disabled = false;
            recordButton.textContent = 'Start Recording (Voice)';
        }
        return;
    }

    // 1. Надсилаємо запит
    try {
        const response = await fetch('/api/process-text', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            // Надсилаємо userText, persona та поточну chatHistory
            body: JSON.stringify({
                userText: text,
                persona: persona,
                chatHistory: chatHistory
            })
        });

        const data = await response.json();

        if (!response.ok) {
            responseText.textContent = `Error: ${data.error || 'Unknown server error.'}`;
            statusDiv.textContent = 'Error. Check the console and your Gemini API key.';
            throw new Error(`Server returned an error: ${data.details || data.error}`);
        }

        // 2. ОНОВЛЕННЯ ІСТОРІЇ ТА ВІДОБРАЖЕННЯ

        // Додаємо запит користувача до історії (для API) та відображаємо у UI
        chatHistory.push({ role: "user", parts: [{ text: text }] });
        displayHistoryItem("user", text); // <--- ВИКЛИК ФУНКЦІЇ ДЛЯ UI

        // Додаємо відповідь моделі до історії (для API) та відображаємо у UI
        chatHistory.push({ role: "model", parts: [{ text: data.responseText }] });
        displayHistoryItem("model", data.responseText); // <--- ВИКЛИК ФУНКЦІЇ ДЛЯ UI


        // Відображаємо та відтворюємо результат у основних блоках
        responseText.textContent = data.responseText;
        speakResponse(data.responseText);
        statusDiv.textContent = 'Processing complete. Inner Voice Response:';

    } catch (error) {
        console.error('Error sending/receiving data:', error);
        statusDiv.textContent = 'An error occurred. Details in console.';
    } finally {
        // Відновлюємо стан елементів
        if (source === 'voice') {
            recordButton.textContent = 'Start Recording (Voice)';
            recordButton.disabled = false;
        } else if (source === 'manual') {
            sendTextButton.disabled = false;
            textInput.disabled = false;
            textInput.value = ''; // Очищаємо поле введення після відправки
        }
    }
}
