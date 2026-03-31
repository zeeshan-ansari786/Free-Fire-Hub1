@echo off
echo ====================================
echo  FF Arena - Windows Setup
echo ====================================
echo.

echo Step 1: Fixing pnpm settings for Windows...
echo shamefully-hoist=true> .npmrc.tmp
type .npmrc >> .npmrc.tmp 2>nul
move /y .npmrc.tmp .npmrc >nul

echo Step 2: Removing old packages...
if exist node_modules rmdir /s /q node_modules

echo Step 3: Installing all packages (this may take 2-3 minutes)...
call pnpm install --force

echo Step 4: Installing Windows-specific native modules...
call pnpm add -D @rollup/rollup-win32-x64-msvc lightningcss-win32-x64-msvc --filter @workspace/freefire-tournament --force
call pnpm add -D @tailwindcss/oxide-win32-x64-msvc --filter @workspace/freefire-tournament --force 2>nul

echo.
echo ====================================
echo  Starting FF Arena website...
echo  Open your browser at:
echo  http://localhost:3000
echo ====================================
echo.

set PORT=3000
set BASE_PATH=/
call pnpm --filter @workspace/freefire-tournament run dev
