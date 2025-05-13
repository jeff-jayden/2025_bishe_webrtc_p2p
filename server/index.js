const WebSocket = require('ws');

// 创建WebSocket服务器
const server = new WebSocket.Server({ port: 9090 });

// 存储所有连接的客户端
const clients = new Map();

// 为每个新的WebSocket连接设置事件处理程序
server.on('connection', (socket) => {
    console.log('New client connected');

    // 为每个客户端生成一个唯一的ID
    const clientId = Date.now().toString();
    clients.set(clientId, socket);

    // 发送欢迎消息给客户端，包含其ID
    socket.send(JSON.stringify({ type: 'welcome', id: clientId }));

    // 处理来自客户端的消息
    socket.on('message', (message) => {
        console.log(`Received message from client ${clientId}: ${message}`);

        // 解析消息
        const data = JSON.parse(message);
        console.log("data", data.type);

        // 根据消息类型处理不同的操作
        switch (data.type) {
            case 'ready':
            case 'offer':
            case 'answer':
            case 'candidate':
                // 将消息转发给目标客户端  多个用户
                console.log("ready部分");

                const self = clients.get(clientId);
                const targetClients = clients.size;

                console.log(targetClients);
                console.log(JSON.parse(message));
                if (targetClients === 1) return;

                for (let [clientId, targetClient] of clients) {
                    if (targetClient !== self) {
                        targetClient.send(JSON.stringify(JSON.parse(message)));
                    }
                }
                break;
            case 'discover':
                // 处理客户端发现请求
                const discoveryMessage = JSON.stringify({
                    type: 'discovery',
                    clients: Array.from(clients.keys()).filter((id) => id !== clientId)
                });
                socket.send(discoveryMessage);
                break;
            default:
                console.log(`Unknown message type: ${data.type}`);
        }
    });

    // 处理客户端断开连接
    socket.on('close', () => {
        console.log(`Client ${clientId} disconnected`);
        clients.delete(clientId);
    });
});

console.log('Signaling server started on ws://localhost:9090');