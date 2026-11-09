import St from 'gi://St';
import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';
export function label(text, style = '') {
    return new St.Label({ text, style: `color:#f5f7ff;font-family:Sans;${style}` });
}
export function button(icon, action, size = 34) {
    const b = new St.Button({
        can_focus: true,
        reactive: true,
        track_hover: true,
        style_class: 'ag-button',
        child: new St.Icon({ icon_name: icon, icon_size: size }),
    });
    b.connect('clicked', action);
    return b;
}
export function image(path, w, h, r = 18) {
    const uri = Gio.File.new_for_path(path).get_uri();
    const actor = new St.Widget({
        width: w,
        height: h,
        style: `background-image:url("${uri}");background-size:cover;border-radius:${r}px;`,
    });
    return actor;
}
export function place(parent, actor, x, y, w, h) {
    parent.add_child(actor);
    actor.set_position(x, y);
    if (w && h) actor.set_size(w, h);
    return actor;
}
