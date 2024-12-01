import { Client, InlineKeyboardMarkup, InlineKeyboardButton } from 'tgkit';
import 'dotenv/config';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import credentials from './credentials.json' with { type: "json" };

const serviceAccountAuth = new JWT({
	email: credentials.client_email,
	key: credentials.private_key,
	scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet('1tD1O4sseC13fyakYnSh-i3aNBTSDTlABx-HXZa2YFhA', serviceAccountAuth);

const bot = new Client({
	token: process.env.TELEGRAM_BOT_TOKEN
});

bot.on('ready', () => {
	console.log('Bot is ready');
});

const cities = [
	{
		name: 'Москва',
		id: 'Moscow',
	},
	{
		name: 'Ростов',
		id: 'rostov',
	},
	{
		name: 'Краснодар',
		id: 'krasnodar',
	}
];

bot.on('message', async (message) => {
	const hasPremium = await checkPremiumStatus(message.sender.id)

	if (message.text === '/start') {
        message.chat.sendMessage('Привет! Выбери город:', {
            replyMarkup: new InlineKeyboardMarkup({
				inlineKeyboard: cities.map(city => [new InlineKeyboardButton({
					text: city.name,
					callbackData: `city_${city.id}`
				})])
			})
        })
		return
    }

	if (message.text === '/premium') {
		if (hasPremium) {
			message.chat.sendMessage('☺️ У вас уже оформлена подписка на Weather Premium! Чтобы отменить подписку, перейдите в настройки Telegram и в разделе Telegram Stars отмените подписку.')
			return
		}

		const invoiceLink = await bot.rest.request('createInvoiceLink', {
			title: 'WeatherBot Premium',
			description: 'Подписка на продвинутые данные о погоде',
			payload: 'premium',
			currency: 'XTR',
			prices: '[{"label": "Подписка на месяц", "amount": 1}]',
			subscription_period: 2592000
		})

		message.chat.sendMessage('☀️ Weather Premium позволит вам:\n\n- Получать более точную информацию о погоде\n- Узнавать погоду по точке геолокации\n- Получать советы исходя из погоды\n\nВсего за 1 ⭐ в месяц!', {
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

	if (message.location) {
		if (!hasPremium) {
			message.chat.sendMessage('🔒 Для получения информации о погоде по геолокации вам необходимо оформить подписку на Weather Premium. Используйте команду /premium для оформления подписки.')
			return
		}

		const { longitude, latitude } = message.location

		const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=metric&appid=${process.env.WEATHER_API_KEY}&lang=ru`)
		const data = await res.json();
		
		sendWeatherInfo(message.chat, message.sender.id, data)
	}
})

async function sendWeatherInfo(chat, userId, data) {
	const hasPremium = await checkPremiumStatus(userId)
	let messageContent = `🏙️ ${data.name} — ${data.weather[0].description}\n\n🌡 ${data.main.temp}°C`

	if (hasPremium) {
		messageContent += `\n☺️ Ощущается как: ${data.main.feels_like}°C`

		if (data.weather[0].main === 'Rain') {
			messageContent += `\n☂️ Идёт дождь, не забудьте взять зонт`
		}

		if (data.wind.speed > 7) {
			messageContent += `\n💨 Сильный ветер, возьмите с собой ветровку`
		}

		if (data.main.pressure > 1200) {
			messageContent += `\n🪨 Сегодня высокое давление, лучше не переутомляться`
		}
	}

	await chat.sendMessage(messageContent);
}

bot.on('callbackQuery', async (query) => {
	const weather = await getWeather(query.data.split('_')[1]);
	sendWeatherInfo(query.message.chat, query.from.id, weather)
	query.answer()
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

async function getWeather(city) {
	const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${process.env.WEATHER_API_KEY}&lang=ru`)
	const data = await res.json();
	return data;
}

async function checkPremiumStatus(userId) {
	const rows = await doc.sheetsByTitle['transactions'].getRows()
	const transactionRow = rows.find((row) => row.get('userId') === userId.toString())
	return Boolean(transactionRow)
}

doc.loadInfo().then(() => {
	bot.polling.start();
})