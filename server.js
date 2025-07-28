const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// 存储用户和消息
let users = new Map();
let rooms = new Map();
let messages = new Map();

// 路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'advanced-chat.html'));
});

app.get('/basic', (req, res) => {
    res.sendFile(path.join(__dirname, 'chat-app.html'));
});

app.get('/api/users', (req, res) => {
    const userList = Array.from(users.values()).map(user => ({
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        online: true,
        lastSeen: user.lastSeen
    }));
    res.json(userList);
});

app.get('/api/messages/:roomId', (req, res) => {
    const roomId = req.params.roomId;
    const roomMessages = messages.get(roomId) || [];
    res.json(roomMessages);
});

// WebSocket 连接处理
io.on('connection', (socket) => {
    console.log('用户连接:', socket.id);

    // 用户加入
    socket.on('user:join', (userData) => {
        const user = {
            id: userData.id || socket.id,
            name: userData.name,
            avatar: userData.avatar,
            socketId: socket.id,
            lastSeen: new Date(),
            rooms: new Set()
        };
        
        users.set(socket.id, user);
        
        // 通知其他用户有新用户上线
        socket.broadcast.emit('user:online', {
            id: user.id,
            name: user.name,
            avatar: user.avatar
        });
        
        // 发送在线用户列表
        const onlineUsers = Array.from(users.values()).map(u => ({
            id: u.id,
            name: u.name,
            avatar: u.avatar,
            online: true
        }));
        
        socket.emit('users:list', onlineUsers);
    });

    // 加入聊天室
    socket.on('room:join', (roomId) => {
        socket.join(roomId);
        const user = users.get(socket.id);
        if (user) {
            user.rooms.add(roomId);
            
            // 发送房间历史消息
            const roomMessages = messages.get(roomId) || [];
            socket.emit('messages:history', { roomId, messages: roomMessages });
        }
    });

    // 发送消息
    socket.on('message:send', (data) => {
        const user = users.get(socket.id);
        if (!user) return;

        const message = {
            id: Date.now() + Math.random(),
            senderId: user.id,
            senderName: user.name,
            senderAvatar: user.avatar,
            text: data.text,
            timestamp: new Date(),
            type: data.type || 'text',
            roomId: data.roomId
        };

        // 保存消息
        if (!messages.has(data.roomId)) {
            messages.set(data.roomId, []);
        }
        messages.get(data.roomId).push(message);

        // 广播消息到房间
        io.to(data.roomId).emit('message:receive', message);
    });

    // 正在输入
    socket.on('typing:start', (data) => {
        const user = users.get(socket.id);
        if (user) {
            socket.to(data.roomId).emit('typing:start', {
                userId: user.id,
                userName: user.name
            });
        }
    });

    socket.on('typing:stop', (data) => {
        const user = users.get(socket.id);
        if (user) {
            socket.to(data.roomId).emit('typing:stop', {
                userId: user.id
            });
        }
    });

    // 文件上传
    socket.on('file:upload', (data) => {
        const user = users.get(socket.id);
        if (!user) return;

        const message = {
            id: Date.now() + Math.random(),
            senderId: user.id,
            senderName: user.name,
            senderAvatar: user.avatar,
            text: data.fileName,
            timestamp: new Date(),
            type: 'file',
            fileData: data.fileData,
            fileName: data.fileName,
            fileSize: data.fileSize,
            roomId: data.roomId
        };

        // 保存消息
        if (!messages.has(data.roomId)) {
            messages.set(data.roomId, []);
        }
        messages.get(data.roomId).push(message);

        // 广播文件消息
        io.to(data.roomId).emit('message:receive', message);
    });

    // 用户断开连接
    socket.on('disconnect', () => {
        const user = users.get(socket.id);
        if (user) {
            console.log('用户断开连接:', user.name);
            
            // 通知其他用户该用户离线
            socket.broadcast.emit('user:offline', {
                id: user.id,
                lastSeen: new Date()
            });
            
            users.delete(socket.id);
        }
    });

    // 错误处理
    socket.on('error', (error) => {
        console.error('Socket错误:', error);
    });
});

// 定期清理旧消息（可选）
setInterval(() => {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    for (let [roomId, roomMessages] of messages.entries()) {
        const filteredMessages = roomMessages.filter(msg => 
            new Date(msg.timestamp) > oneWeekAgo
        );
        messages.set(roomId, filteredMessages);
    }
}, 24 * 60 * 60 * 1000); // 每天运行一次

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
    console.log(`访问 http://localhost:${PORT} 开始聊天`);
});

module.exports = { app, server, io };