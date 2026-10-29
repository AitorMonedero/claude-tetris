---
name: clima
description: Devuelve el clima actual de la ciudad indicada (temperatura, sensación térmica, humedad, precipitación, viento y estado del cielo). Usar cuando el usuario pida el tiempo o el clima de una ciudad, por ejemplo "/clima Madrid".
---

# Clima

Consulta el clima actual de la ciudad recibida como argumento: `$ARGUMENTS`

Usa Open-Meteo (gratuita, sin clave de API) en dos pasos.

## Paso 1: geocodificar la ciudad

Si `$ARGUMENTS` está vacío, pide al usuario el nombre de la ciudad y detente.

Ejecuta con Bash. El nombre debe ir codificado en porcentaje y en UTF-8: los espacios como `%20` y cada carácter no ASCII como sus bytes (por ejemplo, `á` → `%C3%A1`, `ñ` → `%C3%B1`). Pasar la tilde sin codificar hace que la API rechace la petición.

```bash
curl -s "https://geocoding-api.open-meteo.com/v1/search?name=NOMBRE_CODIFICADO&count=1&language=es&format=json"
```

Ejemplo con `San Sebastián`: `name=San%20Sebasti%C3%A1n`.

- Si la respuesta no contiene `results`, indica que no se encontró la ciudad y pide un nombre más preciso.
- Del primer resultado toma `name`, `admin1` (región), `country`, `latitude`, `longitude` y `timezone`.

## Paso 2: obtener el clima actual

```bash
curl -s "https://api.open-meteo.com/v1/forecast?latitude=LAT&longitude=LON&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&timezone=auto"
```

Sustituye `LAT` y `LON` por los valores del paso 1. Del campo `current` toma:

- `temperature_2m` (°C)
- `apparent_temperature` (°C, sensación térmica)
- `relative_humidity_2m` (%)
- `precipitation` (mm)
- `wind_speed_10m` (km/h)
- `weather_code` (código WMO, ver tabla)
- `time` (hora local de la medición)

## Códigos WMO

| Código | Estado |
|---|---|
| 0 | Despejado |
| 1, 2, 3 | Poco nuboso / parcialmente nuboso / cubierto |
| 45, 48 | Niebla |
| 51, 53, 55 | Llovizna |
| 56, 57 | Llovizna helada |
| 61, 63, 65 | Lluvia |
| 66, 67 | Lluvia helada |
| 71, 73, 75 | Nevada |
| 77 | Granizo fino |
| 80, 81, 82 | Chubascos |
| 85, 86 | Chubascos de nieve |
| 95 | Tormenta |
| 96, 99 | Tormenta con granizo |

## Respuesta

Responde en español, en formato breve:

```
Clima en <name>, <admin1> (<country>) — <hora local>
Estado: <descripción>
Temperatura: <temperature_2m> °C (sensación <apparent_temperature> °C)
Humedad: <relative_humidity_2m> %
Precipitación: <precipitation> mm
Viento: <wind_speed_10m> km/h
```

No inventes datos: si algún campo falta en la respuesta, indícalo como "no disponible".
