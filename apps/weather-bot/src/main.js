import { Client, InlineKeyboardMarkup, InlineKeyboardButton } from 'tgkit';
import 'dotenv/config';

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

async function getWeather(city) {
	const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${process.env.WEATHER_API_KEY}&lang=ru`)
	const data = await res.json();
	return data;
}

bot.polling.start();