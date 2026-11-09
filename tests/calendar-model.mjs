import { monthCells, shiftMonth } from '../src/widgets/calendar-model.js';
function assert(value, message) {
    if (!value) throw new Error(message);
}
assert(monthCells(2024, 1).filter(Boolean).length === 29, '2024 leap February');
assert(monthCells(2100, 1).filter(Boolean).length === 28, '2100 is not leap year');
assert(monthCells(2026, 10)[6] === 1, 'November 2026 starts Sunday');
assert(JSON.stringify(shiftMonth(2026, 11, 1)) === '[2027,0]', 'December forwards');
assert(JSON.stringify(shiftMonth(2026, 0, -1)) === '[2025,11]', 'January backwards');
for (let year = 2020; year <= 2040; year++)
    for (let month = 0; month < 12; month++) {
        const cells = monthCells(year, month),
            days = cells.filter(Boolean);
        assert(cells.length === 42, 'Six rows');
        assert(
            days.every((d, i) => d === i + 1),
            'Continuous dates',
        );
    }
console.log(
    'PASS: leap years, century exception, weekday offsets, year boundaries, 252 monthly grids',
);
