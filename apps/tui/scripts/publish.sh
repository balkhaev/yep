#!/usr/bin/env bash
set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

VERSION_TYPE="${1:-patch}"

if [[ ! "$VERSION_TYPE" =~ ^(patch|minor|major)$ ]]; then
  echo -e "${RED}Ошибка: неверный тип версии. Используйте: patch, minor или major${NC}"
  exit 1
fi

echo -e "${GREEN}Запуск публикации (версия: $VERSION_TYPE)...${NC}\n"

# 1. Проверка git статуса
echo -e "${YELLOW}1. Проверка git статуса...${NC}"
if [[ -n $(git status --porcelain) ]]; then
  echo -e "${RED}Ошибка: есть незакоммиченные изменения${NC}"
  git status --short
  exit 1
fi
echo -e "${GREEN}✓ Git чистый${NC}\n"

# 2. Проверка типов TypeScript
echo -e "${YELLOW}2. Проверка типов TypeScript...${NC}"
bun x tsc -b
echo -e "${GREEN}✓ Типы в порядке${NC}\n"

# 3. Запуск тестов
echo -e "${YELLOW}3. Запуск тестов...${NC}"
bun test || {
  echo -e "${RED}Ошибка: тесты не прошли${NC}"
  exit 1
}
echo -e "${GREEN}✓ Тесты пройдены${NC}\n"

# 4. Получение текущей версии
OLD_VERSION=$(node -p "require('./package.json').version")
echo -e "${YELLOW}4. Текущая версия: $OLD_VERSION${NC}"

# 5. Увеличение версии
echo -e "${YELLOW}5. Увеличение версии ($VERSION_TYPE)...${NC}"
bun run scripts/bump-version.ts "$VERSION_TYPE"
NEW_VERSION=$(node -p "require('./package.json').version")
echo -e "${GREEN}✓ Новая версия: $NEW_VERSION${NC}\n"

# 6. Коммит и тег
echo -e "${YELLOW}6. Создание коммита и тега...${NC}"
git add package.json
git commit -m "chore(yep-mem): release v$NEW_VERSION"
git tag "yep-mem@$NEW_VERSION"
echo -e "${GREEN}✓ Создан коммит и тег yep-mem@$NEW_VERSION${NC}\n"

# 7. Публикация в npm
echo -e "${YELLOW}7. Публикация в npm...${NC}"
npm publish --access public || {
  echo -e "${RED}Ошибка публикации. Откатываем изменения...${NC}"
  git tag -d "yep-mem@$NEW_VERSION"
  git reset --hard HEAD~1
  exit 1
}
echo -e "${GREEN}✓ Опубликовано в npm${NC}\n"

# 8. Push в git
echo -e "${YELLOW}8. Push изменений в git...${NC}"
git push origin main
git push origin "yep-mem@$NEW_VERSION"
echo -e "${GREEN}✓ Изменения отправлены в git${NC}\n"

echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Публикация завершена успешно!${NC}"
echo -e "${GREEN}  Версия: $OLD_VERSION → $NEW_VERSION${NC}"
echo -e "${GREEN}  Тег: yep-mem@$NEW_VERSION${NC}"
echo -e "${GREEN}  npm: https://www.npmjs.com/package/yep-mem${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
