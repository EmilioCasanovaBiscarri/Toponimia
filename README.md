# Toponimia

Juego diario de topónimos: cada día, tres lugares del mundo hispanohablante y una pregunta,
**¿qué significa su nombre?** PWA en HTML, CSS y JavaScript, sin compilación; se publica tal cual
en GitHub Pages.

## Cómo se juega

Un tablero para emparejar: arriba, los tres lugares del día; debajo, seis significados barajados
(el de cada lugar y un señuelo de cada uno, elegido entre sus opciones falsas). Se toca un lugar y
después un significado, o al revés, en el orden que se quiera. Cada lugar tiene un solo intento: la
pareja se corrige en el acto y se abre su ficha (forma original, lengua, nota y mapa). Al fallar,
el significado elegido sigue libre para su lugar, y el del lugar fallado queda asignado a él.

La partida se guarda igual que antes del tablero (`partida.respuestas`, el significado elegido
para cada lugar, en su posición), así que el resultado, las estadísticas y Almanaque no cambian.

## Cambiar la fecha de inicio

En `config.js`:

```js
const FECHA_INICIO = '2026-10-03';
```

Ese día es el nº 1, y se avanza uno cada medianoche (hora local del jugador). Pasado el último
día de `data/dias.json`, el ciclo vuelve a empezar por el primero; el número del día sigue
creciendo. Con 90 días, el último es el 31 de diciembre de 2026 y el 1 de enero vuelve el día 1.

## Añadir días

Añade objetos al final de `data/dias.json`, con `dia` correlativo y tres rondas:

```json
{ "dia": 40, "rondas": [
  { "lugar": "…", "region": "…", "lengua": "latín", "original": "…",
    "correcta": "…", "opciones": ["…", "…", "…"], "nota": "…", "lat": 0, "lon": 0 }
]}
```

- `correcta` debe estar también en `opciones`. Una de las otras dos sale como señuelo en el
  tablero (la misma para todos); escríbelas plausibles también al lado de los otros dos lugares
  del día, y que no repitan el significado de ninguno de ellos.
- Ronda inversa: añade `"tipo": "inversa"` y `"pregunta": "¿Qué lugar significa «…»?"`; entonces
  `correcta` y `opciones` son topónimos. En el tablero, la tarjeta del lugar lleva `correcta` y
  su significado sale de entre las comillas de la pregunta. Como sus opciones son lugares, su
  señuelo va en `"senuelo": "…"` (un significado falso pero creíble para ese lugar, que no
  repita los de los otros dos lugares del día); sin él, ese día salen cinco significados.
- En `nota`, `*texto*` se muestra en cursiva.
- `zoom` (opcional) ajusta el mini-mapa; si no, se usa 5, o 3 para regiones amplias.
- Lenguas nuevas: añade su color en `LENGUAS`, al principio de `app.js`.

Después sube `VERSION` en `sw.js` para que los jugadores reciban los cambios sin conexión.

## Probar

- `?dia=N` fuerza el día N (las partidas de prueba no se guardan ni cuentan en las estadísticas).
- En local: `python3 -m http.server` y abre `http://localhost:8000`.
- **Empezar de cero:** `http://localhost:8000/reiniciar/` borra la partida, el historial y la
  racha de ese navegador (clave `toponimia:v1` del `localStorage`), y las instrucciones vuelven
  a salir la primera vez.

## Derechos de autor

© 2026 Emilio Casanova Biscarri. Todos los derechos reservados. El código, los textos y los diseños de este repositorio no pueden copiarse ni reutilizarse sin permiso.
