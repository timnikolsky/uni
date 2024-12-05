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
	const hasPremium = await checkPremiumStatus(message.sender.id)

	if (message.text.startsWith('/start')) {
		message.chat.sendMessage('Добро пожаловать! Чтобы пообщаться с искуственным интеллектом, просто отправьте сообщение с запросом.')
		return
	}

	if (message.text.startsWith('/premium')) {
		if (hasPremium) {
			message.chat.sendMessage('☺️ У вас уже оформлена подписка! Чтобы отменить подписку, перейдите в настройки Telegram и в разделе Telegram Stars отмените подписку.')
			return
		}

		const invoiceLink = await bot.rest.request('createInvoiceLink', {
			title: 'Timbot Premium',
			description: 'Подписка на улучшенные модели GPT',
			payload: 'premium',
			currency: 'XTR',
			prices: '[{"label": "Подписка на месяц", "amount": 1}]',
			subscription_period: 2592000
		})

		message.chat.sendMessage('Премиум подписка позволит вам выбирать более продвинутые модели нейронной сети, а также увеличит лимиты по длине запросов и ответов', {
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

	if (message.text.startsWith('/model')) {
		if (!hasPremium) {
			message.chat.sendMessage('🌧️ Оформите подписку с помощью команды /premium, чтобы иметь возможность выбирать модель нейронной сети.')
			return
		}

		message.chat.sendMessage('Премиум подписка позволит вам выбирать более продвинутые модели нейронной сети, а также увеличит лимиты по длине запросов и ответов', {
			replyMarkup: new InlineKeyboardMarkup({
				inlineKeyboard: [[
					new InlineKeyboardButton({
						text: 'Gemini 1.5 Flash',
						callbackData: 'model:flash'
					})
				], [
					new InlineKeyboardButton({
						text: 'Gemini 1.5 Pro',
						callbackData: 'model:pro'
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
		await message.chat.sendMessage(text, {
			// parseMode: ParseMode.MarkdownV2
		})
	} catch (e) {
		console.error(e)
		message.chat.sendMessage('❌ Не удалось сгенерировать ответ')
	}
})

bot.on('callbackQuery', async (query) => {
	if (query.data?.startsWith('model')) {
		const modelId = query.data.split(':')[1]
		const modelName = modelId === 'flash' ? 'Gemini 1.5 Flash' : 'Gemini 1.5 Pro'
		query.message.editText(`✅ Модель была изменена на ${modelName}`, {
			replyMarkup: undefined
		})
	}
})

bot.on('preCheckoutQuery', async (query) => {
	bot.answerPreCheckoutQuery(query.id, true)
	const { transactions } = await bot.getStarTransactions({})
	// await bot.refundStarPayment(query.from.id, transactions.at(-1).id).catch(() => console.log)
	const sheet = doc.sheetsByTitle['transactions']
	await sheet.addRow({
		userId: query.from.id,
		date: new Date().getTime(),
		transactionId: transactions.at(-1).id
	})
})

bot.on('successfulPayment', async (payment) => {
	console.log(payment)
})

async function checkPremiumStatus(userId) {
	const rows = await doc.sheetsByTitle['transactions'].getRows()
	const transactionRow = rows.find((row) => row.get('userId') === userId.toString())
	return Boolean(transactionRow)
}

doc.loadInfo().then(() => {
	bot.polling.start();
})