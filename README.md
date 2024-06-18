# discord-bot-for-trade-lib
This is a start from 0 to write the discord bot repository, the production is complete, by importing the discord server, you can achieve the purpose of searching the github repository content and generating download links to the discord.


制作步骤  
====
STEP1 设置开发环境
----
1. 安装Node.js：  

前往[Node.js](https://nodejs.org/en/download/package-manager)官网，下载并安装最新版本的Node.js。

2. 安装Discord.js：

打开终端或命令提示符，创建一个新的文件夹,然后进入该文件夹：  

**注意，在开始前，请注意终端的位置，将位置变动到你希望的位置再执行以下命令！！！**  


```bash
    mkdir discord-bot  
    cd discord-bot
```
mkdir 后应该是文档名字

初始化一个新的npm项目：

```bash
npm init -y
```

安装Discord.js库：
```bash
npm install discord.js
```


STEP2 创建Discord bot
----
1. 访问[Discord开发者](https://discord.com/developers/docs/intro)门户：


2. 创建一个新的bot

3. 获取bot的Token  

STEP3 编写bot代码
----
加入index.mjs  

STEP4 在终端中运行bot
```bash
node index.mjs
```

SEP5 邀请bot加入服务器
1. 在Discord开发者门户的“OAuth2”页面，选择“URL Generator”。
2. 在“Scopes”中勾选“bot”。
3. 在“Bot Permissions”中选择你希望授予Bot的权限（例如，“Send Messages”）。
4. 复制生成的URL，在浏览器中打开，选择你要邀请Bot加入的服务器