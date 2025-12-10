const express = require('express');
const path = require('path');
// require('dotenv').config(); // ��� ���������, ������� �� Canvas, �� ���� �� �������� �����������

// ������������ Gemini API
// � Canvas API Key �������� ����������� ����� process.env,
// ��� ���� �� ��������� ��������, �� �� ���� � ������ GEMINI_API_KEY
const { GoogleGenAI } = require("@google/genai");
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const app = express();
const PORT = process.env.PORT || 3000;

// ������������ ��������� ������ (UTF-8)
app.use((req, res, next) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    next();
});

// ���������� Express ������� JSON ��� ������
app.use(express.json());

// �������, �� �������� ����� (index.html, script.js) ����������� � ����� public
app.use(express.static(path.join(__dirname, 'public')));


// --- ������� ��������� ������ �� ������ GEMINI ---
app.post('/api/process-text', async (req, res) => {
    // �������� userText (�������� �����������) �� persona � ��� ������
    const { userText, persona } = req.body;

    if (!userText) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.status(400).json({ error: 'Text not found for processing.' });
    }

    try {
        // 1. GENERATION (Gemini)
        // ������� �������� ���������� ��� ����� �� ����� ������ �������
        const systemPrompt = `You are "${persona}". Your task is to analyze the user's thought and provide a short, accurate answer in your style. 
        - Motivator: Motivate and support.
        - Philosopher: Encourage deep thought.
        - Sarcastic Self: Use irony and sharp humor.
        Maximum answer length: 30 words. Answer in English.`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: "user", parts: [{ text: userText }] }],
            config: {
                systemInstruction: systemPrompt,
                temperature: 0.7,
            },
        });

        const aiResponseText = response.text;

        // 2. ��������� ������� �볺��� (� UTF-8)
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.json({
            responseText: aiResponseText
        });

    } catch (error) {
        console.error('AI Error (Gemini):', error);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.status(500).json({
            error: 'AI Error: Could not generate response. Check your Gemini API key.',
            details: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`Inner Voice Server (Gemini) running on http://localhost:${PORT}`);
});