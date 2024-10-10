import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai'
import 'dotenv/config';
import { Client } from 'tgkit';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_TOKEN)

const model = genAI.getGenerativeModel({
	model: "gemini-1.5-flash",
	safetySettings: [{
		category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
		threshold: HarmBlockThreshold.BLOCK_NONE
	}, {
		category: HarmCategory.HARM_CATEGORY_HARASSMENT,
		threshold: HarmBlockThreshold.BLOCK_NONE
	}, {
		category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
		threshold: HarmBlockThreshold.BLOCK_NONE
	}, {
		category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
		threshold: HarmBlockThreshold.BLOCK_NONE
	}]
})

const generationConfig = {
	temperature: 0.8,
	topP: 0.95,
	topK: 64,
	maxOutputTokens: 8192
}

let chatSession = model.startChat({
	generationConfig
})

const bot = new Client({
	token: process.env.TELEGRAM_BOT_TOKEN
});

bot.on('ready', () => {
	console.log('Bot is ready');
});

bot.on('message', async (message) => {
	const result = await chatSession.sendMessage(message.text)
	const resp = result.response.text()
	message.chat.sendMessage(resp)
})

bot.polling.start()
