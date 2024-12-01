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
		const invoiceLink = await bot.rest.request('createInvoiceLink', {
			title: 'WeatherBot Premium',
			description: 'Подписка на продвинутые данные о погоде',
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

	if (message.location) {
		const { longitude, latitude } = message.location

		const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=metric&appid=${process.env.WEATHER_API_KEY}&lang=ru`)
		const data = await res.json();
		
		message.chat.sendMessage( `${data.name}
${data.weather[0].description}
${data.main.temp}°C, ощущается как ${data.main.feels_like}°C`
		);
	}
})

bot.on('callbackQuery', async (query) => {
	const weather = await getWeather(query.data.split('_')[1]);
	query.message.chat.sendMessage( `${weather.name}
${weather.weather[0].description}
${weather.main.temp}°C, ощущается как ${weather.main.feels_like}°C`
	);
	query.answer()
})

bot.on('preCheckoutQuery', async (query) => {
	bot.answerPreCheckoutQuery(query.id, true)
	await doc.loadInfo()
	const { transactions } = await bot.getStarTransactions({})
	await bot.refundStarPayment(query.from.id, transactions.at(-1).id).catch(() => console.log)
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

bot.polling.start();