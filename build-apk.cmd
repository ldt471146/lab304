@echo off
setlocal

set "ANDROID_HOME=D:\Android\sdk"
set "ANDROID_SDK_ROOT=D:\Android\sdk"
set "JAVA_HOME=F:\MCLDownload\ext\jre-v64-220420\jdk17"
set "GRADLE_USER_HOME=%~dp0.gradle-user-home"

cd /d "%~dp0android"
call gradlew.bat assembleDebug --stacktrace

endlocal
