import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseMonitor, monitorUrl } from '../src/departures.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/monitor.json', import.meta.url), 'utf8'));

test('real response collapses to one entry per line + direction', () => {
  const r = parseMonitor(fixture);
  assert.deepEqual(r.map((e) => e.line + ' > ' + e.towards), [
    '18 > Stadion U',
    '18 > Burggasse, Stadthalle U',
    '71 > Kaiserebersdorf, Zinnergasse',
    '71 > Schottenring U',
    '74A > St. Marx S',
    '74A > Stubentor U',
  ]);
  r.forEach((e) => {
    assert.ok(e.mins.length > 0 && e.mins.length <= 4);
    assert.deepEqual(e.mins, [...e.mins].sort((a, b) => a - b));
    e.mins.forEach((m) => assert.equal(typeof m, 'number'));
  });
});

test('direction ids come through and match the platforms', () => {
  const dirs = parseMonitor(fixture).map((e) => e.line + ':' + e.dir);
  assert.deepEqual(dirs, ['18:1', '18:2', '71:1', '71:2', '74A:1', '74A:2']);
});

test('duplicate countdowns from overlapping monitors are merged', () => {
  const dep = (c) => ({ departureTime: { countdown: c } });
  const line = { name: '18', towards: 'X', type: 'ptTram', departures: { departure: [dep(5), dep(1)] } };
  const r = parseMonitor({ data: { monitors: [{ lines: [line] }, { lines: [line] }] } });
  assert.deepEqual(r, [{ line: '18', towards: 'X', dir: 0, type: 'ptTram', mins: [1, 5] }]);
});

test('empty or odd responses do not throw', () => {
  assert.deepEqual(parseMonitor({}), []);
  assert.deepEqual(parseMonitor({ data: { monitors: [{ lines: [{ name: '1', towards: 'Y' }] }] } }),
    [{ line: '1', towards: 'Y', dir: 0, type: undefined, mins: [] }]);
});

test('monitorUrl accepts only numeric DIVA ids', () => {
  assert.equal(monitorUrl(['60201425', 'x&evil=1', '60200763']),
    'https://www.wienerlinien.at/ogd_realtime/monitor?diva=60201425&diva=60200763');
  assert.throws(() => monitorUrl(['nope']));
});
