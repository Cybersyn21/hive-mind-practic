/**
 * Build a Telegram user mention link in various parse modes.
 * Построение ссылки для упоминания пользователя Telegram в различных режимах парсинга.
 *
 * This is a simplified version that doesn't require external dependencies.
 * It handles the most common cases for Telegram user mentions.
 * Это упрощенная версия, которая не требует внешних зависимостей.
 * Обрабатывает наиболее распространенные случаи упоминаний пользователей Telegram.
 *
 * @param {Object} options - Options for building the mention link / Опции для построения ссылки упоминания
 * @param {Object} [options.user] - Telegram user object with id, username, first_name, last_name / Объект пользователя Telegram
 * @param {number|string} [options.id] - Telegram user ID (overrides user.id) / ID пользователя (перезаписывает user.id)
 * @param {string} [options.username] - Telegram username (without '@', overrides user.username) / Имя пользователя (без '@')
 * @param {string} [options.first_name] - User's first name (overrides user.first_name) / Имя пользователя
 * @param {string} [options.last_name] - User's last name (overrides user.last_name) / Фамилия пользователя
 * @param {'HTML'|'Markdown'|'MarkdownV2'} [options.parseMode='HTML'] - The parse mode to use / Режим парсинга
 * @returns {string} A formatted mention link for the user / Отформатированная ссылка упоминания для пользователя
 */
export function buildUserMention({
  user,
  id: idParam,
  username: usernameParam,
  first_name: firstNameParam,
  last_name: lastNameParam,
  parseMode = 'HTML',
}) {
  // Derive core fields from `user` with inline overrides
  // Извлекаем основные поля из `user` с возможностью переопределения
  const id = idParam ?? user?.id;
  const username = usernameParam ?? user?.username;
  const firstName = firstNameParam ?? user?.first_name;
  const lastName = lastNameParam ?? user?.last_name;

  let displayName;
  if (username) {
    // Если есть username, используем его с префиксом @
    displayName = `@${username}`;
  } else {
    // Trim all string names, then filter out empty values
    // Обрезаем все строковые имена, затем фильтруем пустые значения
    const raw = [firstName, lastName];
    // Trim whitespace and Hangul filler (ㅤ) characters from names
    // Обрезаем пробелы и символы-заполнители Hangul (ㅤ) из имен
    const trimmedAll = raw.map((rawName) => (
      typeof rawName === 'string' ? rawName.trim().replace(/^[\s\t\n\rㅤ]+|[\s\t\n\rㅤ]+$/g, '') : rawName
    ));
    const cleaned = trimmedAll.filter((name) => typeof name === 'string' && name.length > 0);
    // Use cleaned names or fallback to id
    // Используем очищенные имена или откатываемся к id
    if (cleaned.length > 0) {
      displayName = cleaned.join(' ');
    } else {
      displayName = String(id);
    }
  }

  // Формируем ссылку: либо через t.me (для username), либо через tg:// протокол (для id)
  const link = username ? `https://t.me/${username}` : `tg://user?id=${id}`;

  // Форматируем ссылку в зависимости от режима парсинга
  switch (parseMode) {
    case 'Markdown':
      // Legacy Markdown: [text](url)
      // Устаревший Markdown формат
      return `[${displayName}](${link})`;
    case 'MarkdownV2': {
      // MarkdownV2 requires escaping special characters
      // MarkdownV2 требует экранирования специальных символов
      const escapedName = displayName.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
      return `[${escapedName}](${link})`;
    }
    case 'HTML':
    default: {
      // HTML mode: <a href="url">text</a>
      // HTML режим: экранируем HTML сущности
      const escapedHtml = displayName
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
      return `<a href="${link}">${escapedHtml}</a>`;
    }
  }
}
