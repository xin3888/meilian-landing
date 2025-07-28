# WhatsApp Business API 集成系统

这是一个完整的WhatsApp Business API集成解决方案，提供了发送消息、接收消息、模板消息等功能。

## 功能特点

- ✅ **发送文本消息** - 向任何WhatsApp号码发送消息
- ✅ **发送模板消息** - 使用预定义的消息模板
- ✅ **接收消息** - 通过Webhook接收并自动回复消息
- ✅ **Web管理界面** - 美观的管理界面，实时查看消息状态
- ✅ **系统健康检查** - 监控API连接状态
- ✅ **消息历史记录** - 查看最近的消息记录

## 前置要求

1. **WhatsApp Business账号**
2. **Facebook开发者账号**
3. **Node.js** (v14或更高版本)
4. **公网可访问的服务器** (用于Webhook)

## 快速开始

### 1. 获取WhatsApp API凭证

1. 访问 [Facebook开发者平台](https://developers.facebook.com/)
2. 创建一个应用并添加WhatsApp产品
3. 获取以下信息：
   - Phone Number ID
   - Access Token
   - Webhook Verify Token

### 2. 安装项目

```bash
# 克隆或下载项目
cd whatsapp-api-integration

# 安装依赖
npm install

# 复制环境变量文件
cp .env.example .env
```

### 3. 配置环境变量

编辑 `.env` 文件，填入您的API凭证：

```env
WHATSAPP_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_PHONE_NUMBER_ID=您的电话号码ID
WHATSAPP_ACCESS_TOKEN=您的访问令牌
WHATSAPP_VERIFY_TOKEN=您的Webhook验证令牌
PORT=3000
WEBHOOK_URL=https://您的域名.com/webhook
```

### 4. 启动服务

```bash
# 生产环境
npm start

# 开发环境（自动重启）
npm run dev
```

### 5. 配置Webhook

在Facebook开发者平台中：
1. 进入WhatsApp > 配置
2. 设置Webhook URL为: `https://您的域名.com/webhook`
3. 设置验证令牌为您在 `.env` 中设置的值
4. 订阅消息事件

## API端点

### 发送文本消息
```http
POST /api/send-message
Content-Type: application/json

{
  "to": "8613812345678",
  "message": "您好，这是一条测试消息"
}
```

### 发送模板消息
```http
POST /api/send-template
Content-Type: application/json

{
  "to": "8613812345678",
  "templateName": "hello_world",
  "languageCode": "zh_CN"
}
```

### 健康检查
```http
GET /health
```

### Webhook端点
```http
GET /webhook  # 用于验证
POST /webhook # 接收消息
```

## 使用Web界面

1. 打开浏览器访问 `http://localhost:3000`
2. 使用界面发送消息和管理系统

## 注意事项

1. **电话号码格式**：必须包含国家代码，不要加"+"号
   - ✅ 正确: `8613812345678`
   - ❌ 错误: `+8613812345678` 或 `13812345678`

2. **模板消息**：需要先在Facebook Business Manager中创建并审核通过

3. **Webhook安全**：建议使用HTTPS并验证请求签名

4. **速率限制**：请遵守WhatsApp API的速率限制规定

## 常见问题

### Q: 为什么消息发送失败？
A: 检查以下几点：
- Access Token是否有效
- Phone Number ID是否正确
- 接收方号码格式是否正确
- 是否超过API速率限制

### Q: Webhook无法验证？
A: 确保：
- Webhook URL可以公网访问
- Verify Token与配置的一致
- 服务器正在运行

### Q: 如何获取更多消息类型支持？
A: 可以扩展 `server.js` 添加：
- 图片消息
- 文件消息
- 位置消息
- 联系人卡片等

## 部署建议

1. **使用HTTPS**：生产环境必须使用HTTPS
2. **使用进程管理器**：如PM2管理Node.js进程
3. **设置日志**：记录所有API调用和错误
4. **监控告警**：设置系统监控和告警

## 技术栈

- **后端**: Node.js + Express
- **前端**: 原生HTML/CSS/JavaScript
- **API**: WhatsApp Business API (Graph API)
- **样式**: 现代响应式设计

## 许可证

MIT License

## 支持

如有问题，请查阅 [WhatsApp Business API文档](https://developers.facebook.com/docs/whatsapp)