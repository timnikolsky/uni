import telebot
import time
from telebot import types
# from googleapiclient.discovery import build
from gspread import Client, Spreadsheet, Worksheet, service_account

TABLE_ID = '14iNckQo_yybp3kfWQPa1zO7nLQQkhzWBU5f_GneH2o4'  # ID таблицы
RANGE = 'Sheet1!A2:D2' # Диапазон данных
service = service_account(filename="credentials.json")
table = service.open_by_key(TABLE_ID)

print(table)

# Инициализация бота с токеном
bot = telebot.TeleBot("7613869433:AAHqbIy1_XNSWDuD567mPZmZgA5nUqd_JwE")

# Словарь для хранения информации о пользователях
user_data = {}


def handle_next_step(message, handler):
    def new_handler(msg):
        if (msg.text == "/start"):
            send_welcome(msg)
        else:
            handler(msg)
    bot.register_next_step_handler(message, new_handler)


# Приветственное сообщение и сбор информации
@bot.message_handler(commands=['start'])
def send_welcome(message):
    user_id = message.chat.id
    rkr = types.ReplyKeyboardRemove()
    user_data[user_id] = {'graphs': []}  # Сохраним информацию о графиках пользователя
    bot.reply_to(message, "Привет! Я бот для сбора жалоб и предложений\n"
                          "Сначала давай соберем информацию о тебе.")
    bot.send_message(user_id, "Напиши своё ФИО.", reply_markup=rkr)
    handle_next_step(message, collect_user_name)


# Сбор данных пользователя
def collect_user_name(message):
    user_id = message.chat.id
    user_data[user_id]['name'] = message.text
    bot.send_message(user_id, "Отлично! Укажи свой возраст.")
    handle_next_step(message, collect_user_age)


def collect_user_age(message):
    user_id = message.chat.id

    # Проверка, является ли ввод числом
    if message.text.isdigit():
        user_data[user_id]['age'] = int(message.text)  # Преобразуем в целое число
        bot.send_message(user_id, "Спасибо! Теперь укажи свой род деятельности в универсиете.")
        handle_next_step(message, collect_user_position)
    else:
        bot.send_message(user_id, "Возраст должен быть числом. Пожалуйста, введи свой возраст снова.")
        handle_next_step(message, collect_user_age)


def collect_user_position(message):
    user_id = message.chat.id
    user_data[user_id]['position'] = message.text

    rmk = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    rmk.add(types.KeyboardButton("Студент"), types.KeyboardButton("Работник"))
    bot.send_message(user_id, "Замечательно, выберите ваш статус:", reply_markup=rmk)

    # Следующий шаг будет обработан в функции handle_status
    handle_next_step(message, handle_status)


def handle_status(message):
    user_id = message.chat.id
    rkr = types.ReplyKeyboardRemove()
    if message.text == "Студент":
        bot.send_message(user_id,"На каком вы курсе", reply_markup=rkr)
        handle_next_step(message, collect_user_kurs)
    if message.text == "Работник":
        bot.send_message(user_id, "На какой вы кафедре(если вы не работаете на кафедре укажите <->)", reply_markup=rkr)
        handle_next_step(message, collect_user_kafedra)



def collect_user_kurs(message):
    user_id = message.chat.id
    bot.send_message(user_id, "На каком факультете вы?")
    handle_next_step(message, collect_user_fak)

def collect_user_fak(message):
    user_id = message.chat.id
    bot.send_message(user_id, "В какой вы группе?")
    handle_next_step(message, collect_user_konec)

def collect_user_group(message):
    user_id = message.chat.id
    bot.send_message(user_id, "В какой вы группе?")
    handle_next_step(message, collect_user_konec)

def collect_user_kafedra(message):
    user_id = message.chat.id
    bot.send_message(user_id, "Кем работаете в вузе")
    handle_next_step(message, collect_user_konec)


def collect_user_konec(message):
    user_id = message.chat.id

    # Создаем клавиатуру с кнопками "Жалоба" и "Предложение"
    rmk = types.ReplyKeyboardMarkup(resize_keyboard=True)
    rmk.add(types.KeyboardButton("Жалоба"), types.KeyboardButton("Предложение"))

    bot.send_message(user_id, "Выберите, что хотите отправить:", reply_markup=rmk)
# Следующий шаг будет обработан в функции handle_feedback_type
    handle_next_step(message, handle_feedback_type)


def handle_feedback_type(message):
    user_id = message.chat.id
    feedback_type = message.text  # Сохраняем тип обратной связи (Жалоба или Предложение)
    rkr = types.ReplyKeyboardRemove()

    if feedback_type in ["Жалоба", "Предложение"]:
        # Сохраняем тип в данные пользователя
        user_data[user_id]['feedback_type'] = feedback_type
        bot.send_message(user_id, "Напишите ваше сообщение:", reply_markup=rkr)

        # Здесь мы регистрируем следующий шаг, чтобы получить текст сообщения
        handle_next_step(message, collect_feedback_message)
    else:
        bot.send_message(user_id, "Пожалуйста, выберите 'Жалоба' или 'Предложение'.")
        handle_next_step(message, handle_feedback_type)


def collect_feedback_message(message):
    user_id = message.chat.id
    user_data[user_id]['feedback_message'] = message.text  # Сохраняем сообщение

    # Подтверждение получения сообщения
    bot.send_message(user_id, "Ваше сообщение принято. Спасибо!")

    worksheet = table.worksheet('data')
    data = user_data[user_id]
    print(data)
    worksheet.insert_row([
        data['name'],
        data['age'],
        data['position'],
        data['feedback_type'],
        data['feedback_message']
    ], 2)





# Обработчик нажатий на инлайн-кнопки
#@bot.callback_query_handler(func=lambda call: True)
#def handle_query(call):
    #user_id = call.message.chat.id
    #selected_course = call.data

    # Здесь можно сохранить выбранный факультет или выполнить любую другую логику
    #bot.send_message(user_id, f"Вы выбрали: {selected_course} курс")

# Создаем инлайн клавиатуру
    #inline_keyboard = types.InlineKeyboardMarkup()
    #inline_keyboard.add(
        #types.InlineKeyboardButton("1", callback_data="1"),
       # types.InlineKeyboardButton("2", callback_data="2"),
       # types.InlineKeyboardButton("3", callback_data="3"),
       # types.InlineKeyboardButton("4", callback_data="4"),
        #types.InlineKeyboardButton("Магистратура", callback_data="Магистратура")
  #  )

    #bot.send_message(user_id, "Укажи факультет", reply_markup=inline_keyboard)

# Запуск бота
while True:
    try:
        bot.polling(timeout=60, long_polling_timeout=60)
    except Exception as e:
        print(f"Ошибка: {e}. Перезапуск через 15 секунд...")
        time.sleep(15)  # Пауза перед повторной попыткой

bot.polling()