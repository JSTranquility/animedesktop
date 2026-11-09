// Pure configuration edits, shared by GTK preferences and portable tests.
export function setting(config, path, fallback) {
    let value = config;
    for (const key of path.split('.')) value = value?.[key];
    return value === undefined ? fallback : value;
}
const limits = {
    panelOpacity: [0.08, 0.94],
    panelScale: [0.65, 1],
    galleryOpacity: [0.4, 1],
    'theme.blurRadius': [0, 40],
    'theme.blurBrightness': [0, 1],
    'theme.animationDuration': [0, 250],
};
const booleans = new Set(['animations', 'performanceMode', 'applyWallpaper']);
const strings = new Set([
    'name',
    'greeting',
    'clockFormat',
    'locale',
    'characterTitle',
    'badgeTitle',
    'wallpaper',
    'character',
]);
export function edit(config, path, value) {
    if (!config || typeof config !== 'object' || Array.isArray(config))
        throw new Error('Invalid configuration');
    if (limits[path]) {
        if (typeof value !== 'number' || !Number.isFinite(value))
            throw new Error('Introduce un número válido');
        value = Math.max(limits[path][0], Math.min(limits[path][1], value));
    } else if (booleans.has(path)) {
        if (typeof value !== 'boolean') throw new Error('Valor booleano inválido');
    } else if (
        /^theme\.(foreground|muted|accent|surface|raised|border|pink|lavender|ink)$/.test(path)
    ) {
        if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value))
            throw new Error('Color inválido');
        value = value.toUpperCase();
    } else if (path === 'theme.mode') {
        if (!['dark', 'light'].includes(value)) throw new Error('Tema inválido');
    } else if (['dockApps', 'sideApps'].includes(path)) {
        if (
            !Array.isArray(value) ||
            value.length > 5 ||
            value.some((v) => typeof v !== 'string' || !v.endsWith('.desktop'))
        )
            throw new Error('Elige hasta cinco aplicaciones');
        value = [...new Set(value)];
    } else if (strings.has(path) || /^gallery\.[0-3]$/.test(path)) {
        if (
            typeof value !== 'string' ||
            value.includes('\0') ||
            value.length >
                (['wallpaper', 'character'].includes(path) || path.startsWith('gallery.')
                    ? 4096
                    : 120)
        )
            throw new Error('Texto inválido');
        if (path === 'clockFormat' && (!value.trim() || value.length > 80))
            throw new Error('Formato de hora inválido');
        if (path === 'locale' && value) new Intl.DateTimeFormat(value);
    } else throw new Error('Unknown preference');
    const next = JSON.parse(JSON.stringify(config));
    const parts = path.split('.');
    let object = next;
    for (let i = 0; i < parts.length - 1; i++) {
        const key = parts[i];
        if (
            key === 'gallery'
                ? !Array.isArray(object[key])
                : !object[key] || typeof object[key] !== 'object' || Array.isArray(object[key])
        )
            object[key] = key === 'gallery' ? ['', '', '', ''] : {};
        object = object[key];
    }
    if ((path === 'locale' || path === 'greeting') && value === '') delete object[parts.at(-1)];
    else object[parts.at(-1)] = value;
    return next;
}

export function availableSelection(selected, installedIds) {
    const installed = new Set(installedIds);
    return Array.isArray(selected)
        ? [...new Set(selected.filter((id) => installed.has(id)))].slice(0, 5)
        : [];
}
