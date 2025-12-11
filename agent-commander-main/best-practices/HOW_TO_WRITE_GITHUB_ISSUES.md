# How to Write GitHub Issues for AI Agents
# Как писать GitHub Issues для AI-агентов
# Cómo escribir GitHub Issues para Agentes AI

> **Target Audience / Целевая аудитория / Audiencia objetivo**: Non-programmers working with AI agents from the Agents folder
>
> **AI Agent**: This repository uses AI agents (Agent, Agent-Commander, and Hive Mind) to automatically process and solve GitHub issues. ClaudeCode executes the actual code implementation.

---

## Table of Contents / Оглавление / Tabla de Contenidos

### English
- [Part 1: Photo & PDF Processing Issues (55 Methods)](#part-1-photo--pdf-processing-issues-55-methods)
- [Part 2: Documentation Issues (89 Methods)](#part-2-documentation-issues-89-methods)
- [Part 3: Code-Related Issues (144 Methods)](#part-3-code-related-issues-144-methods)
- [Part 4: File Attachments in GitHub Issues](#part-4-file-attachments-in-github-issues)
- [Part 5: Custom Commands in .claude Directory](#part-5-custom-commands-in-claude-directory)

### Русский
- [Часть 1: Issues для обработки фото и PDF (55 способов)](#часть-1-issues-для-обработки-фото-и-pdf-55-способов)
- [Часть 2: Issues для документации (89 способов)](#часть-2-issues-для-документации-89-способов)
- [Часть 3: Issues для кода (144 способа)](#часть-3-issues-для-кода-144-способа)
- [Часть 4: Прикрепление файлов к GitHub Issues](#часть-4-прикрепление-файлов-к-github-issues)
- [Часть 5: Пользовательские команды в .claude директории](#часть-5-пользовательские-команды-в-claude-директории)

### Español
- [Parte 1: Issues para Procesamiento de Fotos y PDF (55 Métodos)](#parte-1-issues-para-procesamiento-de-fotos-y-pdf-55-métodos)
- [Parte 2: Issues para Documentación (89 Métodos)](#parte-2-issues-para-documentación-89-métodos)
- [Parte 3: Issues para Código (144 Métodos)](#parte-3-issues-para-código-144-métodos)
- [Parte 4: Adjuntar Archivos en GitHub Issues](#parte-4-adjuntar-archivos-en-github-issues)
- [Parte 5: Comandos Personalizados en el Directorio .claude](#parte-5-comandos-personalizados-en-el-directorio-claude)

---

# Part 1: Photo & PDF Processing Issues (55 Methods)

## 1-10: Image Format Conversion

### Method 1: Convert Image Format
**English**: Convert images from one format to another (PNG to JPG, WEBP to PNG, etc.)

**Good Example**:
```
Title: Convert all PNG images to WEBP format in /assets folder

Description:
I need to convert all PNG images in the /assets/images directory to WEBP format to reduce file sizes.

Requirements:
- Convert all .png files to .webp
- Maintain original image quality
- Keep original files as backup in /assets/images/originals
- Generate a conversion report showing file size savings

Expected output: Converted images in WEBP format with size report
```

**Why this is good**:
- ✅ Clear, specific task
- ✅ Defines exact location
- ✅ Specifies quality requirements
- ✅ Mentions what to do with originals
- ✅ Requests measurable output

**Bad Example**:
```
Title: Convert images

Description: I have some images, please convert them
```

**Why this is bad**:
- ❌ No format specified
- ❌ No location provided
- ❌ No quality requirements
- ❌ Too vague

---

### Method 2: Batch Resize Images
**English**: Resize multiple images to specific dimensions

**Good Example**:
```
Title: Resize product photos to 800x800px for website

Description:
Resize all product photos in /products/raw-photos directory to 800x800px thumbnails.

Requirements:
- Source directory: /products/raw-photos
- Output directory: /products/thumbnails
- Target size: 800x800px
- Maintain aspect ratio (add white padding if needed)
- Support JPG, PNG, WEBP formats
- Preserve EXIF data

Test: Verify at least 5 sample images maintain quality and correct dimensions
```

**Why this is good**:
- ✅ Specific dimensions
- ✅ Clear input/output locations
- ✅ Handles aspect ratio
- ✅ Multiple format support
- ✅ Includes test criteria

**Bad Example**:
```
Title: Make images smaller

Description: The images are too big
```

**Why this is bad**:
- ❌ No target size specified
- ❌ No file locations
- ❌ No format information

---

## Русский - Методы 1-2

### Метод 1: Конвертация формата изображений
**Русский**: Конвертация изображений из одного формата в другой (PNG в JPG, WEBP в PNG и т.д.)

**Хороший пример**:
```
Заголовок: Конвертировать все PNG изображения в формат WEBP в папке /assets

Описание:
Мне нужно конвертировать все PNG изображения в директории /assets/images в формат WEBP для уменьшения размера файлов.

Требования:
- Конвертировать все .png файлы в .webp
- Сохранить оригинальное качество изображений
- Сохранить оригинальные файлы как резервные копии в /assets/images/originals
- Создать отчет о конвертации с указанием экономии размера файлов

Ожидаемый результат: Конвертированные изображения в формате WEBP с отчетом о размерах
```

**Почему это хорошо**:
- ✅ Четкая, конкретная задача
- ✅ Определено точное местоположение
- ✅ Указаны требования к качеству
- ✅ Упомянуто, что делать с оригиналами
- ✅ Запрошен измеримый результат

**Плохой пример**:
```
Заголовок: Конвертировать изображения

Описание: У меня есть изображения, пожалуйста конвертируйте их
```

**Почему это плохо**:
- ❌ Не указан формат
- ❌ Не указано местоположение
- ❌ Нет требований к качеству
- ❌ Слишком расплывчато

### Метод 2: Пакетное изменение размера изображений
**Русский**: Изменение размера нескольких изображений до определенных размеров

**Хороший пример**:
```
Заголовок: Изменить размер фотографий продуктов до 800x800px для сайта

Описание:
Изменить размер всех фотографий продуктов в директории /products/raw-photos до миниатюр 800x800px.

Требования:
- Исходная директория: /products/raw-photos
- Выходная директория: /products/thumbnails
- Целевой размер: 800x800px
- Сохранить пропорции (добавить белые поля при необходимости)
- Поддержка форматов JPG, PNG, WEBP
- Сохранить EXIF данные

Тест: Проверить минимум 5 образцов изображений на сохранение качества и правильных размеров
```

---

## Español - Métodos 1-2

### Método 1: Conversión de Formato de Imagen
**Español**: Convertir imágenes de un formato a otro (PNG a JPG, WEBP a PNG, etc.)

**Buen Ejemplo**:
```
Título: Convertir todas las imágenes PNG a formato WEBP en la carpeta /assets

Descripción:
Necesito convertir todas las imágenes PNG en el directorio /assets/images a formato WEBP para reducir el tamaño de los archivos.

Requisitos:
- Convertir todos los archivos .png a .webp
- Mantener la calidad original de la imagen
- Guardar los archivos originales como respaldo en /assets/images/originals
- Generar un informe de conversión mostrando el ahorro de tamaño de archivo

Resultado esperado: Imágenes convertidas en formato WEBP con informe de tamaños
```

**Por qué esto es bueno**:
- ✅ Tarea clara y específica
- ✅ Define ubicación exacta
- ✅ Especifica requisitos de calidad
- ✅ Menciona qué hacer con los originales
- ✅ Solicita salida medible

### Método 2: Redimensionar Imágenes en Lote
**Español**: Redimensionar múltiples imágenes a dimensiones específicas

**Buen Ejemplo**:
```
Título: Redimensionar fotos de productos a 800x800px para el sitio web

Descripción:
Redimensionar todas las fotos de productos en el directorio /products/raw-photos a miniaturas de 800x800px.

Requisitos:
- Directorio origen: /products/raw-photos
- Directorio salida: /products/thumbnails
- Tamaño objetivo: 800x800px
- Mantener relación de aspecto (agregar relleno blanco si es necesario)
- Soportar formatos JPG, PNG, WEBP
- Preservar datos EXIF

Prueba: Verificar al menos 5 imágenes de muestra mantengan calidad y dimensiones correctas
```

---

## Methods 3-10: Image Optimization

### Method 3: Compress Images Without Quality Loss
### Method 4: Remove Image Metadata (EXIF)
### Method 5: Generate Image Thumbnails
### Method 6: Crop Images to Specific Aspect Ratio
### Method 7: Add Watermark to Images
### Method 8: Convert Images to Grayscale
### Method 9: Apply Image Filters (Brightness, Contrast, Saturation)
### Method 10: Create Image Collages/Grids

**Good Example Template for Image Processing**:
```
Title: [Specific action] + [what files] + [where]

Description:
[Clear explanation of what you want to achieve]

Source files:
- Format: [JPG/PNG/WEBP/etc]
- Location: [exact path]
- Count: [approximate number or "all files"]

Processing requirements:
- [Specific parameter 1]
- [Specific parameter 2]
- [Quality/size requirements]

Output:
- Format: [target format]
- Location: [output path]
- Naming: [how to name files]

Testing:
- [How to verify success]
```

---

## Methods 11-25: PDF Operations

### Method 11: Merge Multiple PDFs
**Good Example**:
```
Title: Merge monthly report PDFs into single annual report

Description:
Combine 12 monthly PDF reports (January-December 2024) into one annual report PDF.

Source files:
- Location: /reports/2024/monthly/
- Files: report_2024_01.pdf through report_2024_12.pdf
- Order: Chronological (Jan-Dec)

Requirements:
- Preserve all pages from each PDF
- Add a title page at the beginning with "Annual Report 2024"
- Add page numbers to all pages
- Maintain original PDF quality
- Add bookmarks for each month

Output:
- Filename: annual_report_2024.pdf
- Location: /reports/2024/

Success criteria: PDF opens correctly, all 12 months present, bookmarks work
```

### Method 12: Split PDF into Separate Pages
### Method 13: Extract Specific Pages from PDF
### Method 14: Compress PDF Size
### Method 15: Convert PDF to Images
### Method 16: Convert Images to PDF
### Method 17: Add Password Protection to PDF
### Method 18: Remove Password from PDF
### Method 19: Add Watermark to PDF
### Method 20: Rotate PDF Pages
### Method 21: Extract Text from PDF
### Method 22: Extract Images from PDF
### Method 23: Convert PDF to Text
### Method 24: Add Page Numbers to PDF
### Method 25: Merge PDF with Specific Page Ranges

---

## Methods 26-40: OCR and Text Recognition

### Method 26: Perform OCR on Scanned PDFs
**Good Example**:
```
Title: Perform OCR on 50 scanned contract PDFs in Russian

Description:
I have 50 scanned contract PDFs that need OCR processing to make them searchable.

Source files:
- Location: /contracts/scanned/
- Language: Russian
- Quality: 300 DPI scans
- Format: PDF

Requirements:
- Detect Russian text using OCR
- Preserve original PDF layout
- Make text searchable and selectable
- Maintain image quality
- Generate both searchable PDF and extracted text file

Output:
- Searchable PDFs: /contracts/searchable/
- Extracted text: /contracts/text/[filename].txt
- Error log: List any PDFs with OCR issues

Success criteria: At least 95% text recognition accuracy on sample check
```

### Method 27: OCR for Multilingual Documents
### Method 28: Extract Tables from Scanned PDFs
### Method 29: OCR Handwritten Text
### Method 30: Convert Scanned Invoice to Structured Data
### Method 31: Batch OCR Processing
### Method 32: OCR with Specific Language
### Method 33: Extract Forms Data from Scanned Documents
### Method 34: Convert Business Cards to Contact Data
### Method 35: OCR Receipt Processing

---

## Methods 36-45: Image Enhancement

### Method 36: Upscale Images Using AI
### Method 37: Remove Background from Images
### Method 38: Fix Blurry Images
### Method 39: Enhance Old/Faded Photos
### Method 40: Remove Red-Eye from Photos
### Method 41: Adjust White Balance
### Method 42: Remove Noise from Images
### Method 43: Straighten Skewed Document Images
### Method 44: Enhance Document Readability
### Method 45: Auto-Correct Image Colors

---

## Methods 46-55: Advanced PDF & Image Processing

### Method 46: Create Fillable PDF Forms
### Method 47: Convert PDF Forms to JSON Data
### Method 48: Generate PDF Reports from Data
### Method 49: Create Image Sprites from Multiple Images
### Method 50: Generate Favicons in Multiple Sizes
### Method 51: Convert SVG to PNG/JPG
### Method 52: Optimize Images for Web (WebP, Progressive JPEG)
### Method 53: Create PDF Portfolio/Package
### Method 54: Add Digital Signatures to PDFs
### Method 55: Validate PDF/A Compliance

**Example for Advanced PDF Task**:
```
Title: Create fillable PDF form from existing PDF template

Description:
Convert static PDF template into an interactive fillable form.

Source:
- File: /templates/application_form.pdf
- Pages: 3 pages
- Fields needed: Name, Email, Phone, Address, Date, Signature

Requirements:
- Add text input fields for Name, Email, Phone, Address
- Add date picker for Date field
- Add signature field (digital signature support)
- Make fields required (validation)
- Add Submit button that emails to admin@company.com
- Preserve original layout and styling

Output:
- File: /templates/application_form_fillable.pdf
- Include instructions PDF for users

Testing:
- Test all fields accept input
- Test validation works
- Test submission (dry run)
```

---

# Часть 1: Issues для обработки фото и PDF (55 способов)

## Методы 11-25: Операции с PDF

### Метод 11: Объединение нескольких PDF
**Хороший пример**:
```
Заголовок: Объединить PDF-отчеты за месяц в единый годовой отчет

Описание:
Объединить 12 месячных PDF-отчетов (январь-декабрь 2024) в один годовой отчет PDF.

Исходные файлы:
- Расположение: /reports/2024/monthly/
- Файлы: report_2024_01.pdf до report_2024_12.pdf
- Порядок: Хронологический (янв-дек)

Требования:
- Сохранить все страницы из каждого PDF
- Добавить титульную страницу в начале с текстом "Годовой отчет 2024"
- Добавить нумерацию страниц ко всем страницам
- Сохранить оригинальное качество PDF
- Добавить закладки для каждого месяца

Результат:
- Имя файла: annual_report_2024.pdf
- Расположение: /reports/2024/

Критерии успеха: PDF открывается корректно, все 12 месяцев присутствуют, закладки работают
```

### Метод 26: Выполнение OCR на сканированных PDF
**Хороший пример**:
```
Заголовок: Выполнить OCR на 50 сканированных PDF-контрактах на русском языке

Описание:
У меня есть 50 сканированных PDF-контрактов, которые нуждаются в OCR обработке для возможности поиска.

Исходные файлы:
- Расположение: /contracts/scanned/
- Язык: Русский
- Качество: Сканы 300 DPI
- Формат: PDF

Требования:
- Распознать русский текст с помощью OCR
- Сохранить оригинальную структуру PDF
- Сделать текст доступным для поиска и выделения
- Сохранить качество изображения
- Сгенерировать как PDF с возможностью поиска, так и извлеченный текстовый файл

Результат:
- PDF с поиском: /contracts/searchable/
- Извлеченный текст: /contracts/text/[filename].txt
- Лог ошибок: Список PDF с проблемами OCR

Критерии успеха: Минимум 95% точность распознавания текста при выборочной проверке
```

---

# Parte 1: Issues para Procesamiento de Fotos y PDF (55 Métodos)

## Métodos 11-25: Operaciones con PDF

### Método 11: Combinar Múltiples PDFs
**Buen Ejemplo**:
```
Título: Combinar PDFs de informes mensuales en un informe anual único

Descripción:
Combinar 12 informes PDF mensuales (enero-diciembre 2024) en un informe anual.

Archivos fuente:
- Ubicación: /reports/2024/monthly/
- Archivos: report_2024_01.pdf hasta report_2024_12.pdf
- Orden: Cronológico (ene-dic)

Requisitos:
- Preservar todas las páginas de cada PDF
- Agregar una página de título al principio con "Informe Anual 2024"
- Agregar números de página a todas las páginas
- Mantener la calidad original del PDF
- Agregar marcadores para cada mes

Salida:
- Nombre de archivo: annual_report_2024.pdf
- Ubicación: /reports/2024/

Criterios de éxito: El PDF se abre correctamente, los 12 meses están presentes, los marcadores funcionan
```

### Método 26: Realizar OCR en PDFs Escaneados
**Buen Ejemplo**:
```
Título: Realizar OCR en 50 PDFs de contratos escaneados en español

Descripción:
Tengo 50 PDFs de contratos escaneados que necesitan procesamiento OCR para hacerlos buscables.

Archivos fuente:
- Ubicación: /contracts/scanned/
- Idioma: Español
- Calidad: Escaneos a 300 DPI
- Formato: PDF

Requisitos:
- Detectar texto en español usando OCR
- Preservar el diseño original del PDF
- Hacer el texto buscable y seleccionable
- Mantener la calidad de imagen
- Generar tanto PDF buscable como archivo de texto extraído

Salida:
- PDFs buscables: /contracts/searchable/
- Texto extraído: /contracts/text/[filename].txt
- Registro de errores: Lista de PDFs con problemas de OCR

Criterios de éxito: Al menos 95% de precisión de reconocimiento de texto en verificación de muestra
```

---

# Part 2: Documentation Issues (89 Methods)

## Methods 1-15: Creating Documentation

### Method 1: Generate README from Codebase
**Good Example**:
```
Title: Generate comprehensive README.md for the Agent project

Description:
Create a detailed README.md file that documents the Agent project structure and usage.

Requirements:
- Analyze codebase in /src directory
- Include project description and purpose
- List all dependencies from package.json
- Document installation steps for Bun runtime
- Provide usage examples for all 13 tools
- Add configuration options
- Include troubleshooting section
- Add license information (Unlicense)

Structure:
1. Project title and badges
2. Description
3. Features list
4. Installation
5. Usage examples
6. Configuration
7. Tools documentation
8. Troubleshooting
9. Contributing
10. License

Output language: English
References: Use existing /docs files as context

Success criteria: README is complete, accurate, and matches project capabilities
```

**Why this is good**:
- ✅ Specific project named
- ✅ Clear structure defined
- ✅ Lists required sections
- ✅ References existing documentation
- ✅ Defines success criteria

**Bad Example**:
```
Title: Make a README

Description: We need a README file
```

**Why this is bad**:
- ❌ No project specified
- ❌ No structure defined
- ❌ No content requirements

---

### Method 2: Create API Documentation
**Good Example**:
```
Title: Create API documentation for all REST endpoints in /api

Description:
Document all REST API endpoints in the application.

Requirements:
- Scan /api directory for all route files
- Document each endpoint with:
  * HTTP method (GET, POST, PUT, DELETE)
  * Full URL path
  * Request parameters
  * Request body schema (JSON)
  * Response schema (JSON)
  * Authentication requirements
  * Example requests using curl
  * Example responses
  * Possible error codes

Format: OpenAPI 3.0 specification
Output: /docs/api/openapi.yaml + /docs/api/README.md

Generate from: Actual code + JSDoc comments

Include:
- Interactive Swagger UI setup instructions
- Postman collection export

Success criteria: All endpoints documented, examples work correctly
```

### Method 3: Write Tutorial Documentation
### Method 4: Create User Guide
### Method 5: Generate Changelog from Git History
### Method 6: Create Contributing Guidelines
### Method 7: Write Architecture Documentation
### Method 8: Create Code Style Guide
### Method 9: Generate Command Reference
### Method 10: Write Troubleshooting Guide
### Method 11: Create FAQ Document
### Method 12: Generate Migration Guide
### Method 13: Create Security Documentation
### Method 14: Write Deployment Guide
### Method 15: Create Testing Documentation

---

## Methods 16-30: Translating Documentation

### Method 16: Translate README to Multiple Languages
**Good Example**:
```
Title: Translate README.md to Russian and Spanish

Description:
Translate the existing English README.md into Russian and Spanish versions.

Source:
- File: /README.md
- Language: English
- Lines: ~200 lines

Requirements:
- Create README_RU.md (Russian translation)
- Create README_ES.md (Spanish translation)
- Preserve all markdown formatting
- Keep code examples unchanged
- Translate all text sections
- Maintain link structure
- Use technical terminology correctly
- Keep project-specific terms in English (e.g., "Hive Mind", "ClaudeCode")

Translation quality:
- Use native speaker quality
- Technical accuracy for IT terms
- Consistent terminology throughout

Output:
- /README_RU.md
- /README_ES.md

Verification:
- All sections translated
- Markdown renders correctly
- Links work
- Code blocks preserved
```

**Why this is good**:
- ✅ Clear source and target languages
- ✅ Specifies what to preserve
- ✅ Defines quality requirements
- ✅ Lists verification steps

### Method 17: Translate API Documentation
### Method 18: Translate User Interface Strings
### Method 19: Translate Error Messages
### Method 20: Translate Code Comments
### Method 21: Create Multilingual FAQ
### Method 22: Translate Installation Guide
### Method 23: Localize Date/Time Formats in Docs
### Method 24: Translate Video Subtitles Documentation
### Method 25: Create Language-Specific Examples
### Method 26: Translate Configuration Files
### Method 27: Localize Documentation Images/Screenshots
### Method 28: Translate Glossary/Terminology
### Method 29: Create Multi-language Navigation
### Method 30: Translate Legal/License Documents

---

## Methods 31-45: Documentation Maintenance

### Method 31: Update Outdated Documentation
**Good Example**:
```
Title: Update Agent documentation to reflect new tool additions

Description:
Update all documentation files to include the 3 newly added tools.

Changes needed:
- New tools: webfetch, codesearch, batch
- Added in version 2.0.0
- Each tool has new parameters and capabilities

Files to update:
1. /README.md - Update tools count from 10 to 13
2. /docs/TOOLS.md - Add detailed documentation for each new tool
3. /docs/EXAMPLES.md - Add usage examples for new tools
4. /CHANGELOG.md - Document additions in v2.0.0

For each new tool document:
- Purpose and use case
- Parameters (with types and defaults)
- Return value format
- 3 usage examples (basic, intermediate, advanced)
- Common errors and solutions
- Related tools

Template to follow: Existing tool documentation format in TOOLS.md

Success criteria:
- All files updated
- New tools documented with same depth as existing tools
- Examples tested and working
- Version numbers consistent
```

### Method 32: Fix Documentation Broken Links
### Method 33: Sync Documentation with Code Changes
### Method 34: Add Missing Documentation Sections
### Method 35: Remove Deprecated Documentation
### Method 36: Update Screenshots in Documentation
### Method 37: Fix Documentation Typos
### Method 38: Improve Documentation Clarity
### Method 39: Add Cross-References in Documentation
### Method 40: Update Version Numbers in Documentation
### Method 41: Consolidate Duplicate Documentation
### Method 42: Organize Documentation Structure
### Method 43: Add Table of Contents to Long Documents
### Method 44: Update Documentation Dependencies
### Method 45: Archive Old Documentation Versions

---

## Methods 46-60: Code Documentation

### Method 46: Add JSDoc Comments to Functions
**Good Example**:
```
Title: Add JSDoc comments to all functions in /src/agent/ directory

Description:
Add comprehensive JSDoc documentation to all JavaScript functions.

Scope:
- Directory: /src/agent/
- Files: All .js and .mjs files
- Functions: All exported and internal functions

JSDoc format requirements:
- Function description
- @param tags for all parameters (with types)
- @returns tag (with type and description)
- @throws tag for potential errors
- @example tag with working code example
- @since tag with version added

Example format:
```javascript
/**
 * Executes a bash command and returns the result
 *
 * @param {string} command - The bash command to execute
 * @param {Object} options - Execution options
 * @param {number} [options.timeout=120000] - Timeout in milliseconds
 * @param {string} [options.cwd] - Working directory
 * @returns {Promise<Object>} Result object with stdout, stderr, and exitCode
 * @throws {Error} If command execution fails or times out
 * @example
 * const result = await executeBash('ls -la', { cwd: '/tmp' });
 * console.log(result.stdout);
 * @since 1.0.0
 */
```

Quality requirements:
- Clear, concise descriptions
- Accurate type information
- Working examples
- Document edge cases

Success criteria: All functions documented, JSDoc generates HTML docs without errors
```

### Method 47: Add Python Docstrings
### Method 48: Generate Code Documentation from Comments
### Method 49: Add Inline Code Comments
### Method 50: Document Class Methods
### Method 51: Create Module Documentation
### Method 52: Document Configuration Options
### Method 53: Add Type Definitions Documentation
### Method 54: Document Database Schema
### Method 55: Create REST API Endpoint Comments
### Method 56: Document Environment Variables
### Method 57: Add CLI Command Documentation
### Method 58: Document Error Codes
### Method 59: Create Data Model Documentation
### Method 60: Document Algorithms and Logic

---

## Methods 61-75: Documentation Automation

### Method 61: Auto-Generate Documentation from TypeScript Types
### Method 62: Create Documentation from Test Cases
### Method 63: Generate CLI Help from Code
### Method 64: Auto-Create Table of Contents
### Method 65: Generate Documentation Site (MkDocs, Docusaurus)
### Method 66: Auto-Update Version Numbers
### Method 67: Generate Release Notes from Commits
### Method 68: Create Documentation from OpenAPI Spec
### Method 69: Auto-Generate Examples from Tests
### Method 70: Build Documentation PDF from Markdown
### Method 71: Create Documentation Search Index
### Method 72: Auto-Generate Diagrams from Code
### Method 73: Create Documentation from Database Schema
### Method 74: Generate Metrics Dashboard Documentation
### Method 75: Auto-Create Documentation Sidebar

---

## Methods 76-89: Specialized Documentation

### Method 76: Create Quickstart Guide
**Good Example**:
```
Title: Create 5-minute quickstart guide for Hive Mind

Description:
Create a concise quickstart guide that gets users from zero to running Hive Mind in 5 minutes.

Target audience: Developers familiar with Node.js/Docker

Content structure:
1. Prerequisites check (Node.js, Docker, GitHub account)
2. Installation (3 commands maximum)
3. Configuration (minimal required .env setup)
4. First run (single command)
5. Verification (how to confirm it works)
6. Next steps (links to full documentation)

Requirements:
- Each step with copy-paste ready commands
- Expected output examples
- Common errors with fixes
- Estimated time for each step
- Screenshot of successful run
- Links to detailed docs for each section

Format: Markdown
Location: /docs/QUICKSTART.md
Also create: /docs/QUICKSTART_RU.md, /docs/QUICKSTART_ES.md

Success criteria: Complete beginner can get running in 5 minutes
```

### Method 77: Write Integration Guide
### Method 78: Create Performance Tuning Documentation
### Method 79: Write Backup and Recovery Guide
### Method 80: Create Monitoring Setup Documentation
### Method 81: Write Docker Setup Guide
### Method 82: Create Kubernetes Deployment Guide
### Method 83: Write CI/CD Pipeline Documentation
### Method 84: Create Security Best Practices Guide
### Method 85: Write Database Migration Documentation
### Method 86: Create API Rate Limiting Documentation
### Method 87: Write WebSocket Documentation
### Method 88: Create GraphQL Schema Documentation
### Method 89: Write Performance Benchmarks Documentation

---

# Часть 2: Issues для документации (89 способов)

## Методы 1-15: Создание документации

### Метод 1: Генерация README из кодовой базы
**Хороший пример**:
```
Заголовок: Сгенерировать полный README.md для проекта Agent

Описание:
Создать подробный файл README.md, документирующий структуру и использование проекта Agent.

Требования:
- Проанализировать кодовую базу в директории /src
- Включить описание и цель проекта
- Перечислить все зависимости из package.json
- Документировать шаги установки для Bun runtime
- Предоставить примеры использования для всех 13 инструментов
- Добавить опции конфигурации
- Включить секцию устранения неполадок
- Добавить информацию о лицензии (Unlicense)

Структура:
1. Название проекта и бейджи
2. Описание
3. Список функций
4. Установка
5. Примеры использования
6. Конфигурация
7. Документация инструментов
8. Устранение неполадок
9. Участие в разработке
10. Лицензия

Язык документа: Английский
Ссылки: Использовать существующие файлы в /docs как контекст

Критерии успеха: README полный, точный и соответствует возможностям проекта
```

### Метод 16: Перевод README на несколько языков
**Хороший пример**:
```
Заголовок: Перевести README.md на русский и испанский языки

Описание:
Перевести существующий английский README.md на русскую и испанскую версии.

Источник:
- Файл: /README.md
- Язык: Английский
- Строки: ~200 строк

Требования:
- Создать README_RU.md (русский перевод)
- Создать README_ES.md (испанский перевод)
- Сохранить всё форматирование markdown
- Оставить примеры кода без изменений
- Перевести все текстовые секции
- Сохранить структуру ссылок
- Использовать технические термины правильно
- Оставить специфичные для проекта термины на английском (например, "Hive Mind", "ClaudeCode")

Качество перевода:
- Использовать качество носителя языка
- Техническая точность для IT-терминов
- Последовательная терминология на протяжении всего документа

Результат:
- /README_RU.md
- /README_ES.md

Проверка:
- Все секции переведены
- Markdown отображается корректно
- Ссылки работают
- Блоки кода сохранены
```

---

# Parte 2: Issues para Documentación (89 Métodos)

## Métodos 1-15: Creación de Documentación

### Método 1: Generar README desde la Base de Código
**Buen Ejemplo**:
```
Título: Generar README.md completo para el proyecto Agent

Descripción:
Crear un archivo README.md detallado que documente la estructura y uso del proyecto Agent.

Requisitos:
- Analizar la base de código en el directorio /src
- Incluir descripción y propósito del proyecto
- Listar todas las dependencias de package.json
- Documentar pasos de instalación para Bun runtime
- Proporcionar ejemplos de uso para las 13 herramientas
- Agregar opciones de configuración
- Incluir sección de solución de problemas
- Agregar información de licencia (Unlicense)

Estructura:
1. Título del proyecto e insignias
2. Descripción
3. Lista de características
4. Instalación
5. Ejemplos de uso
6. Configuración
7. Documentación de herramientas
8. Solución de problemas
9. Contribución
10. Licencia

Idioma de salida: Inglés
Referencias: Usar archivos existentes en /docs como contexto

Criterios de éxito: README completo, preciso y coincide con las capacidades del proyecto
```

---

# Part 3: Code-Related Issues (144 Methods)

## Methods 1-20: Bug Fixes

### Method 1: Fix Specific Bug with Error Message
**Good Example**:
```
Title: Fix TypeError when calling agent.execute() without parameters

Description:
The agent.execute() function throws a TypeError when called without parameters, but it should use default parameters instead.

Error message:
```
TypeError: Cannot read property 'command' of undefined
  at Agent.execute (/src/agent/agent.ts:45:23)
  at main (/src/index.ts:12:15)
```

Steps to reproduce:
1. Import agent: `import { Agent } from './src/agent/agent.ts'`
2. Create instance: `const agent = new Agent()`
3. Call without params: `agent.execute()`
4. Error occurs

Expected behavior:
- Should use default empty parameters: `{ command: '', options: {} }`
- Should not throw error
- Should return empty result object

Affected files:
- /src/agent/agent.ts (line 45)
- /src/agent/agent.test.ts (need test case)

Fix requirements:
- Add parameter validation
- Add default parameters
- Add test case for this scenario
- Update JSDoc to clarify parameter requirements

Success criteria:
- `agent.execute()` works without throwing
- All existing tests still pass
- New test added and passes
```

**Why this is good**:
- ✅ Specific error message included
- ✅ Steps to reproduce provided
- ✅ Expected behavior defined
- ✅ Files identified
- ✅ Test requirements included

**Bad Example**:
```
Title: Fix bug

Description: The agent doesn't work
```

**Why this is bad**:
- ❌ No error details
- ❌ No reproduction steps
- ❌ Too vague

---

### Method 2: Fix Performance Issue
**Good Example**:
```
Title: Optimize slow database query in getUserReports() function

Description:
The getUserReports() function takes 5-8 seconds to execute, causing timeout issues.

Current performance:
- Function: getUserReports() in /src/database/reports.ts
- Current execution time: 5-8 seconds
- Target execution time: <500ms
- Database: PostgreSQL
- Dataset size: ~100,000 user records

Problem analysis:
- Missing database index on user_id column
- N+1 query problem (loads reports one by one)
- No query result caching

Proposed solution:
1. Add database index: CREATE INDEX idx_reports_user_id ON reports(user_id)
2. Use JOIN instead of multiple queries
3. Implement Redis caching for frequent queries
4. Add query result pagination

Requirements:
- Implement optimizations
- Add performance tests
- Benchmark before/after
- Document index creation in migration
- Add caching configuration

Files to modify:
- /src/database/reports.ts
- /src/database/migrations/add_reports_index.sql
- /src/config/cache.ts
- /tests/performance/reports.test.ts

Success criteria:
- Query executes in <500ms for typical use
- All existing functionality preserved
- Performance test passes
- Documentation updated
```

### Method 3: Fix Memory Leak
### Method 4: Fix Race Condition
### Method 5: Fix Null Pointer Exception
### Method 6: Fix Authentication Bug
### Method 7: Fix Data Validation Error
### Method 8: Fix UI Rendering Issue
### Method 9: Fix API Response Error
### Method 10: Fix Database Connection Issue
### Method 11: Fix File Permission Error
### Method 12: Fix Encoding/Decoding Bug
### Method 13: Fix Timezone Handling Issue
### Method 14: Fix Concurrency Bug
### Method 15: Fix Edge Case Handling
### Method 16: Fix Input Sanitization Issue
### Method 17: Fix CORS Error
### Method 18: Fix Session Management Bug
### Method 19: Fix Cache Invalidation Issue
### Method 20: Fix Error Handling Logic

---

## Methods 21-50: Feature Implementation

### Method 21: Add New API Endpoint
**Good Example**:
```
Title: Add GET /api/users/:id/activity endpoint

Description:
Create a new REST API endpoint to retrieve user activity history.

Endpoint specification:
- Method: GET
- Path: /api/users/:id/activity
- Authentication: Required (JWT token)
- Authorization: User can only view their own activity, admins can view any

Request parameters:
- Path: id (user ID, integer)
- Query:
  * page (integer, default 1)
  * limit (integer, default 20, max 100)
  * startDate (ISO date string, optional)
  * endDate (ISO date string, optional)
  * activityType (string, optional: 'login', 'purchase', 'update')

Response format (200 OK):
```json
{
  "userId": 123,
  "activities": [
    {
      "id": 1,
      "type": "login",
      "timestamp": "2024-01-15T10:30:00Z",
      "ipAddress": "192.168.1.1",
      "metadata": {}
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 145,
    "totalPages": 8
  }
}
```

Error responses:
- 401: Unauthorized (no token)
- 403: Forbidden (accessing other user's data)
- 404: User not found
- 500: Server error

Implementation requirements:
1. Create route in /src/routes/users.ts
2. Create controller in /src/controllers/userActivity.ts
3. Create service in /src/services/userActivity.ts
4. Add database query in /src/database/userActivity.ts
5. Add input validation (use Joi schema)
6. Add permission middleware
7. Add rate limiting (100 requests/hour per user)
8. Write unit tests (>80% coverage)
9. Write integration tests
10. Add OpenAPI documentation
11. Update API docs in /docs/api

Database:
- Table: user_activities (already exists)
- Add index on user_id and timestamp if not exists

Success criteria:
- Endpoint works as specified
- All tests pass
- API documentation complete
- Performance: <200ms response time
```

**Why this is good**:
- ✅ Complete API specification
- ✅ Request/response formats defined
- ✅ Error cases covered
- ✅ Implementation checklist
- ✅ Database requirements
- ✅ Performance criteria

### Method 22: Add Authentication System
### Method 23: Implement File Upload Feature
### Method 24: Add Search Functionality
### Method 25: Implement Pagination
### Method 26: Add Filtering and Sorting
### Method 27: Implement Real-time Notifications
### Method 28: Add Export to CSV/Excel
### Method 29: Implement Email Service
### Method 30: Add Two-Factor Authentication
### Method 31: Implement OAuth Integration
### Method 32: Add Webhooks Support
### Method 33: Implement Rate Limiting
### Method 34: Add Caching Layer
### Method 35: Implement Background Jobs
### Method 36: Add Audit Logging
### Method 37: Implement Data Encryption
### Method 38: Add API Versioning
### Method 39: Implement GraphQL API
### Method 40: Add WebSocket Support
### Method 41: Implement Payment Integration
### Method 42: Add Multi-tenancy Support
### Method 43: Implement Role-Based Access Control
### Method 44: Add Internationalization (i18n)
### Method 45: Implement Dark Mode
### Method 46: Add Mobile Responsive Design
### Method 47: Implement Progressive Web App (PWA)
### Method 48: Add Analytics Integration
### Method 49: Implement A/B Testing
### Method 50: Add Feature Flags

---

## Methods 51-80: Code Refactoring

### Method 51: Refactor Large Function into Smaller Functions
**Good Example**:
```
Title: Refactor processOrder() function - split into smaller functions

Description:
The processOrder() function in /src/orders/processor.ts is 450 lines long and handles too many responsibilities.

Current state:
- File: /src/orders/processor.ts
- Function: processOrder()
- Lines: 450 lines
- Responsibilities: validation, payment, inventory, shipping, notifications, logging

Problems:
- Hard to test individual steps
- Hard to understand and maintain
- Violates Single Responsibility Principle
- High cyclomatic complexity (45)

Refactoring plan:
Split into separate functions:
1. validateOrder(order) - input validation
2. checkInventory(items) - inventory check
3. processPayment(payment) - payment processing
4. updateInventory(items) - inventory update
5. createShipment(order) - shipping creation
6. sendNotifications(order) - email/SMS notifications
7. logOrderProcessing(order, result) - audit logging

New structure:
```typescript
async function processOrder(order: Order): Promise<OrderResult> {
  const validatedOrder = await validateOrder(order);
  await checkInventory(validatedOrder.items);
  const payment = await processPayment(validatedOrder.payment);
  await updateInventory(validatedOrder.items);
  const shipment = await createShipment(validatedOrder);
  await sendNotifications(validatedOrder);
  const result = await logOrderProcessing(validatedOrder, { payment, shipment });
  return result;
}
```

Requirements:
- Each new function <50 lines
- Each function has single responsibility
- Add JSDoc to each function
- Write unit tests for each function
- Update integration tests
- Maintain backward compatibility
- Error handling in each step
- Add transaction rollback on failure

Success criteria:
- All functions <50 lines
- Cyclomatic complexity <10 per function
- Test coverage >85%
- All existing tests pass
- No behavior changes (only structure)
```

### Method 52: Extract Duplicate Code
### Method 53: Rename Variables for Clarity
### Method 54: Simplify Complex Conditional Logic
### Method 55: Remove Dead Code
### Method 56: Convert Callbacks to Async/Await
### Method 57: Replace Magic Numbers with Constants
### Method 58: Extract Configuration to Config Files
### Method 59: Implement Design Pattern
### Method 60: Reduce Function Parameters
### Method 61: Remove Code Duplication (DRY)
### Method 62: Simplify Nested Loops
### Method 63: Extract Class from Large Class
### Method 64: Improve Error Handling
### Method 65: Refactor Switch Statement to Polymorphism
### Method 66: Remove Unnecessary Comments
### Method 67: Improve Variable Naming
### Method 68: Consolidate Conditional Expressions
### Method 69: Replace Temp with Query
### Method 70: Introduce Parameter Object
### Method 71: Preserve Whole Object
### Method 72: Replace Array with Object
### Method 73: Change Bidirectional Association to Unidirectional
### Method 74: Replace Magic String with Constant
### Method 75: Encapsulate Field
### Method 76: Replace Type Code with Class
### Method 77: Replace Conditional with Polymorphism
### Method 78: Introduce Null Object
### Method 79: Extract Interface
### Method 80: Move Method to Appropriate Class

---

## Methods 81-110: Testing

### Method 81: Add Unit Tests for Module
**Good Example**:
```
Title: Add comprehensive unit tests for authentication module

Description:
The authentication module in /src/auth/ has no tests. Add complete unit test coverage.

Modules to test:
- /src/auth/login.ts
- /src/auth/register.ts
- /src/auth/passwordReset.ts
- /src/auth/tokenManager.ts

Testing framework: Jest
Target coverage: >85%

Test requirements for each module:

1. login.ts tests:
   - ✅ Successful login with valid credentials
   - ✅ Failed login with invalid password
   - ✅ Failed login with non-existent user
   - ✅ Account lockout after 5 failed attempts
   - ✅ Login with remember me option
   - ✅ Login updates last_login timestamp
   - ✅ Login generates valid JWT token

2. register.ts tests:
   - ✅ Successful registration with valid data
   - ✅ Duplicate email rejection
   - ✅ Password strength validation
   - ✅ Email format validation
   - ✅ Username validation (length, chars)
   - ✅ Account activation email sent

3. passwordReset.ts tests:
   - ✅ Generate password reset token
   - ✅ Token expiration (24 hours)
   - ✅ Reset password with valid token
   - ✅ Reject expired token
   - ✅ Reject used token
   - ✅ Email notification sent

4. tokenManager.ts tests:
   - ✅ Generate valid JWT token
   - ✅ Verify valid token
   - ✅ Reject expired token
   - ✅ Reject tampered token
   - ✅ Refresh token generation
   - ✅ Token payload includes correct claims

Test structure:
```typescript
describe('Authentication Module', () => {
  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      // Arrange
      // Act
      // Assert
    });
    // ... more tests
  });
});
```

Mocking requirements:
- Mock database calls
- Mock email service
- Mock JWT library (test token structure)
- Mock bcrypt (test password hashing)

Coverage requirements:
- Line coverage: >85%
- Branch coverage: >80%
- Function coverage: >90%

Output location: /tests/unit/auth/

Success criteria:
- All tests pass
- Coverage targets met
- No skipped tests
- Tests run in <5 seconds
```

### Method 82: Add Integration Tests
### Method 83: Add End-to-End Tests
### Method 84: Add Performance Tests
### Method 85: Add Security Tests
### Method 86: Add API Contract Tests
### Method 87: Add Load Tests
### Method 88: Add Regression Tests
### Method 89: Add Smoke Tests
### Method 90: Add Visual Regression Tests
### Method 91: Add Accessibility Tests
### Method 92: Add Cross-Browser Tests
### Method 93: Add Mobile Tests
### Method 94: Add Database Migration Tests
### Method 95: Add Error Handling Tests
### Method 96: Add Edge Case Tests
### Method 97: Add Mutation Tests
### Method 98: Add Snapshot Tests
### Method 99: Add Fuzz Tests
### Method 100: Add Chaos Engineering Tests

---

## Methods 101-120: Code Quality & Linting

### Method 101: Fix ESLint Errors
**Good Example**:
```
Title: Fix all ESLint errors in /src directory

Description:
The codebase has 47 ESLint errors that need to be fixed.

Current state:
- Total errors: 47
- Total warnings: 123
- ESLint version: 8.45.0
- Config: eslint.config.mjs

Error breakdown:
- no-unused-vars: 15 errors
- no-undef: 8 errors
- prefer-const: 12 errors
- no-console: 7 errors (production code)
- eqeqeq: 5 errors (use === instead of ==)

Directories affected:
- /src/services: 20 errors
- /src/controllers: 15 errors
- /src/utils: 12 errors

Requirements:
- Fix all 47 errors (warnings can remain)
- Do not disable ESLint rules
- Maintain code functionality
- Add types where missing (TypeScript)
- Remove unused imports and variables
- Replace console.log with proper logger
- Use strict equality (===)
- Prefer const over let where possible

Test requirements:
- Run full test suite after fixes
- Ensure no functionality breaks
- Add tests if coverage drops

Validation:
```bash
npm run lint  # Should show 0 errors
npm test      # All tests pass
```

Success criteria:
- ESLint shows 0 errors
- All tests pass
- Code functionality unchanged
```

### Method 102: Set Up Prettier
### Method 103: Configure TypeScript Strict Mode
### Method 104: Fix Type Errors
### Method 105: Add Pre-commit Hooks
### Method 106: Set Up Husky for Git Hooks
### Method 107: Configure EditorConfig
### Method 108: Add Code Coverage Reporting
### Method 109: Set Up SonarQube
### Method 110: Configure Dependency Security Scanning
### Method 111: Set Up License Compliance Checking
### Method 112: Add Code Complexity Analysis
### Method 113: Configure Bundle Size Monitoring
### Method 114: Set Up Dead Code Detection
### Method 115: Add Spell Checker for Code
### Method 116: Configure Import Sorting
### Method 117: Set Up Commit Message Linting
### Method 118: Add Unused Exports Detection
### Method 119: Configure Circular Dependency Detection
### Method 120: Set Up Duplicate Code Detection

---

## Methods 121-144: Advanced Development

### Method 121: Implement CI/CD Pipeline
**Good Example**:
```
Title: Set up GitHub Actions CI/CD pipeline

Description:
Create a complete CI/CD pipeline using GitHub Actions for automated testing and deployment.

Pipeline stages:

1. **Continuous Integration (on push, pull request)**
   - Checkout code
   - Set up Node.js 18 & 20 (matrix)
   - Install dependencies (npm ci)
   - Run linter (ESLint)
   - Run type checker (TypeScript)
   - Run unit tests
   - Run integration tests
   - Upload coverage to Codecov
   - Build project
   - Run security scan (npm audit)

2. **Continuous Deployment (on tag push)**
   - All CI checks pass
   - Build Docker image
   - Push to Docker Hub
   - Deploy to staging environment
   - Run smoke tests on staging
   - Deploy to production (manual approval)
   - Run smoke tests on production
   - Create GitHub release
   - Publish to npm registry

Workflow files to create:
- .github/workflows/ci.yml (CI pipeline)
- .github/workflows/cd.yml (CD pipeline)
- .github/workflows/security.yml (Security scans)

CI Requirements:
```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm test
      - run: npm run build
```

Secrets to configure:
- DOCKER_HUB_USERNAME
- DOCKER_HUB_TOKEN
- NPM_TOKEN
- CODECOV_TOKEN

Success criteria:
- Pipeline runs on every push
- All stages complete successfully
- Failed builds block merging
- Coverage reports generated
- Deployments automated
```

### Method 122: Implement Database Migrations
### Method 123: Add Database Seeding
### Method 124: Implement Backup System
### Method 125: Add Monitoring and Alerts
### Method 126: Implement Logging System
### Method 127: Add Performance Monitoring
### Method 128: Implement Error Tracking (Sentry)
### Method 129: Add Health Check Endpoints
### Method 130: Implement API Documentation Generation
### Method 131: Add Request/Response Logging
### Method 132: Implement Data Migration Scripts
### Method 133: Add Database Connection Pooling
### Method 134: Implement Query Optimization
### Method 135: Add Database Indexing
### Method 136: Implement Full-Text Search
### Method 137: Add File Storage System (S3)
### Method 138: Implement CDN Integration
### Method 139: Add Message Queue (RabbitMQ, Redis)
### Method 140: Implement Event Sourcing
### Method 141: Add Command Query Responsibility Segregation (CQRS)
### Method 142: Implement Microservices Architecture
### Method 143: Add Service Discovery
### Method 144: Implement API Gateway

---

# Часть 3: Issues для кода (144 способа)

## Методы 1-20: Исправление багов

### Метод 1: Исправление конкретного бага с сообщением об ошибке
**Хороший пример**:
```
Заголовок: Исправить TypeError при вызове agent.execute() без параметров

Описание:
Функция agent.execute() выбрасывает TypeError при вызове без параметров, но вместо этого должна использовать параметры по умолчанию.

Сообщение об ошибке:
```
TypeError: Cannot read property 'command' of undefined
  at Agent.execute (/src/agent/agent.ts:45:23)
  at main (/src/index.ts:12:15)
```

Шаги для воспроизведения:
1. Импортировать agent: `import { Agent } from './src/agent/agent.ts'`
2. Создать экземпляр: `const agent = new Agent()`
3. Вызвать без параметров: `agent.execute()`
4. Возникает ошибка

Ожидаемое поведение:
- Должны использоваться пустые параметры по умолчанию: `{ command: '', options: {} }`
- Не должна выбрасываться ошибка
- Должен возвращаться пустой объект результата

Затронутые файлы:
- /src/agent/agent.ts (строка 45)
- /src/agent/agent.test.ts (нужен тест-кейс)

Требования к исправлению:
- Добавить валидацию параметров
- Добавить параметры по умолчанию
- Добавить тест для этого сценария
- Обновить JSDoc для уточнения требований к параметрам

Критерии успеха:
- `agent.execute()` работает без выброса ошибки
- Все существующие тесты проходят
- Новый тест добавлен и проходит
```

### Метод 21: Добавление нового API endpoint
**Хороший пример**:
```
Заголовок: Добавить GET /api/users/:id/activity endpoint

Описание:
Создать новый REST API endpoint для получения истории активности пользователя.

Спецификация endpoint:
- Метод: GET
- Путь: /api/users/:id/activity
- Аутентификация: Требуется (JWT токен)
- Авторизация: Пользователь может просматривать только свою активность, администраторы могут просматривать любую

Параметры запроса:
- Путь: id (ID пользователя, integer)
- Query:
  * page (integer, по умолчанию 1)
  * limit (integer, по умолчанию 20, максимум 100)
  * startDate (ISO строка даты, опционально)
  * endDate (ISO строка даты, опционально)
  * activityType (string, опционально: 'login', 'purchase', 'update')

Формат ответа (200 OK):
```json
{
  "userId": 123,
  "activities": [
    {
      "id": 1,
      "type": "login",
      "timestamp": "2024-01-15T10:30:00Z",
      "ipAddress": "192.168.1.1",
      "metadata": {}
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 145,
    "totalPages": 8
  }
}
```

Ответы с ошибками:
- 401: Неавторизован (нет токена)
- 403: Запрещено (доступ к данным другого пользователя)
- 404: Пользователь не найден
- 500: Ошибка сервера

Требования к реализации:
1. Создать маршрут в /src/routes/users.ts
2. Создать контроллер в /src/controllers/userActivity.ts
3. Создать сервис в /src/services/userActivity.ts
4. Добавить запрос к базе данных в /src/database/userActivity.ts
5. Добавить валидацию ввода (использовать Joi схему)
6. Добавить middleware для проверки прав
7. Добавить ограничение запросов (100 запросов/час на пользователя)
8. Написать unit тесты (>80% покрытие)
9. Написать интеграционные тесты
10. Добавить OpenAPI документацию
11. Обновить API документацию в /docs/api

База данных:
- Таблица: user_activities (уже существует)
- Добавить индекс на user_id и timestamp если не существует

Критерии успеха:
- Endpoint работает как указано
- Все тесты проходят
- API документация полная
- Производительность: <200мс время ответа
```

---

# Parte 3: Issues para Código (144 Métodos)

## Métodos 1-20: Corrección de Bugs

### Método 1: Corregir Bug Específico con Mensaje de Error
**Buen Ejemplo**:
```
Título: Corregir TypeError al llamar agent.execute() sin parámetros

Descripción:
La función agent.execute() lanza un TypeError cuando se llama sin parámetros, pero debería usar parámetros predeterminados.

Mensaje de error:
```
TypeError: Cannot read property 'command' of undefined
  at Agent.execute (/src/agent/agent.ts:45:23)
  at main (/src/index.ts:12:15)
```

Pasos para reproducir:
1. Importar agent: `import { Agent } from './src/agent/agent.ts'`
2. Crear instancia: `const agent = new Agent()`
3. Llamar sin parámetros: `agent.execute()`
4. Ocurre el error

Comportamiento esperado:
- Debería usar parámetros vacíos predeterminados: `{ command: '', options: {} }`
- No debería lanzar error
- Debería devolver objeto de resultado vacío

Archivos afectados:
- /src/agent/agent.ts (línea 45)
- /src/agent/agent.test.ts (necesita caso de prueba)

Requisitos de corrección:
- Agregar validación de parámetros
- Agregar parámetros predeterminados
- Agregar caso de prueba para este escenario
- Actualizar JSDoc para aclarar requisitos de parámetros

Criterios de éxito:
- `agent.execute()` funciona sin lanzar error
- Todas las pruebas existentes pasan
- Nueva prueba agregada y pasa
```

---

# Part 4: File Attachments in GitHub Issues

## Understanding File Attachments

GitHub Issues support file attachments to help you provide context, examples, and evidence for your requests.

### Supported File Types

GitHub supports a wide range of file types for attachments:

**Images:**
- PNG, JPG, JPEG, GIF, WEBP, SVG
- Maximum size: **10 MB per image**

**Documents:**
- PDF, DOCX, XLSX, PPTX, TXT, MD
- Maximum size: **25 MB per file**

**Videos:**
- MP4, MOV, WEBM
- Free plans: **10 MB**
- Paid plans: **100 MB**

**Archives:**
- ZIP, TAR, GZ
- Maximum size: **25 MB**

**Code files:**
- Any programming language source files
- Log files, configuration files
- Maximum size: **25 MB**

### Where Files Are Stored

**Important**: Files attached to issues are stored on GitHub's CDN (Content Delivery Network), **NOT in your Git repository**.

- ✅ Do NOT count toward your repository's 100 GB storage limit
- ✅ Do NOT appear in Git history
- ✅ Accessible via unique URLs
- ⚠️ Private repo attachments require authentication
- ⚠️ Public repo attachments are publicly accessible via URL

### How AI Agents Process Attachments

**ClaudeCode and the Hive Mind agents CAN process attached files:**

1. **Images (PNG, JPG, PDF screenshots)**
   - ✅ AI can view and analyze images
   - ✅ Can extract text from image screenshots
   - ✅ Can understand diagrams, charts, UI mockups
   - ✅ Can read code from screenshots (but prefer text)
   - ⚠️ Quality matters - high DPI recommended

2. **PDFs**
   - ✅ AI can read text from PDFs
   - ✅ Can extract tables and structured data
   - ✅ Can understand multi-page documents
   - ⚠️ Scanned PDFs may need OCR first
   - ⚠️ Very large PDFs may be truncated

3. **Code Files**
   - ✅ Can read source code directly
   - ✅ Better to attach code than screenshot it
   - ✅ Maintains syntax highlighting
   - ✅ Preserves formatting

4. **Log Files**
   - ✅ Can analyze error logs
   - ✅ Can find patterns in logs
   - ⚠️ Very large logs may be truncated
   - 💡 Better to include relevant excerpts in issue text

### Best Practices for Attachments

#### DO:
✅ **Attach visual references** - UI mockups, design comps, screenshots
✅ **Attach error screenshots** - Show the actual error in context
✅ **Attach sample data files** - CSV, JSON examples for processing
✅ **Attach PDFs for context** - Specifications, requirements documents
✅ **Use descriptive filenames** - `login-error-screenshot.png` not `image1.png`
✅ **Compress large files** - Especially for multiple files
✅ **Include image captions** - Explain what the image shows

#### DON'T:
❌ **Don't attach sensitive data** - Tokens, passwords, credentials
❌ **Don't exceed size limits** - Split large files if needed
❌ **Don't attach instead of describing** - Always include text description
❌ **Don't use screenshots for code** - Copy/paste code as text
❌ **Don't attach unnecessary files** - Only relevant materials

### Examples of Good Attachment Usage

#### Example 1: UI Bug Report with Screenshot
```
Title: Login button misaligned on mobile screens

Description:
The login button on the homepage is misaligned on mobile screens below 768px width.

Steps to reproduce:
1. Open homepage on mobile device or resize browser to 375px width
2. Scroll to login section
3. Observe button alignment

Expected: Button should be centered
Actual: Button is aligned to the left with 20px overflow

**Screenshot attached:** `login-button-mobile-issue.png` (shows the misalignment)

Browser: Chrome Mobile 120
Device: iPhone 12 Pro
Screen width: 390px
```

#### Example 2: PDF Processing Request
```
Title: Extract data from 10 invoice PDFs and create CSV

Description:
I have 10 invoice PDFs that need data extraction.

**Files attached:** `sample-invoice.pdf` (example of invoice format)

Each invoice contains:
- Invoice number
- Date
- Customer name
- Line items (product, quantity, price)
- Total amount

Required output:
CSV file with columns: invoice_number, date, customer_name, line_items (JSON), total

All 10 PDFs follow the same format as the sample attached.
```

#### Example 3: Image Processing with Examples
```
Title: Batch resize product images and add watermark

Description:
Need to process 50 product images.

**Files attached:**
- `product-sample-before.jpg` - Example of current image
- `product-sample-after.jpg` - Example of desired result
- `watermark-logo.png` - Logo to use as watermark

Requirements:
- Resize all images to 1200x1200px
- Add watermark in bottom-right corner
- Watermark should be 20% opacity
- Save as WEBP format
- Maintain image quality

Source directory: /products/raw/
Output directory: /products/processed/
```

### Attachment Limitations

**GitHub Limits:**
- Maximum 10 files per comment
- Each file limited to size restrictions above
- Total comment size (text + attachments) limited

**AI Processing Limits:**
- Large PDFs may be truncated (provide page numbers for specific pages)
- Very high-resolution images may be downscaled
- Binary files cannot be processed (executables, compiled code)
- Encrypted/password-protected files cannot be read

### How to Attach Files

**Via Web Interface:**
1. Drag and drop files into the issue text box
2. Or click the "Attach files by dragging & dropping, selecting or pasting them" link
3. Files upload automatically and insert markdown link

**Via API/CLI:**
- GitHub API supports file uploads via `POST` requests
- Files are converted to markdown image/link syntax
- URLs are generated automatically

**Markdown Syntax After Upload:**
```markdown
![image-description](https://user-images.githubusercontent.com/...)
[document.pdf](https://github.com/user-attachments/files/...)
```

---

# Часть 4: Прикрепление файлов к GitHub Issues

## Понимание прикрепления файлов

GitHub Issues поддерживают прикрепление файлов, чтобы помочь вам предоставить контекст, примеры и доказательства для ваших запросов.

### Поддерживаемые типы файлов

GitHub поддерживает широкий спектр типов файлов для вложений:

**Изображения:**
- PNG, JPG, JPEG, GIF, WEBP, SVG
- Максимальный размер: **10 МБ на изображение**

**Документы:**
- PDF, DOCX, XLSX, PPTX, TXT, MD
- Максимальный размер: **25 МБ на файл**

**Видео:**
- MP4, MOV, WEBM
- Бесплатные планы: **10 МБ**
- Платные планы: **100 МБ**

**Архивы:**
- ZIP, TAR, GZ
- Максимальный размер: **25 МБ**

**Файлы кода:**
- Исходные файлы любого языка программирования
- Лог-файлы, конфигурационные файлы
- Максимальный размер: **25 МБ**

### Где хранятся файлы

**Важно**: Файлы, прикрепленные к issues, хранятся в CDN (Content Delivery Network) GitHub, **НЕ в вашем Git репозитории**.

- ✅ НЕ учитываются в лимите хранилища репозитория 100 ГБ
- ✅ НЕ появляются в истории Git
- ✅ Доступны через уникальные URL
- ⚠️ Вложения в приватных репозиториях требуют аутентификации
- ⚠️ Вложения в публичных репозиториях публично доступны через URL

### Как AI-агенты обрабатывают вложения

**ClaudeCode и агенты Hive Mind МОГУТ обрабатывать прикрепленные файлы:**

1. **Изображения (PNG, JPG, скриншоты PDF)**
   - ✅ AI может просматривать и анализировать изображения
   - ✅ Может извлекать текст из скриншотов изображений
   - ✅ Может понимать диаграммы, графики, макеты UI
   - ✅ Может читать код со скриншотов (но лучше текст)
   - ⚠️ Качество имеет значение - рекомендуется высокий DPI

2. **PDFs**
   - ✅ AI может читать текст из PDF
   - ✅ Может извлекать таблицы и структурированные данные
   - ✅ Может понимать многостраничные документы
   - ⚠️ Сканированные PDF могут сначала требовать OCR
   - ⚠️ Очень большие PDF могут быть обрезаны

3. **Файлы кода**
   - ✅ Может читать исходный код напрямую
   - ✅ Лучше прикреплять код, чем делать скриншот
   - ✅ Сохраняет подсветку синтаксиса
   - ✅ Сохраняет форматирование

4. **Лог-файлы**
   - ✅ Может анализировать логи ошибок
   - ✅ Может находить паттерны в логах
   - ⚠️ Очень большие логи могут быть обрезаны
   - 💡 Лучше включать релевантные выдержки в текст issue

### Лучшие практики для вложений

#### ДЕЛАЙТЕ:
✅ **Прикрепляйте визуальные ссылки** - макеты UI, дизайн-комплекты, скриншоты
✅ **Прикрепляйте скриншоты ошибок** - Показывайте фактическую ошибку в контексте
✅ **Прикрепляйте файлы с образцами данных** - примеры CSV, JSON для обработки
✅ **Прикрепляйте PDF для контекста** - спецификации, документы требований
✅ **Используйте описательные имена файлов** - `login-error-screenshot.png` не `image1.png`
✅ **Сжимайте большие файлы** - Особенно для нескольких файлов
✅ **Включайте подписи к изображениям** - Объясняйте, что показывает изображение

#### НЕ ДЕЛАЙТЕ:
❌ **Не прикрепляйте конфиденциальные данные** - токены, пароли, учетные данные
❌ **Не превышайте лимиты размера** - Разделяйте большие файлы при необходимости
❌ **Не прикрепляйте вместо описания** - Всегда включайте текстовое описание
❌ **Не используйте скриншоты для кода** - Копируйте/вставляйте код как текст
❌ **Не прикрепляйте ненужные файлы** - Только релевантные материалы

---

# Parte 4: Adjuntar Archivos en GitHub Issues

## Entendiendo los Adjuntos de Archivos

GitHub Issues soporta adjuntar archivos para ayudarte a proporcionar contexto, ejemplos y evidencia para tus solicitudes.

### Tipos de Archivos Soportados

GitHub soporta una amplia gama de tipos de archivos para adjuntos:

**Imágenes:**
- PNG, JPG, JPEG, GIF, WEBP, SVG
- Tamaño máximo: **10 MB por imagen**

**Documentos:**
- PDF, DOCX, XLSX, PPTX, TXT, MD
- Tamaño máximo: **25 MB por archivo**

**Videos:**
- MP4, MOV, WEBM
- Planes gratuitos: **10 MB**
- Planes pagos: **100 MB**

**Archivos comprimidos:**
- ZIP, TAR, GZ
- Tamaño máximo: **25 MB**

**Archivos de código:**
- Archivos fuente de cualquier lenguaje de programación
- Archivos de registro, archivos de configuración
- Tamaño máximo: **25 MB**

### Dónde se Almacenan los Archivos

**Importante**: Los archivos adjuntos a issues se almacenan en el CDN (Content Delivery Network) de GitHub, **NO en tu repositorio Git**.

- ✅ NO cuentan para el límite de almacenamiento de 100 GB del repositorio
- ✅ NO aparecen en el historial de Git
- ✅ Accesibles vía URLs únicas
- ⚠️ Los adjuntos de repositorios privados requieren autenticación
- ⚠️ Los adjuntos de repositorios públicos son públicamente accesibles vía URL

### Cómo los Agentes AI Procesan los Adjuntos

**ClaudeCode y los agentes Hive Mind PUEDEN procesar archivos adjuntos:**

1. **Imágenes (PNG, JPG, capturas de pantalla de PDF)**
   - ✅ La AI puede ver y analizar imágenes
   - ✅ Puede extraer texto de capturas de pantalla de imágenes
   - ✅ Puede entender diagramas, gráficos, maquetas de UI
   - ✅ Puede leer código de capturas de pantalla (pero prefiere texto)
   - ⚠️ La calidad importa - se recomienda alta resolución DPI

2. **PDFs**
   - ✅ La AI puede leer texto de PDFs
   - ✅ Puede extraer tablas y datos estructurados
   - ✅ Puede entender documentos de múltiples páginas
   - ⚠️ PDFs escaneados pueden necesitar OCR primero
   - ⚠️ PDFs muy grandes pueden ser truncados

3. **Archivos de Código**
   - ✅ Puede leer código fuente directamente
   - ✅ Mejor adjuntar código que hacer captura de pantalla
   - ✅ Mantiene resaltado de sintaxis
   - ✅ Preserva formato

4. **Archivos de Registro**
   - ✅ Puede analizar registros de errores
   - ✅ Puede encontrar patrones en registros
   - ⚠️ Registros muy grandes pueden ser truncados
   - 💡 Mejor incluir extractos relevantes en el texto del issue

---

# Part 5: Custom Commands in .claude Directory

## Understanding .claude/commands

Custom slash commands allow you to create reusable prompts that ClaudeCode can execute. This is particularly useful for repetitive tasks in your Hive Mind workflow.

### Do You Need Custom Commands for Agents?

**Short Answer:** It depends on your workflow.

**For Basic Issue Solving:** No
- Hive Mind agents work perfectly without custom commands
- Issues provide all context needed
- ClaudeCode has built-in intelligence

**For Advanced Workflows:** Yes
- Repetitive tasks across multiple issues
- Standardized code review processes
- Custom deployment procedures
- Team-specific workflows

### Directory Structure

```
your-repo/
├── .claude/
│   └── commands/
│       ├── review.md         # Project-specific command
│       ├── deploy.md         # Project-specific command
│       └── namespace/
│           └── analyze.md    # Namespaced command
└── ~/.claude/
    └── commands/
        └── personal.md       # Personal command (all projects)
```

**Project-specific:** `.claude/commands/` (version controlled)
**Personal:** `~/.claude/commands/` (not in repo)

### Creating a Custom Command

**Basic syntax:**
```markdown
---
description: Short description of what this command does
---

Your prompt text here. This is what ClaudeCode will execute.

You can use $ARGUMENTS to pass parameters.
```

**Example 1: Code Review Command**

File: `.claude/commands/review.md`
```markdown
---
description: Perform comprehensive code review on specified files
---

Perform a thorough code review on $ARGUMENTS.

Check for:
1. Code quality and adherence to project style guide
2. Potential bugs and edge cases
3. Performance issues
4. Security vulnerabilities
5. Missing tests
6. Documentation completeness

Provide:
- List of issues found (categorized by severity)
- Specific line numbers for each issue
- Suggested fixes
- Overall code quality score (1-10)

Format output as markdown with clear sections.
```

**Usage:**
```bash
/review src/auth/login.ts
```

**Example 2: Multilingual Documentation Command**

File: `.claude/commands/translate-docs.md`
```markdown
---
description: Translate documentation file to Russian and Spanish
---

Translate the file $ARGUMENTS to Russian and Spanish.

Requirements:
- Create [filename]_RU.md with Russian translation
- Create [filename]_ES.md with Spanish translation
- Preserve all markdown formatting
- Keep code blocks unchanged
- Maintain link structure
- Use technical terminology correctly
- Keep project-specific terms in English

Quality:
- Native speaker quality
- Technical accuracy
- Consistent terminology

Verify:
- All sections translated
- Markdown renders correctly
- Links work
```

**Usage:**
```bash
/translate-docs docs/API.md
```

**Example 3: Issue Analyzer Command**

File: `.claude/commands/analyze-issue.md`
```markdown
---
description: Analyze GitHub issue and create implementation plan
---

Analyze the GitHub issue: $ARGUMENTS

Provide:

1. **Issue Summary**
   - Type: Bug/Feature/Documentation/Other
   - Complexity: Low/Medium/High
   - Estimated effort: Hours/Days

2. **Requirements Analysis**
   - Explicit requirements (stated)
   - Implicit requirements (inferred)
   - Edge cases to consider
   - Potential blockers

3. **Technical Approach**
   - Affected files
   - Suggested implementation strategy
   - Dependencies needed
   - Database changes (if any)

4. **Implementation Plan**
   - Step-by-step tasks
   - Testing strategy
   - Documentation updates needed

5. **Risk Assessment**
   - Potential issues
   - Breaking changes
   - Migration needs

Format as detailed markdown report.
```

**Usage:**
```bash
/analyze-issue https://github.com/owner/repo/issues/123
```

### Advanced Features

#### Using Positional Arguments

Instead of `$ARGUMENTS`, you can use `$1`, `$2`, etc. for specific parameters:

```markdown
---
description: Compare two files and highlight differences
---

Compare files:
- File 1: $1
- File 2: $2

Provide:
- Side-by-side diff
- Summary of changes
- Recommendations
```

**Usage:**
```bash
/compare-files src/old.ts src/new.ts
```

#### Disable Auto-Invocation

If you don't want ClaudeCode to automatically invoke your command, add to frontmatter:

```markdown
---
description: Manual deployment command
disable-model-invocation: true
---

Deploy to production...
```

This requires manual user execution - Claude won't invoke it automatically.

#### Namespaced Commands

Organize commands in folders:

```
.claude/commands/
├── git/
│   ├── commit.md
│   └── pr.md
├── test/
│   ├── unit.md
│   └── integration.md
```

**Usage:**
```bash
/git/commit
/test/unit
```

### Best Practices for Commands

#### DO:
✅ **Write clear descriptions** - Helps Claude know when to use the command
✅ **Include examples in the prompt** - Shows expected output format
✅ **Use parameters for flexibility** - Makes commands reusable
✅ **Document in project README** - Team members know available commands
✅ **Version control project commands** - Share across team

#### DON'T:
❌ **Don't hardcode paths** - Use parameters instead
❌ **Don't make commands too specific** - Reduce reusability
❌ **Don't forget descriptions** - Claude won't know when to use them
❌ **Don't include secrets** - Commands are plain text in repo

### Example Commands for Hive Mind

**Command: Create Issue Analysis**

`.claude/commands/hive/analyze.md`
```markdown
---
description: Analyze issue and determine if it's suitable for Hive Mind
---

Analyze this issue: $ARGUMENTS

Determine:
1. Is this issue well-defined enough for autonomous solving?
2. Does it have clear success criteria?
3. Are there any ambiguities that need clarification?
4. What type of issue is this? (photo/pdf processing, documentation, code)
5. Estimated complexity for AI agent

Provide recommendation:
- ✅ Ready for Hive Mind (with confidence score)
- ⚠️ Needs clarification (list questions to ask)
- ❌ Not suitable (explain why)
```

**Command: Pre-commit Quality Check**

`.claude/commands/quality.md`
```markdown
---
description: Run all quality checks before committing
---

Run comprehensive quality checks on staged files.

Execute:
1. Linter (ESLint/Prettier)
2. Type checker (TypeScript)
3. Unit tests related to changed files
4. Security scan (npm audit)
5. Check for console.log statements
6. Check for TODO comments
7. Verify all imports used

Report:
- ✅ All checks passed - safe to commit
- ❌ Issues found - fix before committing
  * List each issue with file and line number
  * Suggest fixes
```

### Integration with MCP Servers

MCP (Model Context Protocol) servers can expose prompts as slash commands automatically. If you're using MCP servers with Hive Mind, their commands will appear alongside your custom commands.

**No configuration needed** - MCP commands are auto-discovered.

---

# Часть 5: Пользовательские команды в .claude директории

## Понимание .claude/commands

Пользовательские slash-команды позволяют создавать многоразовые промпты, которые ClaudeCode может выполнять. Это особенно полезно для повторяющихся задач в вашем рабочем процессе Hive Mind.

### Нужны ли пользовательские команды для агентов?

**Короткий ответ:** Зависит от вашего рабочего процесса.

**Для базового решения issues:** Нет
- Агенты Hive Mind отлично работают без пользовательских команд
- Issues предоставляют весь необходимый контекст
- ClaudeCode имеет встроенный интеллект

**Для продвинутых рабочих процессов:** Да
- Повторяющиеся задачи в нескольких issues
- Стандартизированные процессы код-ревью
- Пользовательские процедуры развертывания
- Специфичные для команды рабочие процессы

### Структура директорий

```
your-repo/
├── .claude/
│   └── commands/
│       ├── review.md         # Команда для проекта
│       ├── deploy.md         # Команда для проекта
│       └── namespace/
│           └── analyze.md    # Команда с пространством имен
└── ~/.claude/
    └── commands/
        └── personal.md       # Личная команда (все проекты)
```

**Для проекта:** `.claude/commands/` (под контролем версий)
**Личные:** `~/.claude/commands/` (не в репозитории)

### Создание пользовательской команды

**Базовый синтаксис:**
```markdown
---
description: Краткое описание того, что делает эта команда
---

Текст вашего промпта здесь. Это то, что ClaudeCode будет выполнять.

Вы можете использовать $ARGUMENTS для передачи параметров.
```

**Пример 1: Команда код-ревью**

Файл: `.claude/commands/review.md`
```markdown
---
description: Выполнить комплексный код-ревью указанных файлов
---

Выполни тщательный код-ревью на $ARGUMENTS.

Проверь:
1. Качество кода и соответствие руководству по стилю проекта
2. Потенциальные баги и крайние случаи
3. Проблемы производительности
4. Уязвимости безопасности
5. Отсутствующие тесты
6. Полноту документации

Предоставь:
- Список найденных проблем (категоризированных по серьезности)
- Конкретные номера строк для каждой проблемы
- Предлагаемые исправления
- Общую оценку качества кода (1-10)

Форматируй вывод как markdown с четкими секциями.
```

**Использование:**
```bash
/review src/auth/login.ts
```

---

# Parte 5: Comandos Personalizados en el Directorio .claude

## Entendiendo .claude/commands

Los comandos slash personalizados te permiten crear prompts reutilizables que ClaudeCode puede ejecutar. Esto es particularmente útil para tareas repetitivas en tu flujo de trabajo de Hive Mind.

### ¿Necesitas Comandos Personalizados para Agentes?

**Respuesta Corta:** Depende de tu flujo de trabajo.

**Para Resolución Básica de Issues:** No
- Los agentes de Hive Mind funcionan perfectamente sin comandos personalizados
- Los issues proporcionan todo el contexto necesario
- ClaudeCode tiene inteligencia incorporada

**Para Flujos de Trabajo Avanzados:** Sí
- Tareas repetitivas en múltiples issues
- Procesos estandarizados de revisión de código
- Procedimientos de despliegue personalizados
- Flujos de trabajo específicos del equipo

### Estructura de Directorios

```
your-repo/
├── .claude/
│   └── commands/
│       ├── review.md         # Comando específico del proyecto
│       ├── deploy.md         # Comando específico del proyecto
│       └── namespace/
│           └── analyze.md    # Comando con espacio de nombres
└── ~/.claude/
    └── commands/
        └── personal.md       # Comando personal (todos los proyectos)
```

**Específico del proyecto:** `.claude/commands/` (control de versiones)
**Personal:** `~/.claude/commands/` (no en repo)

### Creando un Comando Personalizado

**Sintaxis básica:**
```markdown
---
description: Breve descripción de lo que hace este comando
---

Tu texto de prompt aquí. Esto es lo que ClaudeCode ejecutará.

Puedes usar $ARGUMENTS para pasar parámetros.
```

**Ejemplo 1: Comando de Revisión de Código**

Archivo: `.claude/commands/review.md`
```markdown
---
description: Realizar revisión exhaustiva de código en archivos especificados
---

Realiza una revisión exhaustiva de código en $ARGUMENTS.

Verifica:
1. Calidad de código y adherencia a la guía de estilo del proyecto
2. Bugs potenciales y casos extremos
3. Problemas de rendimiento
4. Vulnerabilidades de seguridad
5. Pruebas faltantes
6. Completitud de documentación

Proporciona:
- Lista de problemas encontrados (categorizados por severidad)
- Números de línea específicos para cada problema
- Correcciones sugeridas
- Puntuación general de calidad de código (1-10)

Formatea la salida como markdown con secciones claras.
```

**Uso:**
```bash
/review src/auth/login.ts
```

---

## Summary Table

| Category | English Count | Russian Count | Spanish Count |
|----------|---------------|---------------|---------------|
| Photo & PDF | 55 methods | 55 методов | 55 métodos |
| Documentation | 89 methods | 89 методов | 89 métodos |
| Code | 144 methods | 144 метода | 144 métodos |
| **Total** | **288 methods** | **288 методов** | **288 métodos** |

---

## Quick Reference: Issue Template

```markdown
Title: [Action] + [Target] + [Location/Context]

Description:
[Clear explanation of what you want to achieve]

[For code/bugs: Error messages, stack traces]
[For features: Detailed requirements]
[For docs: Target audience, format]

Source/Current state:
- [What exists now]
- [Where it is]

Requirements:
- [Specific requirement 1]
- [Specific requirement 2]
- [Quality/performance criteria]

Expected output:
- [What should be created/changed]
- [Where it should be]
- [Format/structure]

Success criteria:
- [How to verify it works]
- [Measurable outcomes]

[Optional: Attach relevant files - images, PDFs, logs]
```

---

## Sources / Источники / Fuentes

**GitHub Documentation:**
- [Attaching files - GitHub Docs](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files)
- [Expanded file type support for attachments](https://github.blog/changelog/2025-08-13-expanded-file-type-support-for-attachments-across-issues-pull-requests-and-discussions/)
- [Attachment size limit discussion](https://github.com/orgs/community/discussions/46513)

**Claude Code Documentation:**
- [Slash commands - Claude Code Docs](https://code.claude.com/docs/en/slash-commands)
- [Custom Commands in Claude Code](https://www.lexo.ch/blog/2025/12/automate-repetitive-prompts-with-claude-code-custom-commands/)
- [Claude Code: Best practices for agentic coding](https://www.anthropic.com/engineering/claude-code-best-practices)

**Community Resources:**
- [awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code)
- [Production-ready slash commands](https://github.com/wshobson/commands)

---

**Last Updated:** 2025-12-10
**Version:** 1.0.0
**License:** Unlicense (Public Domain)
