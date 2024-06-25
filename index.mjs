import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import express from 'express';
import http from 'http';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.DISCORD_TOKEN;
const githubToken = process.env.GITHUB_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

const app = express();
const PORT = process.env.PORT || 8080;

app.get('/', (req, res) => {
  res.send('Hello, world!');
});

const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const commands = [
  {
    name: 'book',
    description: 'Search for a book',
    options: [
      {
        name: 'keywords',
        type: 3,
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
        type: 3,
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

    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });

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
let downloadLinks = {};

async function fetchWithRetry(url, options = {}, retries = 3, delay = 1000, isText = false) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return isText ? await response.text() : await response.json();
    } catch (error) {
      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay));
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
    Authorization: `token ${githubToken}`,
  };
  const data = await fetchWithRetry(GITHUB_API_URL, { headers });
  const books = {};

  data.forEach((file) => {
    const fileName = file.name;
    const bookName = fileName.replace(/_/g, ' ').replace(/\.[^/.]+$/, '');
    const longUrl = file.download_url;

    books[bookName] = { longUrl, fileName };
  });

  cachedBooks = books;
  downloadLinks = books; // 缓存下载链接
  return books;
}

async function fetchReadme() {
  const headers = {
    Authorization: `token ${githubToken}`,
  };
  const data = await fetchWithRetry(GITHUB_API_README_URL, { headers });
  const content = Buffer.from(data.content, 'base64').toString('utf-8');
  return content;
}

function parseReadme(content) {
  const series = {};
  const lines = content.split('\n');
  let currentSeries = '';

  lines.forEach((line) => {
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

client.on('interactionCreate', async (interaction) => {
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
      const isMatch = keywords.every((part) => lowerCaseBookName.includes(part.toLowerCase()));

      if (isMatch) {
        const { longUrl, fileName } = books[bookName];
        await interaction.editReply(
          `🌟 哈哈！找到了！请点击以下蓝色字符下载：\n👉👉👉 [${fileName}](${longUrl}) 👈👈👈\n 📮 有问题请联系 **奶牛猫** ,祝您阅读愉快~~~`
        );
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
    const matchedSeries = Object.keys(series).filter((name) => name.toLowerCase().includes(seriesName));

    if (matchedSeries.length > 0) {
      let responseMessage = `📚 找到了这些属于系列 [${matchedSeries[0]}] 的书籍：\n\n`;
      series[matchedSeries[0]].forEach((book) => {
        responseMessage += `• ${book}\n`;
      });
      await interaction.editReply(responseMessage);
    } else {
      let availableSeries = '📚 我们目前有以下系列的书籍：\n';
      Object.keys(series).forEach((name) => {
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

    Object.keys(series).forEach((seriesName) => {
      responseMessage += `**${seriesName}**:\n`;
      series[seriesName].forEach((book) => {
        responseMessage += `• ${book}\n`;
      });
      responseMessage += '\n';
    });

    await interaction.editReply(responseMessage);
  }
});

client.login(token);
