const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// WhatsApp API Configuration
const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

// Webhook verification endpoint
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

// Webhook for receiving messages
app.post('/webhook', async (req, res) => {
    const body = req.body;

    if (body.object) {
        if (body.entry && 
            body.entry[0].changes && 
            body.entry[0].changes[0] && 
            body.entry[0].changes[0].value.messages && 
            body.entry[0].changes[0].value.messages[0]) {
            
            const message = body.entry[0].changes[0].value.messages[0];
            const from = message.from; // sender phone number
            const msgBody = message.text.body; // message content
            
            console.log(`Received message from ${from}: ${msgBody}`);
            
            // Auto-reply
            await sendMessage(from, `您好！我收到了您的消息："${msgBody}"。这是自动回复。`);
        }
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
});

// Send message function
async function sendMessage(to, message) {
    try {
        const response = await axios.post(
            `${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`,
            {
                messaging_product: 'whatsapp',
                to: to,
                type: 'text',
                text: {
                    body: message
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log('Message sent successfully:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error sending message:', error.response?.data || error.message);
        throw error;
    }
}

// API endpoint to send messages
app.post('/api/send-message', async (req, res) => {
    const { to, message } = req.body;
    
    if (!to || !message) {
        return res.status(400).json({ error: 'Phone number and message are required' });
    }
    
    try {
        const result = await sendMessage(to, message);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ error: 'Failed to send message', details: error.message });
    }
});

// Send template message
app.post('/api/send-template', async (req, res) => {
    const { to, templateName, languageCode = 'en' } = req.body;
    
    try {
        const response = await axios.post(
            `${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`,
            {
                messaging_product: 'whatsapp',
                to: to,
                type: 'template',
                template: {
                    name: templateName,
                    language: {
                        code: languageCode
                    }
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        res.json({ success: true, data: response.data });
    } catch (error) {
        res.status(500).json({ error: 'Failed to send template message', details: error.response?.data || error.message });
    }
});

// Get message status
app.get('/api/message-status/:messageId', async (req, res) => {
    const { messageId } = req.params;
    
    try {
        const response = await axios.get(
            `${WHATSAPP_API_URL}/${messageId}`,
            {
                headers: {
                    'Authorization': `Bearer ${ACCESS_TOKEN}`
                }
            }
        );
        res.json({ success: true, data: response.data });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get message status', details: error.response?.data || error.message });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'WhatsApp API Integration is running' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Webhook URL: ${process.env.WEBHOOK_URL || `http://localhost:${PORT}/webhook`}`);
});