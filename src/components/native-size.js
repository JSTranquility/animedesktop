import St from 'gi://St';
import { classStyles, theme } from '../themes/tokens.js';

// Render text, SVG icons and image backgrounds at their final allocation.
// Scaling a painted parent instead would magnify its rasterized children.
export function scaleCss(style, scale) {
    return style.replace(
        /(-?\d*\.?\d+)px\b/g,
        (_, value) => `${Math.round(Number(value) * scale * 100) / 100}px`,
    );
}
export function nativeSizeTree(root, scale, colors = theme({})) {
    const classes = classStyles(colors);
    const seen = new WeakSet();
    function size(actor) {
        if (!(actor instanceof St.Widget) || seen.has(actor)) return;
        seen.add(actor);
        actor._agNativeScale = scale;
        actor.set_position(Math.round(actor.x * scale), Math.round(actor.y * scale));
        for (const axis of ['width', 'height']) {
            for (const type of ['min', 'natural']) {
                const property = `${type}_${axis}`;
                if (actor[`${property}_set`]) actor[property] = Math.round(actor[property] * scale);
            }
        }
        const defaults = (actor.style_class || '')
            .split(/\s+/)
            .map((c) => classes[c] || '')
            .join('');
        actor.style = scaleCss(defaults + (actor.style || ''), scale);
        if (actor instanceof St.Icon && actor.icon_size > 0)
            actor.icon_size = Math.round(actor.icon_size * scale);
        for (const child of actor.get_children()) size(child);
        // Calendar navigation creates fresh date labels; size those too.
        actor.connect('child-added', (_parent, child) => size(child));
    }
    for (const child of root.get_children()) size(child);
}
