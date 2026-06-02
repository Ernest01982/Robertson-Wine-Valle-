const express = require('express');
const router = express.Router();
const { GoogleGenAI } = require('@google/genai');

// Ensure GEMINI_API_KEY is set in your environment variables
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_INSTRUCTION = `You are the central routing engine for Project Vitis, an automated transactional WhatsApp interface for the Robertson Wine Valley.

Your sole objective is to interpret user input and output a strict JSON payload that determines whether to continue text support or trigger a native WhatsApp Flow interface (\`nfm_reply\`).

### CORE BUSINESS LAWS & PRICING
1. TICKETS: Base price varies by farm. A flat platform fee of R10.00 MUST be added to every ticket purchase. Paid by the consumer.
2. WINE PACKAGES: Base price varies by farm. A fee of R6.00 per R200 spent is applied. Settled by the farm (deducted from their net payout).
3. TRANSACTION OVERHEAD: A pass-through 2.95% gateway processing fee is calculated and layered onto the total checkout cost via the formula: Total = (Base + Fees) / (1 - 0.0295).

### CONVERSATIONAL STATE NAVIGATION
- STATE 0: Welcome / Root Greeting
- STATE 1: Ticket Selection Flow Trigger
- STATE 2: Wine Bundle Catalog Flow Trigger
- STATE 3: Checkout Processing State

### RESPONSE PROTOCOL
You must always reply in structured JSON matching this exact scheme:
{
  "current_state": "STATE_NUMBER",
  "action": "TEXT_REPLY" | "LAUNCH_FLOW",
  "flow_id": "RELEVANT_FLOW_ID_OR_NULL",
  "flow_payload": { ... },
  "text_response": "Friendly, direct South African hospitality greeting or fallback text if action is TEXT_REPLY"
}

If the user expresses intent to buy tickets, immediately transition to STATE 1, set action to LAUNCH_FLOW, and target flow_id "valley_tickets_v1".
If the user wants to buy wine, immediately transition to STATE 2, set action to LAUNCH_FLOW, and target flow_id "valley_wine_catalog_v1".`;

router.post('/api/vitis/webhook', async (req, res) => {
    try {
        const { message } = req.body; // Mocked payload extraction

        if (!message) {
            return res.status(400).json({ error: "No message provided" });
        }

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [
                {
                    role: 'user',
                    parts: [{ text: message }]
                }
            ],
            config: {
                thinkingConfig: {
                    thinkingLevel: "HIGH"
                },
                systemInstruction: SYSTEM_INSTRUCTION,
                responseMimeType: "application/json"
            }
        });

        // The AI output is expected to be JSON. Let's parse it safely.
        let jsonResponse;
        try {
            jsonResponse = JSON.parse(response.text);
        } catch (parseError) {
            console.error("Failed to parse AI output as JSON:", response.text);
            return res.status(500).json({ error: "AI returned invalid JSON format." });
        }

        // Return the structured JSON to the WhatsApp API integration (mocked here)
        return res.status(200).json(jsonResponse);

    } catch (error) {
        console.error("Webhook processing error:", error);
        return res.status(500).json({ status: "error", message: error.message });
    }
});

module.exports = router;
