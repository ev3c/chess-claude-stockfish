# ⚡ SOLUCIÓN RÁPIDA - Error "Failed to Fetch" o CORS

## 🎯 Problema
Ves este error:
```
Access to fetch... has been blocked by CORS policy
Failed to fetch
```

## ✅ Solución en 30 Segundos

### WINDOWS
1. Haz **doble clic** en `servidor.bat`
2. Espera que se abra el navegador automáticamente
3. ¡Listo! Ya no habrá errores

### macOS / LINUX
1. Abre Terminal en esta carpeta
2. Ejecuta: `./servidor.sh`
3. Espera que se abra el navegador
4. ¡Listo!

## 🌐 URL Correcta
Después de ejecutar el servidor, abre:
```
http://localhost:8000
```

**NO uses:** `file:///...` (esto causa el error)

## ❓ ¿No Funciona el Script?

### Instalar Python (Recomendado)
1. Descarga: https://www.python.org/downloads/
2. Instala (marca "Add Python to PATH")
3. Abre terminal en la carpeta del juego
4. Ejecuta: `python -m http.server 8000`
5. Abre: http://localhost:8000

### O Instalar Node.js
1. Descarga: https://nodejs.org/
2. Instala
3. Abre terminal en la carpeta del juego
4. Ejecuta: `npx http-server -p 8000`
5. Abre: http://localhost:8000

## 🎮 Después de Iniciar el Servidor
1. Obtén tu API Key en: https://console.anthropic.com/
2. En el juego, ingresa la API Key
3. Haz clic en "Probar Conexión"
4. Si funciona, haz clic en "Guardar API Key"
5. ¡A jugar!

## ⚠️ Importante
- **NO cierres** la ventana del servidor mientras juegas
- Para detener el servidor: `Ctrl+C`

---

**¿Todavía tienes problemas?** Abre `LEEME_PRIMERO.html` en tu navegador para instrucciones visuales detalladas.

