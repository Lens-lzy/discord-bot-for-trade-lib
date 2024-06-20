import { Client, GatewayIntentBits } from 'discord.js';
import express from 'express';
import fs from 'fs';
import http from 'http';
import fetch from 'node-fetch';

// 从config.json中读取token
const rawData = fs.readFileSync('config.json');
const config = JSON.parse(rawData);

// 从配置文件中读取token
const token = config.token;

// 初始化express应用
const app = express();
const PORT = process.env.PORT || 8080;

// 定义路由
app.get('/', (req, res) => {
  res.send('Hello, world!');
});

// 使用 Express 创建服务器并监听端口
const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// 初始化Discord客户端
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ] 
});

const GITHUB_REPO = 'Lens-lzy/trading-learning-lib';
const GITHUB_BRANCH = 'main';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/contents/Lib?ref=${GITHUB_BRANCH}`;

async function fetchBooks() {
    const response = await fetch(GITHUB_API_URL);
    const data = await response.json();
    const books = {};

    for (const file of data) {
        const fileName = decodeURIComponent(file.name);
        const bookName = fileName.replace(/_/g, ' ').replace(/\.[^/.]+$/, '');
        const longUrl = file.download_url;
        
        // 使用TinyURL API生成短链接
        const shortUrlResponse = await fetch(`https://tinyurl.com/api-create.php?url=${longUrl}`);
        const shortUrl = await shortUrlResponse.text();
        
        books[bookName] = { shortUrl, fileName };
    }

    return books;
}

client.once('ready', () => {
    console.log('Bot is online!');
});

client.on('messageCreate', async message => {
    if (message.content.startsWith('/book')) {
        const queryParts = message.content.split(' ').slice(1).join(' ').split('+');
        const books = await fetchBooks();
        let found = false;

        for (const bookName in books) {
            const lowerCaseBookName = bookName.toLowerCase();
            const isMatch = queryParts.every(part => lowerCaseBookName.includes(part.toLowerCase()));

            if (isMatch) {
                const { shortUrl, fileName } = books[bookName];
                message.channel.send(`🌟 哈哈！找到了！请点击以下蓝色字符下载：`);
                message.channel.send(`👉👉👉 [${fileName}](${shortUrl}) 👈👈👈`);
                message.channel.send(` 📮 有问题请联系 **奶牛猫** ,祝您阅读愉快~~~`);
                found = true;
                break;
            }
        }

        if (!found) {
            message.channel.send('没有找到这个书籍，请联系奶牛猫！');
        }
    }
});

// 使用从配置文件中读取的token登录
client.login(token);
