import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai'
import 'dotenv/config';
import { Client, ParseMode, ChatAction, InlineKeyboardButton, InlineKeyboardMarkup } from 'tgkit';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import credentials from './credentials.json' with { type: "json" };

const serviceAccountAuth = new JWT({
	email: credentials.client_email,
	key: credentials.private_key,
	scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
  
const doc = new GoogleSpreadsheet('1gzrfgyOu-GmT1AsokF3n06tJ3ECy2-n5KFNnISQT1wc', serviceAccountAuth);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_TOKEN)

const model = genAI.getGenerativeModel({
	model: "gemini-1.5-pro",
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
	maxOutputTokens: 4096
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
	if (!message.text) return

	if (message.text.startsWith('/start')) {
		message.chat.sendMessage('Добро пожаловать!')
		return
	}

	if (message.text.startsWith('/subscribe')) {
		const invoiceLink = await bot.rest.request('createInvoiceLink', {
			title: 'Timbot Premium',
			description: 'Подписка на улучшенные модели GPT',
			payload: 'premium',
			currency: 'XTR',
			prices: '[{"label": "Подписка на месяц", "amount": 1}]',
			subscription_period: 2592000
		})

		message.chat.sendMessage('Купить подписку:', {
			replyMarkup: new InlineKeyboardMarkup({
				inlineKeyboard: [[
					new InlineKeyboardButton({
						text: 'Купить',
						url: invoiceLink
					})
				]]
			})
		})
		return
	}

	try {
		await message.chat.sendChatAction(ChatAction.Typing)
		const result = await chatSession.sendMessage(message.text)
		const resp = result.response.text()
		let text = resp
			// .replace(/\!/g, '\\!')
			// .replace(/\./g, '\\.')
			// .replace(/\?/g, '\\?')
			// .replace(/\#/g, '\\#')
			// .replace(/\(/g, '\\(')
			// .replace(/\)/g, '\\)')
			// .replace(/\-/g, '\\-')
			// .replace(/\+/g, '\\+')
		await message.chat.sendMessage(text, {
			// parseMode: ParseMode.MarkdownV2
		})
	} catch (e) {
		console.error(e)
		message.chat.sendMessage('❌ Произошла ошибка')
	}
})

bot.on('preCheckoutQuery', async (query) => {
	bot.answerPreCheckoutQuery(query.id, true)
	await doc.loadInfo()
	const sheet = doc.sheetsByTitle['transactions']
	await sheet.addRow({
		userId: query.from.id,
		date: new Date().getTime()
	})
	const { transactions } = await bot.getStarTransactions({
	})
	await bot.refundStarPayment(transactions.at(-1).id)
})

bot.on('successfulPayment', async (payment) => {
	console.log(payment)
})

bot.polling.start()
