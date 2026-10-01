import { strFromU8, unzipSync } from 'fflate';
import { packFiles } from './download';

test('packed files unzip to the same names and bytes', async () => {
  const files = {
    'mesh-0.stl': new Uint8Array([1, 2, 3, 4]),
    'mesh-1.obj': new TextEncoder().encode('v 0 0 0\nf 1//1 1//1 1//1'),
  };
  const unzipped = unzipSync(await packFiles(files));
  expect(Object.keys(unzipped).sort()).toEqual(['mesh-0.stl', 'mesh-1.obj']);
  expect([...unzipped['mesh-0.stl']]).toEqual([1, 2, 3, 4]);
  expect(strFromU8(unzipped['mesh-1.obj'])).toBe('v 0 0 0\nf 1//1 1//1 1//1');
});
