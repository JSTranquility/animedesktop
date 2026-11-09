# AnimeDesktop

Escritorio glass modular para GNOME 51 Wayland, desarrollado con GJS/St. Incluye personaje independiente, reloj, calendario, galería, lanzadores, dock y música mediante MPRIS. Mantiene el renderizado nativo para evitar texto e imágenes borrosos.

## Instalación

Conserva la carpeta del repositorio después de instalar: contiene la configuración y los recursos del escritorio.

```bash
git clone https://github.com/JSTranquility/animedesktop.git
cd animedesktop
./scripts/doctor.sh
./scripts/install.sh
./scripts/configure-autostart.sh
```

Guarda tu trabajo, cierra sesión de GNOME y vuelve a entrar. El instalador no cierra aplicaciones ni modifica paquetes del sistema. Conserva la configuración local y respalda una instalación previa de la misma extensión.

Por defecto utiliza ilustraciones SVG propias. Para descargar el perfil opcional de Chisa, revisa sus fuentes y ejecuta:

```bash
python3 scripts/fetch-assets.py --profile chisa --dry-run
python3 scripts/fetch-assets.py --profile chisa --activate
```

Los recursos de Chisa no están incluidos en Git ni licenciados bajo MIT. El descargador valida firmas, límites y SHA-256; no ejecuta archivos remotos. La activación del perfil respalda primero `config/settings.json`.

## Interfaz de personalización

```bash
./scripts/preferences.sh
```

También puedes pulsar la insignia del perfil en el escritorio instalado o abrir sus preferencias desde GNOME Extensions.

Haz doble clic en una zona libre de la barra superior para maximizar/restaurar la ventana; también puedes usar el botón de maximizar.

- **Imágenes:** elige fondo, personaje transparente y cuatro tarjetas, con miniaturas y botones para reemplazar/quitar.
- **Apariencia:** colores, transparencia, desenfoque, tamaño, luminosidad, animaciones y modo rendimiento.
- **Widgets:** nombre, saludo, reloj, idioma y selector de aplicaciones instaladas para dock/barra lateral.

Se guardan los cambios automáticamente y se aplican al escritorio instalado desde esta copia. No se alteran tus imágenes originales; se conserva una copia de la configuración anterior. La ventana puede utilizarse antes de instalar, sin cambiar otro escritorio instalado desde otra carpeta.

## Personalización y restauración

Edita `config/settings.json`. Puedes cambiar colores, imágenes, aplicaciones, monitor, transparencia y movimiento sin reinstalar. [Referencia de configuración](CONFIGURATION.md).

Las acciones sobre Gridgets, Dash to Dock e Hidamari están desactivadas por defecto. Las integraciones se seleccionan explícitamente en la configuración.

```bash
./scripts/stop.sh
./scripts/diagnose.sh
./scripts/rollback.sh --dry-run
./scripts/rollback.sh
```

Rollback restaura preferencias acotadas y archivos administrados; conserva archivos modificados posteriormente y no elimina paquetes compartidos ni todo dconf.

## Desarrollo

`npm test` ejecuta pruebas portables. `python3 tests/nested.py` y `--dual` comprueban GNOME real en un compositor aislado. Los avisos de servicios ausentes del entorno aislado se registran sin presentarlos como pruebas de esos servicios. Las pruebas físicas de HDMI y rendimiento GPU se realizan aparte.

Licencia del código y SVG propios: MIT. Fuente Orbitron: OFL. Véase [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
