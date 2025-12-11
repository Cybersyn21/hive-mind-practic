// Менеджер для работы с Links Notation (LINO) форматом
// Manager for working with Links Notation (LINO) format

// Проверяем и загружаем use-m если необходимо
if (typeof use === 'undefined') {
  globalThis.use = (await eval(await (await fetch('https://unpkg.com/use-m/use.js')).text())).use;
}

// Загружаем парсер Links Notation
const linoModule = await use('links-notation');
const LinoParser = linoModule.Parser || linoModule.default?.Parser;

const fs = await import('fs');
const path = await import('path');
const os = await import('os');

// Класс для управления Links Notation данными
// Class for managing Links Notation data
export class LinksNotationManager {
  constructor() {
    this.parser = new LinoParser();
    // Директория для кэша в домашней папке пользователя
    this.cacheDir = path.join(os.homedir(), '.hive-mind');
  }

  // Парсинг LINO строки и извлечение значений
  // Parse LINO string and extract values
  parse(input) {
    if (!input) return [];

    const parsed = this.parser.parse(input);

    if (parsed && parsed.length > 0) {
      const link = parsed[0];
      const values = [];

      // Извлекаем значения из связей
      if (link.values && link.values.length > 0) {
        for (const value of link.values) {
          const val = value.id || value;
          values.push(val);
        }
      } else if (link.id) {
        values.push(link.id);
      }

      return values;
    }

    return [];
  }

  // Парсинг числовых ID из LINO строки
  // Parse numeric IDs from LINO string
  parseNumericIds(input) {
    if (!input) return [];

    const parsed = this.parser.parse(input);

    if (parsed && parsed.length > 0) {
      const link = parsed[0];
      const ids = [];

      if (link.values && link.values.length > 0) {
        // Извлекаем и преобразуем значения в числа
        for (const value of link.values) {
          const num = parseInt(value.id || value);
          if (!isNaN(num)) {
            ids.push(num);
          }
        }
      } else if (link.id) {
        // Извлекаем числа из строки с помощью регулярных выражений
        const nums = link.id.match(/\d+/g);
        if (nums) {
          ids.push(...nums.map(n => parseInt(n)).filter(n => !isNaN(n)));
        }
      }

      return ids;
    }

    return [];
  }

  // Парсинг строковых значений из LINO
  // Parse string values from LINO
  parseStringValues(input) {
    if (!input) return [];

    const parsed = this.parser.parse(input);

    if (parsed && parsed.length > 0) {
      const link = parsed[0];
      const links = [];

      if (link.values && link.values.length > 0) {
        for (const value of link.values) {
          const linkStr = value.id || value;
          if (typeof linkStr === 'string') {
            links.push(linkStr);
          }
        }
      } else if (link.id) {
        if (typeof link.id === 'string') {
          links.push(link.id);
        }
      }

      return links;
    }

    return [];
  }

  // Форматирование массива значений в LINO формат
  // Format array of values into LINO format
  format(values) {
    if (!values || values.length === 0) return '()';

    const formattedValues = values.map(value => `  ${value}`).join('\n');
    return `(\n${formattedValues}\n)`;
  }

  // Создание директории кэша если не существует
  // Ensure cache directory exists
  ensureCacheDir() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
      return true;
    }
    return false;
  }

  // Сохранение данных в кэш файл
  // Save data to cache file
  saveToCache(filename, values) {
    this.ensureCacheDir();
    const cacheFile = path.join(this.cacheDir, filename);
    const linksNotation = this.format(values);
    fs.writeFileSync(cacheFile, linksNotation);
    return cacheFile;
  }

  // Загрузка данных из кэш файла
  // Load data from cache file
  loadFromCache(filename) {
    const cacheFile = path.join(this.cacheDir, filename);

    if (!fs.existsSync(cacheFile)) {
      return null;
    }

    const content = fs.readFileSync(cacheFile, 'utf8');
    return {
      raw: content,
      parsed: this.parse(content),
      numericIds: this.parseNumericIds(content),
      stringValues: this.parseStringValues(content),
      file: cacheFile
    };
  }

  // Проверка существования кэш файла
  // Check if cache file exists
  cacheExists(filename) {
    const cacheFile = path.join(this.cacheDir, filename);
    return fs.existsSync(cacheFile);
  }

  // Получение пути к кэш файлу
  // Get cache file path
  getCachePath(filename) {
    return path.join(this.cacheDir, filename);
  }

  // Требование кэш файла с выходом при отсутствии
  // Require cache file, exit if not found
  requireCache(filename, errorMessage) {
    const cache = this.loadFromCache(filename);

    if (!cache) {
      const cacheFile = this.getCachePath(filename);
      console.error(`❌ ${errorMessage || `Cache file not found: ${cacheFile}`}`);
      console.log('💡 Run the appropriate script first to create the cache file');
      process.exit(1);
    }

    console.log(`📂 Using cached data from: ${cache.file}\n`);
    return cache;
  }
}

// Константы для имен кэш файлов
// Constants for cache file names
export const CACHE_FILES = {
  TELEGRAM_CHATS: 'telegram-chats.lino'
};

// Singleton экземпляр менеджера
// Singleton manager instance
export const lino = new LinksNotationManager();
