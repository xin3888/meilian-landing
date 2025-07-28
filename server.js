const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件配置
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 速率限制
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15分钟
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 限制每个IP 100个请求
  message: '请求过于频繁，请稍后再试'
});
app.use('/api/', limiter);

// WhatsApp客户端初始化
let whatsappClient = null;
let qrCodeData = null;
let isClientReady = false;

// 初始化WhatsApp客户端
function initializeWhatsAppClient() {
  whatsappClient = new Client({
    authStrategy: new LocalAuth({
      clientId: process.env.WHATSAPP_CLIENT_ID || 'default-client'
    }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  whatsappClient.on('qr', async (qr) => {
    console.log('收到QR码');
    qrCodeData = await qrcode.toDataURL(qr);
  });

  whatsappClient.on('ready', () => {
    console.log('WhatsApp客户端已准备就绪');
    isClientReady = true;
    qrCodeData = null;
  });

  whatsappClient.on('authenticated', () => {
    console.log('WhatsApp客户端已认证');
  });

  whatsappClient.on('auth_failure', (msg) => {
    console.error('WhatsApp认证失败:', msg);
    isClientReady = false;
  });

  whatsappClient.on('disconnected', (reason) => {
    console.log('WhatsApp客户端断开连接:', reason);
    isClientReady = false;
  });

  whatsappClient.initialize();
}

// API路由

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    whatsappStatus: isClientReady ? 'connected' : 'disconnected'
  });
});

// 获取QR码
app.get('/api/qr', (req, res) => {
  if (isClientReady) {
    return res.json({ 
      status: 'already_authenticated',
      message: 'WhatsApp已认证，无需QR码'
    });
  }
  
  if (qrCodeData) {
    res.json({ 
      status: 'qr_ready',
      qr: qrCodeData
    });
  } else {
    res.json({ 
      status: 'generating_qr',
      message: '正在生成QR码，请稍后再试'
    });
  }
});

// 发送文本消息
app.post('/api/send-message', async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;

    if (!phoneNumber || !message) {
      return res.status(400).json({
        error: '缺少必要参数',
        required: ['phoneNumber', 'message']
      });
    }

    if (!isClientReady) {
      return res.status(503).json({
        error: 'WhatsApp客户端未准备就绪',
        message: '请先扫描QR码完成认证'
      });
    }

    // 格式化电话号码
    const formattedNumber = phoneNumber.replace(/\D/g, '');
    const chatId = `${formattedNumber}@c.us`;

    const result = await whatsappClient.sendMessage(chatId, message);
    
    res.json({
      success: true,
      messageId: result.id._serialized,
      timestamp: result.timestamp,
      status: 'sent'
    });

  } catch (error) {
    console.error('发送消息错误:', error);
    res.status(500).json({
      error: '发送消息失败',
      message: error.message
    });
  }
});

// 发送媒体消息
app.post('/api/send-media', async (req, res) => {
  try {
    const { phoneNumber, mediaUrl, caption } = req.body;

    if (!phoneNumber || !mediaUrl) {
      return res.status(400).json({
        error: '缺少必要参数',
        required: ['phoneNumber', 'mediaUrl']
      });
    }

    if (!isClientReady) {
      return res.status(503).json({
        error: 'WhatsApp客户端未准备就绪',
        message: '请先扫描QR码完成认证'
      });
    }

    const formattedNumber = phoneNumber.replace(/\D/g, '');
    const chatId = `${formattedNumber}@c.us`;

    const media = MessageMedia.fromUrl(mediaUrl);
    const result = await whatsappClient.sendMessage(chatId, media, { caption });

    res.json({
      success: true,
      messageId: result.id._serialized,
      timestamp: result.timestamp,
      status: 'sent'
    });

  } catch (error) {
    console.error('发送媒体消息错误:', error);
    res.status(500).json({
      error: '发送媒体消息失败',
      message: error.message
    });
  }
});

// 获取聊天列表
app.get('/api/chats', async (req, res) => {
  try {
    if (!isClientReady) {
      return res.status(503).json({
        error: 'WhatsApp客户端未准备就绪'
      });
    }

    const chats = await whatsappClient.getChats();
    const chatList = chats.map(chat => ({
      id: chat.id._serialized,
      name: chat.name,
      isGroup: chat.isGroup,
      lastMessage: chat.lastMessage ? {
        body: chat.lastMessage.body,
        timestamp: chat.lastMessage.timestamp
      } : null
    }));

    res.json({
      success: true,
      chats: chatList
    });

  } catch (error) {
    console.error('获取聊天列表错误:', error);
    res.status(500).json({
      error: '获取聊天列表失败',
      message: error.message
    });
  }
});

// 获取消息历史
app.get('/api/messages/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { limit = 50 } = req.query;

    if (!isClientReady) {
      return res.status(503).json({
        error: 'WhatsApp客户端未准备就绪'
      });
    }

    const chat = await whatsappClient.getChatById(chatId);
    const messages = await chat.fetchMessages({ limit: parseInt(limit) });

    const messageList = messages.map(msg => ({
      id: msg.id._serialized,
      body: msg.body,
      timestamp: msg.timestamp,
      fromMe: msg.fromMe,
      type: msg.type
    }));

    res.json({
      success: true,
      messages: messageList
    });

  } catch (error) {
    console.error('获取消息历史错误:', error);
    res.status(500).json({
      error: '获取消息历史失败',
      message: error.message
    });
  }
});

// 获取客户端状态
app.get('/api/status', (req, res) => {
  res.json({
    isReady: isClientReady,
    hasQR: !!qrCodeData,
    timestamp: new Date().toISOString()
  });
});

// 错误处理中间件
app.use((error, req, res, next) => {
  console.error('服务器错误:', error);
  res.status(500).json({
    error: '服务器内部错误',
    message: process.env.NODE_ENV === 'development' ? error.message : '请稍后再试'
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    error: '接口不存在',
    message: `路径 ${req.originalUrl} 不存在`
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`WhatsApp API服务器运行在端口 ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
  console.log(`获取QR码: http://localhost:${PORT}/api/qr`);
  
  // 初始化WhatsApp客户端
  initializeWhatsAppClient();
});

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('正在关闭服务器...');
  if (whatsappClient) {
    await whatsappClient.destroy();
  }
  process.exit(0);
});

module.exports = app;