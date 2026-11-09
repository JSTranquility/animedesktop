export function monthCells(year, month) {
    const first = (new Date(year, month, 1).getDay() + 6) % 7;
    const count = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: 42 }, (_, i) =>
        i >= first && i < first + count ? i - first + 1 : 0,
    );
}
export function shiftMonth(year, month, delta) {
    const date = new Date(year, month + delta, 1);
    return [date.getFullYear(), date.getMonth()];
}
