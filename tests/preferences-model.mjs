import assert from 'node:assert/strict';
import { edit, setting, availableSelection } from '../src/preferences/model.js';
const original = {
    name: 'Before',
    theme: { accent: '#AA0000' },
    gallery: ['a', 'b', 'c', 'd'],
    other: 'preserve',
};
let updated = edit(original, 'gallery.2', '/tmp/my picture.png');
assert.equal(updated.gallery[2], '/tmp/my picture.png');
assert.equal(original.gallery[2], 'c');
assert.equal(updated.other, 'preserve');
updated = edit(updated, 'theme.accent', '#abcdef');
assert.equal(updated.theme.accent, '#ABCDEF');
updated = edit(updated, 'panelOpacity', 10);
assert.equal(updated.panelOpacity, 0.94);
updated = edit(updated, 'greeting', '');
assert.equal(updated.greeting, undefined);
updated = edit(updated, 'locale', '');
assert.equal(updated.locale, undefined);
for (const [key, value] of [
    ['__proto__.polluted', true],
    ['gallery.7', 'x'],
    ['theme.accent', 'red'],
    ['clockFormat', ''],
    ['animations', 'false'],
    ['panelScale', NaN],
    ['dockApps', ['not-an-app']],
    ['wallpaper', 'bad\0path'],
])
    assert.throws(() => edit(original, key, value));
assert.equal(setting(updated, 'theme.accent', 'fallback'), '#ABCDEF');
assert.equal(setting({}, 'theme.accent', 'fallback'), 'fallback');
assert.equal(Object.prototype.polluted, undefined);
console.log(
    'PASS: preferences image slots, validation, bounds, deep edits, immutable input and unknown-key rejection',
);

assert.deepEqual(edit({ gallery: {} }, 'gallery.1', 'new').gallery, ['', 'new', '', '']);
assert.deepEqual(edit({ theme: [] }, 'theme.accent', '#112233').theme, { accent: '#112233' });

assert.deepEqual(
    availableSelection(['missing.desktop', 'known.desktop', 'known.desktop'], ['known.desktop']),
    ['known.desktop'],
);
assert.deepEqual(availableSelection('broken', []), []);
