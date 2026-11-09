import assert from 'node:assert/strict';
import { theme } from '../src/themes/tokens.js';
assert.equal(theme({ theme: { blurRadius: 0 } }).blurRadius, 0);
assert.equal(theme({ theme: { animationDuration: 0 } }).animationDuration, 0);
assert.equal(theme({ theme: { blurRadius: 900, foreground: 'red' } }).blurRadius, 40);
assert.equal(theme({ theme: { foreground: 'red' } }).foreground, '#F5F7FF');
assert.equal(theme({ theme: { accent: '#F5BDD8' } }).accent, '#F5BDD8');
assert.equal(theme({ performanceMode: true }).animationDuration, 0);
assert.equal(theme({ animations: false }).animationDuration, 0);
console.log('PASS: theme bounds, zero values, color validation and motion preferences');

const dark = theme({ theme: { mode: 'dark', blurBrightness: 0.42 } });
assert.equal(dark.dark, true);
assert.equal(dark.accent, '#D95466');
assert.equal(dark.blurBrightness, 0.42);
assert.equal(dark.foreground, '#DDD6D8');
assert.equal(theme({ theme: { mode: 'dark', surface: 'transparent' } }).surface, '#101014');
console.log('PASS: dark surfaces, red accent, brightness bounds and hex validation');
