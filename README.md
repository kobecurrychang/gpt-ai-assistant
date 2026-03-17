# GPT AI Assistant

<div align="center">

[![license](https://img.shields.io/pypi/l/ansicolortags.svg)](LICENSE) [![Release](https://img.shields.io/github/release/memochou1993/gpt-ai-assistant)](https://GitHub.com/memochou1993/gpt-ai-assistant/releases/)

</div>

GPT AI Assistant is an application that is implemented using the OpenAI API and LINE Messaging API. Through the installation process, you can start chatting with your own AI assistant using the LINE mobile app.

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- An [OpenAI](https://platform.openai.com/) account and API key
- A [LINE Developers](https://developers.line.biz/) account with a Messaging API channel

### Local Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/memochou1993/gpt-ai-assistant.git
   cd gpt-ai-assistant
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy the example environment file and fill in your credentials:

   ```bash
   cp .env.example .env
   ```

   Required variables in `.env`:

   | Variable | Description |
   |---|---|
   | `OPENAI_API_KEY` | Your OpenAI API key |
   | `LINE_CHANNEL_ACCESS_TOKEN` | LINE channel access token |
   | `LINE_CHANNEL_SECRET` | LINE channel secret |
   | `APP_URL` | Public URL of your deployed app (used as LINE webhook URL) |

4. Start the development server:

   ```bash
   npm run dev
   ```

   Or start in production mode:

   ```bash
   npm start
   ```

### Docker

```bash
cp .env.example .env
# Edit .env with your credentials
docker-compose up -d
```

### Deploy to Vercel

1. Fork this repository.
2. Import the project in [Vercel](https://vercel.com/).
3. Set the environment variables (`OPENAI_API_KEY`, `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`, `APP_URL`) in the Vercel project settings.
4. Deploy. After deployment, set the webhook URL in your LINE channel to `https://<your-vercel-domain>/webhook`.

## News

- 2023-03-05: The `4.1` version now support the audio message of LINE and  `whisper-1` language model of OpenAI. :fire:
- 2023-03-02: The `4.0` version now support `gpt-3.5-turbo` language model of OpenAI. :fire:

## Demo

<img src="/demo/labot.png" width="300"/>

## Documentations

- <a href="https://memochou1993.github.io/gpt-ai-assistant-docs/" target="_blank">中文</a>
- <a href="https://memochou1993.github.io/gpt-ai-assistant-docs/en" target="_blank">English</a>

## Credits

- [jayer95](https://github.com/jayer95) - Debugging and testing
- [kkdai](https://github.com/kkdai) - Idea of "sum" command
- [Dayu0815](https://github.com/Dayu0815) - Idea of "search" command
- [All other contributors](https://github.com/memochou1993/gpt-ai-assistant/graphs/contributors)

## Contact

If there is any question, please contact me at memochou1993@gmail.com. Thank you.

## Changelog

Detailed changes for each release are documented in the [release notes](https://github.com/memochou1993/gpt-ai-assistant/releases).

## License

[MIT](LICENSE)
