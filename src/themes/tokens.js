export const palette = {
    foreground: '#F5F7FF',
    accent: '#A8C8FF',
    pink: '#F5BDD8',
    lavender: '#B8A6F4',
    ink: '#202430',
    muted: '#A49A9F',
    surface: '#101014',
    raised: '#17141B',
    border: '#51313A',
};
export const layout = {
    width: 1200,
    height: 675,
    panel: [178, 76, 960, 460],
    sidebar: [54, 76, 80, 460],
    dock: [355, 569, 490, 76],
    character: [477, 48, 380, 526],
};
function bounded(value, fallback, maximum) {
    const n = Number(value);
    return Math.max(0, Math.min(maximum, Number.isFinite(n) ? n : fallback));
}
export function rgba(hex, alpha) {
    const v = hex.slice(1);
    return `rgba(${parseInt(v.slice(0, 2), 16)},${parseInt(v.slice(2, 4), 16)},${parseInt(v.slice(4, 6), 16)},${alpha})`;
}
export function theme(config) {
    const source = config.theme && typeof config.theme === 'object' ? config.theme : {};
    const dark = source.mode === 'dark';
    const colors = {
        ...palette,
        ...(dark
            ? {
                  foreground: '#DDD6D8',
                  accent: '#D95466',
                  pink: '#963345',
                  lavender: '#D95466',
                  ink: '#DDD6D8',
              }
            : {}),
    };
    for (const k of Object.keys(colors))
        if (/^#[0-9a-fA-F]{6}$/.test(source[k])) colors[k] = source[k];
    return {
        ...colors,
        dark,
        blurRadius: bounded(source.blurRadius, 24, 40),
        blurBrightness: bounded(source.blurBrightness, dark ? 0.42 : 1, 1),
        animationDuration:
            config.animations === false || config.performanceMode
                ? 0
                : bounded(source.animationDuration, 160, 250),
    };
}
export function classStyles(colors) {
    return {
        'ag-glass': `background-color:${rgba(colors.surface, colors.dark ? 0.78 : 0.22)};border:1px solid ${rgba(colors.border, colors.dark ? 0.72 : 0.55)};border-radius:44px;box-shadow:0 12px 30px 0 rgba(0,0,0,0.28);`,
        'ag-button': `padding:9px;border-radius:22px;color:${colors.foreground};transition-duration:${colors.animationDuration}ms;`,
        'ag-dock': `spacing:18px;padding:9px 25px;border-radius:42px;background-color:${rgba(colors.raised, 0.86)};border:1px solid ${rgba(colors.border, 0.72)};`,
    };
}
