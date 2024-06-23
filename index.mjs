import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import express from 'express';
import fs from 'fs';
import http from 'http';
import fetch from 'node-fetch';

// 从config.json中读取token
const rawData = fs.readFileSync('config.json');
const config = JSON.parse(rawData);

// 从配置文件中读取token
const token = config.token;
const githubToken = config.github_token; // 添加 GitHub 个人访问令牌
const clientId = config.client_id; // 添加你的客户端ID
const guildId = config.guild_id; // 添加你的服务器ID

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

// 注册斜杠命令
const commands = [
  {
    name: 'book',
    description: 'Search for a book',
    options: [
      {
        name: 'keywords',
        type: 3, // 3 表示 STRING 类型
        description: 'The keywords to search for',
        required: true,
      },
    ],
  },
  {
    name: 'series',
    description: 'Search for a series',
    options: [
      {
        name: 'name',
        type: 3, // 3 表示 STRING 类型
        description: 'The name of the series',
        required: true,
      },
    ],
  },
  {
    name: 'lib',
    description: 'List all books in all series',
  },
];

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands },
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();

const GITHUB_REPO = 'Lens-lzy/trading-learning-lib';
const GITHUB_BRANCH = 'main';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/contents/Lib?ref=${GITHUB_BRANCH}`;
const GITHUB_API_README_URL = `https://api.github.com/repos/${GITHUB_REPO}/contents/README.md?ref=${GITHUB_BRANCH}`;

let cachedBooks = null;

async function fetchWithRetry(url, options = {}, retries = 3, delay = 1000, isText = false) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return isText ? await response.text() : await response.json();
        } catch (error) {
            if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            } else {
                throw error;
            }
        }
    }
}

async function fetchBooks() {
    if (cachedBooks) {
        return cachedBooks;
    }
    
    const headers = {
        'Authorization': `token ${githubToken}`
    };
    const data = await fetchWithRetry(GITHUB_API_URL, { headers });
    const books = {};

    const shortUrlPromises = data.map(async file => {
        const fileName = decodeURIComponent(file.name);
        const bookName = fileName.replace(/_/g, ' ').replace(/\.[^/.]+$/, '');
        const longUrl = file.download_url;
        
        // 使用TinyURL API生成短链接
        const shortUrl = await fetchWithRetry(`https://tinyurl.com/api-create.php?url=${longUrl}`, {}, 3, 1000, true);
        
        books[bookName] = { shortUrl, fileName };
    });

    await Promise.all(shortUrlPromises);
    cachedBooks = books;
    return books;
}

async function fetchReadme() {
    const headers = {
        'Authorization': `token ${githubToken}`
    };
    const data = await fetchWithRetry(GITHUB_API_README_URL, { headers });
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    return content;
}

function parseReadme(content) {
    const series = {};
    const lines = content.split('\n');
    let currentSeries = '';

    lines.forEach(line => {
        if (line.startsWith('### ')) {
            currentSeries = line.replace('### ', '').trim();
            series[currentSeries] = [];
        } else if (line.startsWith('|《')) {
            const book = line.split('|')[1].trim();
            if (currentSeries) {
                series[currentSeries].push(book);
            }
        }
    });

    return series;
}

client.once('ready', () => {
    console.log('Bot is online!');
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName, options } = interaction;

    if (commandName === 'book') {
        await interaction.deferReply(); // 确保响应互动

        const keywords = options.getString('keywords').split('+');
        let books;
        try {
            books = await fetchBooks();
        } catch (error) {
            console.error('Error fetching books:', error);
            await interaction.editReply('获取书籍时发生错误，请稍后重试。');
            return;
        }
        let found = false;

        for (const bookName in books) {
            const lowerCaseBookName = bookName.toLowerCase();
            const isMatch = keywords.every(part => lowerCaseBookName.includes(part.toLowerCase()));

            if (isMatch) {
                const { shortUrl, fileName } = books[bookName];
                await interaction.editReply(`🌟 哈哈！找到了！请点击以下蓝色字符下载：\n👉👉👉 [${fileName}](${shortUrl}) 👈👈👈\n 📮 有问题请联系 **奶牛猫** ,祝您阅读愉快~~~`);
                found = true;
                break;
            }
        }

        if (!found) {
            await interaction.editReply('没有找到这个书籍，请联系奶牛猫！');
        }
    } else if (commandName === 'series') {
        await interaction.deferReply(); // 确保响应互动

        const seriesName = options.getString('name').toLowerCase();
        let readmeContent;
        try {
            readmeContent = await fetchReadme();
        } catch (error) {
            console.error('Error fetching README:', error);
            await interaction.editReply('获取系列信息时发生错误，请稍后重试。');
            return;
        }
        const series = parseReadme(readmeContent);
        const matchedSeries = Object.keys(series).filter(name => name.toLowerCase().includes(seriesName));

        if (matchedSeries.length > 0) {
            let responseMessage = `📚 找到了这些属于系列 [${matchedSeries[0]}] 的书籍：\n\n`;
            series[matchedSeries[0]].forEach(book => {
                responseMessage += `• ${book}\n`;
            });
            await interaction.editReply(responseMessage);
        } else {
            let availableSeries = '📚 我们目前有以下系列的书籍：\n';
            Object.keys(series).forEach(name => {
                availableSeries += `• ${name}\n`;
            });
            await interaction.editReply(`没有找到这个系列的书籍。${availableSeries}`);
        }
    } else if (commandName === 'lib') {
        await interaction.deferReply(); // 确保响应互动

        let readmeContent;
        try {
            readmeContent = await fetchReadme();
        } catch (error) {
            console.error('Error fetching README:', error);
            await interaction.editReply('获取图书信息时发生错误，请稍后重试。');
            return;
        }
        const series = parseReadme(readmeContent);
        let responseMessage = `📚 我们目前有以下系列的书籍：\n\n`;

        Object.keys(series).forEach(seriesName => {
            responseMessage += `**${seriesName}**:\n`;
            series[seriesName].forEach(book => {
                responseMessage += `• ${book}\n`;
            });
            responseMessage += '\n';
        });

        await interaction.editReply(responseMessage);
    }
});

// 使用从配置文件中读取的token登录
client.login(token);
