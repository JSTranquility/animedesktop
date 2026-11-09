import Adw from 'gi://Adw?version=1';
import Gtk from 'gi://Gtk?version=4.0';
import Gdk from 'gi://Gdk?version=4.0';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import GdkPixbuf from 'gi://GdkPixbuf';
const ImagePreview = GObject.registerClass(
    class ImagePreview extends Gtk.Picture {
        vfunc_measure() {
            return [72, 72, -1, -1];
        }
    },
);
import { PreferencesStore, restoreDefaults } from './store.js';
import { setting, availableSelection } from './model.js';

export class PreferencesController {
    constructor(window, root) {
        this.window = window;
        this.root = root;
        this.controls = new Map();
        this.imageRows = new Map();
        this.closed = false;
        this.cancellable = new Gio.Cancellable();
        Adw.StyleManager.get_default().color_scheme = Adw.ColorScheme.PREFER_DARK;
        window.set_title('AnimeDesktop');
        window.set_default_size(760, 760);
        // PreferencesWindow defaults to modal, which prevents normal maximization.
        window.set_modal(false);
        window.set_resizable(true);
        window.search_enabled = true;
        try {
            this.store = new PreferencesStore(
                root,
                () => this._saved(),
                (error) => this._error(error),
            );
        } catch (error) {
            this._broken(error);
            return;
        }
        this._images();
        this._appearance();
        this._widgets();
        const configureHeader = (widget) => {
            if (widget instanceof Adw.HeaderBar) widget.set_decoration_layout(':maximize,close');
            for (let child = widget.get_first_child(); child; child = child.get_next_sibling())
                configureHeader(child);
        };
        configureHeader(window);
        window.connect('close-request', () => {
            try {
                this.store.flush();
            } catch (error) {
                this._error(error);
                return true;
            }
            this.closed = true;
            this.cancellable.cancel();
            this.store.close();
            return false;
        });
    }
    _saved() {
        /* Changes are intentionally silent; errors remain visible. */
    }
    _error(error) {
        if (!this.closed)
            this.window.add_toast(
                new Adw.Toast({ title: String(error.message || error).slice(0, 180), timeout: 6 }),
            );
    }
    _change(path, value) {
        if (this.closed) return;
        try {
            this.store.set(path, value);
        } catch (error) {
            this._error(error);
        }
    }
    _get(path, fallback) {
        const value = setting(this.store.config, path, fallback);
        if (Array.isArray(fallback)) return Array.isArray(value) ? value : fallback;
        return typeof value === typeof fallback &&
            (typeof value !== 'number' || Number.isFinite(value))
            ? value
            : fallback;
    }
    _page(title, icon, description) {
        const page = new Adw.PreferencesPage({ title, icon_name: icon });
        const group = new Adw.PreferencesGroup({ title, description });
        page.add(group);
        this.window.add(page);
        return { page, group };
    }
    _switch(group, title, path, fallback, subtitle = '') {
        const row = new Adw.SwitchRow({ title, subtitle, active: this._get(path, fallback) });
        row.connect('notify::active', () => this._change(path, row.active));
        group.add(row);
        this.controls.set(path, row);
        return row;
    }
    _entry(group, title, path, fallback = '') {
        const row = new Adw.EntryRow({ title, text: String(this._get(path, fallback)) });
        row.connect('changed', () => {
            try {
                this.store.set(path, row.text);
                row.remove_css_class('error');
                row.tooltip_text = null;
            } catch (error) {
                row.add_css_class('error');
                row.tooltip_text = error.message;
            }
        });
        group.add(row);
        this.controls.set(path, row);
        return row;
    }
    _scale(group, title, path, min, max, fallback, factor = 1) {
        const row = new Adw.ActionRow({ title });
        const scale = Gtk.Scale.new_with_range(Gtk.Orientation.HORIZONTAL, min, max, 1);
        scale.width_request = 220;
        scale.draw_value = true;
        scale.digits = 0;
        scale.valign = Gtk.Align.CENTER;
        scale.set_value(this._get(path, fallback) * factor);
        scale.connect('value-changed', () => this._change(path, scale.get_value() / factor));
        row.add_suffix(scale);
        group.add(row);
        this.controls.set(path, scale);
    }
    _resolve(path) {
        if (typeof path !== 'string' || !path) return null;
        return Gio.File.new_for_path(GLib.path_is_absolute(path) ? path : this.root + '/' + path);
    }
    _imageRow(group, title, path, description = '') {
        const row = new Adw.ActionRow({ title, subtitle: description, use_markup: false });
        const preview = new ImagePreview({
            width_request: 72,
            height_request: 64,
            can_shrink: true,
            content_fit: Gtk.ContentFit.COVER,
            margin_top: 8,
            margin_bottom: 8,
        });
        preview.add_css_class('card');
        row.add_prefix(preview);
        const choose = new Gtk.Button({
            icon_name: 'folder-open-symbolic',
            tooltip_text: 'Elegir imagen',
            valign: Gtk.Align.CENTER,
        });
        choose.add_css_class('flat');
        const clear = new Gtk.Button({
            icon_name: 'edit-clear-symbolic',
            tooltip_text: 'Quitar imagen',
            valign: Gtk.Align.CENTER,
        });
        clear.add_css_class('flat');
        choose.connect('clicked', () => this._pickImage(path));
        clear.connect('clicked', () => {
            this._change(path, '');
            this._refreshImage(path);
        });
        row.add_suffix(choose);
        row.add_suffix(clear);
        group.add(row);
        this.imageRows.set(path, { row, preview, description });
        this.controls.set(path, choose);
        this._refreshImage(path);
    }
    _refreshImage(path) {
        const item = this.imageRows.get(path);
        if (!item) return;
        const file = this._resolve(this._get(path, ''));
        const exists = file?.query_exists(null);
        try {
            const pixbuf = exists
                ? GdkPixbuf.Pixbuf.new_from_file_at_scale(file.get_path(), 144, 144, true)
                : null;
            item.preview.set_paintable(pixbuf ? Gdk.Texture.new_for_pixbuf(pixbuf) : null);
        } catch (_) {
            item.preview.set_paintable(null);
        }
        item.row.subtitle = exists ? file.get_basename() : item.description || 'Sin imagen';
    }
    imageDialog(path) {
        const filter = new Gtk.FileFilter({ name: 'Imágenes' });
        filter.add_mime_type('image/*');
        const filters = new Gio.ListStore({ item_type: Gtk.FileFilter });
        filters.append(filter);
        const dialog = new Gtk.FileDialog({
            title: 'Elegir imagen',
            modal: true,
            filters,
            default_filter: filter,
        });
        const previous = this._resolve(this._get(path, ''));
        if (previous?.query_exists(null)) dialog.initial_file = previous;
        return dialog;
    }
    _pickImage(path) {
        const dialog = this.imageDialog(path);
        dialog.open(this.window, this.cancellable, (source, result) => {
            try {
                const file = source.open_finish(result);
                if (!file || this.closed) return;
                this.acceptImage(path, file);
            } catch (error) {
                if (
                    !error.matches?.(Gio.io_error_quark(), Gio.IOErrorEnum.CANCELLED) &&
                    !error.matches?.(Gtk.dialog_error_quark(), Gtk.DialogError.DISMISSED)
                )
                    this._error(error);
            }
        });
    }
    acceptImage(path, file) {
        const pathValue = file.get_path();
        if (!pathValue) throw new Error('Selecciona una imagen local');
        const info = file.query_info(
            'standard::type,standard::content-type',
            Gio.FileQueryInfoFlags.NONE,
            this.cancellable,
        );
        if (
            info.get_file_type() !== Gio.FileType.REGULAR ||
            !info.get_content_type()?.startsWith('image/')
        )
            throw new Error('El archivo seleccionado no es una imagen');
        this._change(path, pathValue);
        this._refreshImage(path);
    }
    _images() {
        const { page, group } = this._page(
            'Imágenes',
            'image-x-generic-symbolic',
            'Elige tus imágenes. Los cambios se guardan automáticamente.',
        );
        this._imageRow(
            group,
            'Fondo de pantalla',
            'wallpaper',
            'Elige un fondo para el escritorio',
        );
        this._switch(group, 'Aplicar fondo de pantalla', 'applyWallpaper', true);
        this._imageRow(group, 'Personaje', 'character', 'Usa PNG o WebP con transparencia');
        const gallery = new Adw.PreferencesGroup({
            title: 'Galería',
            description: 'Cuatro tarjetas independientes; tus archivos originales no se modifican.',
        });
        page.add(gallery);
        for (let i = 0; i < 4; i++) this._imageRow(gallery, 'Tarjeta ' + (i + 1), 'gallery.' + i);
        this._scale(gallery, 'Intensidad de las imágenes', 'galleryOpacity', 40, 100, 0.86, 100);
    }
    _color(group, title, path, fallback) {
        const row = new Adw.ActionRow({ title });
        const rgba = new Gdk.RGBA();
        rgba.parse(this._get(path, fallback));
        const button = new Gtk.ColorDialogButton({
            dialog: new Gtk.ColorDialog({ title, with_alpha: false }),
            rgba,
            valign: Gtk.Align.CENTER,
        });
        button.connect('notify::rgba', () => {
            const c = button.rgba;
            const hex =
                '#' +
                [c.red, c.green, c.blue]
                    .map((v) =>
                        Math.round(Math.max(0, Math.min(1, v)) * 255)
                            .toString(16)
                            .padStart(2, '0'),
                    )
                    .join('');
            this._change(path, hex);
        });
        row.add_suffix(button);
        group.add(row);
        this.controls.set(path, button);
    }
    _appearance() {
        const { page, group } = this._page(
            'Apariencia',
            'applications-graphics-symbolic',
            'Ajusta el cristal, los colores y el tamaño de la composición.',
        );
        for (const [title, path, fallback] of [
            ['Acento', 'theme.accent', '#D95466'],
            ['Cristal', 'theme.surface', '#101014'],
            ['Tarjetas y dock', 'theme.raised', '#17141B'],
            ['Texto', 'theme.foreground', '#DDD6D8'],
            ['Texto secundario', 'theme.muted', '#A49A9F'],
            ['Bordes', 'theme.border', '#51313A'],
        ])
            this._color(group, title, path, fallback);
        const glass = new Adw.PreferencesGroup({ title: 'Cristal y movimiento' });
        page.add(glass);
        this._scale(glass, 'Opacidad del panel', 'panelOpacity', 8, 94, 0.82, 100);
        this._scale(glass, 'Tamaño de la composición', 'panelScale', 65, 100, 1, 100);
        this._scale(glass, 'Desenfoque', 'theme.blurRadius', 0, 40, 28);
        this._scale(glass, 'Luminosidad del cristal', 'theme.blurBrightness', 0, 100, 0.42, 100);
        this._switch(glass, 'Animaciones', 'animations', true);
        this._switch(
            glass,
            'Modo rendimiento',
            'performanceMode',
            false,
            'Reduce efectos y actividad visual.',
        );
    }
    _widgets() {
        const { page, group } = this._page(
            'Widgets',
            'preferences-other-symbolic',
            'Personaliza el saludo, el reloj y los accesos a aplicaciones.',
        );
        this._entry(group, 'Tu nombre', 'name');
        this._entry(group, 'Saludo (vacío para automático)', 'greeting');
        this._entry(group, 'Título del personaje', 'characterTitle', 'ANIME DESKTOP');
        this._entry(group, 'Nombre del perfil', 'badgeTitle', 'Demo');
        this._entry(group, 'Formato de hora', 'clockFormat', '%H:%M');
        const clock = new Adw.ActionRow({
            title: 'Ejemplos de hora',
            subtitle: '24 horas: %H:%M · 12 horas: %I:%M %p',
        });
        group.add(clock);
        const language = new Adw.ComboRow({
            title: 'Idioma del calendario',
            model: Gtk.StringList.new(['Sistema', 'Español', 'English']),
        });
        const locale = this._get('locale', '');
        language.selected = locale.startsWith('es') ? 1 : locale.startsWith('en') ? 2 : 0;
        language.connect('notify::selected', () =>
            this._change('locale', ['', 'es', 'en'][language.selected]),
        );
        group.add(language);
        this.controls.set('locale', language);
        const apps = new Adw.PreferencesGroup({ title: 'Aplicaciones' });
        page.add(apps);
        for (const [title, key] of [
            ['Dock', 'dockApps'],
            ['Barra lateral', 'sideApps'],
        ]) {
            const row = new Adw.ActionRow({
                title,
                subtitle: 'Elige hasta cinco aplicaciones instaladas',
            });
            const button = new Gtk.Button({ label: 'Elegir', valign: Gtk.Align.CENTER });
            button.connect('clicked', () => this._apps(key, title));
            row.add_suffix(button);
            apps.add(row);
            this.controls.set(key, button);
        }
    }
    _apps(key, title) {
        const dialog = new Adw.Window({
            title,
            transient_for: this.window,
            modal: true,
            destroy_with_parent: true,
            default_width: 480,
            default_height: 560,
        });
        const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 12 });
        dialog.content = box;
        box.append(new Adw.HeaderBar());
        const search = new Gtk.SearchEntry({
            placeholder_text: 'Buscar aplicación',
            margin_start: 16,
            margin_end: 16,
        });
        box.append(search);
        const count = new Gtk.Label({
            label: 'Hasta cinco aplicaciones',
            xalign: 0,
            margin_start: 16,
        });
        box.append(count);
        const scroll = new Gtk.ScrolledWindow({
            vexpand: true,
            margin_start: 16,
            margin_end: 16,
            margin_bottom: 16,
        });
        box.append(scroll);
        const list = new Gtk.ListBox({ selection_mode: Gtk.SelectionMode.NONE });
        list.add_css_class('boxed-list');
        scroll.child = list;
        const available = Gio.AppInfo.get_all()
            .filter((app) => app.get_id()?.endsWith('.desktop') && app.should_show())
            .sort((a, b) => a.get_display_name().localeCompare(b.get_display_name()));
        let selected = availableSelection(
                this._get(key, []),
                available.map((app) => app.get_id()),
            ),
            updating = false;
        const rows = [];
        for (const app of available) {
            const row = new Gtk.ListBoxRow();
            const contents = new Gtk.Box({
                spacing: 12,
                margin_start: 12,
                margin_end: 12,
                margin_top: 10,
                margin_bottom: 10,
            });
            row.child = contents;
            const icon = new Gtk.Image({ gicon: app.get_icon(), pixel_size: 28 });
            contents.append(icon);
            contents.append(
                new Gtk.Label({ label: app.get_display_name(), xalign: 0, hexpand: true }),
            );
            const check = new Gtk.CheckButton({ active: selected.includes(app.get_id()) });
            contents.append(check);
            check.connect('toggled', () => {
                if (updating) return;
                if (check.active && selected.length >= 5) {
                    updating = true;
                    check.active = false;
                    updating = false;
                    count.label = 'Máximo cinco aplicaciones';
                    return;
                }
                selected = check.active
                    ? [...selected, app.get_id()]
                    : selected.filter((id) => id !== app.get_id());
                this._change(key, selected);
                count.label = selected.length + ' / 5';
            });
            list.append(row);
            rows.push({ row, name: app.get_display_name().toLocaleLowerCase() });
        }
        search.connect('search-changed', () => {
            const query = search.text.toLocaleLowerCase();
            for (const item of rows) item.row.visible = item.name.includes(query);
        });
        dialog.present();
        return dialog;
    }
    _broken(error) {
        const page = new Adw.PreferencesPage({ title: 'Configuración' });
        const group = new Adw.PreferencesGroup({
            title: 'No se pudo leer la configuración',
            description:
                'Puedes recuperar los valores iniciales; antes se guardará una copia del archivo original.',
        });
        group.add(
            new Adw.ActionRow({
                title: 'Detalle',
                subtitle: String(error.message || error).slice(0, 200),
                use_markup: false,
            }),
        );
        page.add(group);
        this.window.add(page);
        const restore = new Gtk.Button({
            label: 'Restaurar valores iniciales',
            halign: Gtk.Align.CENTER,
            margin_top: 18,
        });
        restore.add_css_class('suggested-action');
        restore.connect('clicked', () => {
            try {
                restoreDefaults(this.root);
                this.closed = true;
                this.cancellable.cancel();
                this.window.remove(page);
                const next = new PreferencesController(this.window, this.root);
                this.window._controller = next;
                this.window._animeDesktopPreferences = next;
            } catch (error) {
                this._error(error);
            }
        });
        group.add(restore);
    }
}
