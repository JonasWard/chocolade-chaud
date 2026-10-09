import { IBox, IDistanceField } from '../../src/geometry/field';
import { BarKind, GridParser, IBar, barFrames, cellsBox, defaultBar, gridCells, overrideOf, piecePattern, withPieceMode, withPiecePattern, withPieces, withSharedPattern } from '../../src/geometry/grid';
import { DistanceMethodType } from '../../src/geometry/sdMethods';
import { FITS, IPieceOverride, IRepeat, DEFAULT_REPEAT, anchorOf, diffPattern, differs, fitFactor, referenceSize, resetNode, resolvePattern, settleOverride } from '../../src/geometry/pieces';
import { compilePattern, toPattern, toWorld } from '../../src/geometry/sdf/evaluate';
import { boxInNode, inkBox, placePattern } from '../../src/geometry/sdf/placement';
import { PRESETS } from '../../src/geometry/sdf/presets';
import { AlignX, AlignZ, GroupNode, IPattern, ISvgNode, ITextNode, SdfNode, SvgFields, constantNode, defaultPattern, groupNode, isGroup, methodNode, sineNode, svgNode, textFieldKey, textNode } from '../../src/geometry/sdf/tree';
import { changeKind, findNode, insertChild, moveNode, removeNode, staticScale, updateNode } from '../../src/geometry/sdf/treeOps';
import { DEFAULT_PIECES, TABLET_LAYOUTS, TABLET_SIZES } from '../../src/geometry/tablets';

// a field of the distance to a disc of 4 around its centre, with its ink a little off its centre so an edge is not its middle
const disc = (): IDistanceField => {
  const n = 16;
  const distances = new Float32Array(n * n).map((_, i) => Math.hypot((i % n) + 0.5 - n / 2, Math.floor(i / n) + 0.5 - n / 2) - 4);
  return { width: n, height: n, pixelSize: 1, distances, bounds: { minX: -5, minZ: -3, maxX: 4, maxZ: 4 } };
};

const leaves = (node: SdfNode): SdfNode[] => (isGroup(node) ? node.children.flatMap(leaves) : [node]);
const placed = (node: SdfNode) => leaves(node).filter((n): n is ISvgNode | ITextNode => n.kind === 'svg' || n.kind === 'text');
/** a field for every svg shape and text of the patterns */
const fieldsOf = (...patterns: IPattern[]): SvgFields => new Map(patterns.flatMap((p) => placed(p.root).map((n) => [n.kind === 'svg' ? n.asset : textFieldKey(n), disc()] as const)));

const combined = (extra: Partial<IBar> = {}): IBar => ({ ...defaultBar(), kind: BarKind.Combined, divPerMM: 0.5, ...extra });
const topOf = (bar: IBar, piece: number): IBox => {
  const { basePosition, innerWidth, innerLength } = gridCells(bar)[piece].geometrySettings;
  return { minX: basePosition.x, minZ: basePosition.z, maxX: basePosition.x + innerWidth, maxZ: basePosition.z + innerLength };
};

// a tree with a gyroid, a text against the left and the top and a centred star, turned and off its centre
const mixed = (): IPattern => ({
  ...defaultPattern(),
  root: groupNode('union', [
    { ...methodNode(DistanceMethodType.SDGyroid, 0.3), gain: 0.4 },
    { ...textNode('piece'), size: 6, alignX: 'left', alignZ: 'top', paddingX: 2, paddingZ: 1.5 },
    { ...svgNode('star', 12), paddingX: 1 },
  ]),
  center: { x: 3, y: 0, z: -2 },
  rotation: 20,
});

describe('one design', () => {
  // as placePattern was before the pieces had a frame: against the box around all the bars, a centred one at the centre of the pattern
  const placedBefore = (pattern: IPattern, bars: IBox, fields: SvgFields): IPattern => {
    const place = (node: SdfNode): SdfNode => {
      if (isGroup(node)) return { ...node, children: node.children.map(place) };
      if (node.kind !== 'svg' && node.kind !== 'text') return node;
      const [box, ink] = [boxInNode(pattern, bars, node.id), inkBox(node, fields) ?? { minX: 0, minZ: 0, maxX: 0, maxZ: 0 }];
      const x = node.alignX === 'left' ? box.minX + node.paddingX - ink.minX : node.alignX === 'right' ? box.maxX - node.paddingX - ink.maxX : node.paddingX;
      const z = node.alignZ === 'top' ? box.minZ + node.paddingZ - ink.minZ : node.alignZ === 'bottom' ? box.maxZ - node.paddingZ - ink.maxZ : node.paddingZ;
      return { ...node, offsetX: x, offsetZ: z };
    };
    return { ...pattern, root: place(pattern.root) };
  };

  const patterns = [mixed(), defaultPattern(), ...PRESETS.map((p) => ({ ...defaultPattern(), ...p.make() }))];
  const bars: IBar[] = [
    ...TABLET_SIZES.map((tablet) => ({ ...defaultBar(), tablet })),
    { ...defaultBar(), kind: BarKind.Custom, width: 61.3, length: 27.9, inset: -1.7 },
    ...TABLET_LAYOUTS.map((pieces) => combined({ pieces, inset: -0.7 })),
  ];

  test('every bar has the pattern it had, on every kind of bar and every layout', () => {
    patterns.forEach((sdfSetting) => {
      const fields = fieldsOf(sdfSetting);
      bars.forEach((b) => {
        const bar = { ...b, sdfSetting };
        const cells = gridCells(bar, false, fields);
        const before = placedBefore(sdfSetting, cellsBox(cells), fields);
        cells.forEach((cell) => expect(cell.sdfSettings).toEqual(before));
      });
    });
  });

  test('its meshes are the ones it had, vertex for vertex', () => {
    const sdfSetting = mixed();
    const fields = fieldsOf(sdfSetting);
    const bar = combined({ sdfSetting });
    const meshes = GridParser(bar, [], true, fields);
    const cells = gridCells(bar, true, fields);
    const before = placedBefore(sdfSetting, cellsBox(cells), fields);
    cells.forEach((cell, i) => {
      const sdf = compilePattern(before, fields);
      const now = compilePattern(cell.sdfSettings, fields);
      for (let v = 0; v < meshes[i].vertices.length; v += 3 * 97) {
        const [x, y, z] = meshes[i].vertices.slice(v, v + 3);
        expect(now(x, y, z)).toBe(sdf(x, y, z));
      }
    });
  });

  test('a mode only counts on a combined tablet', () => {
    const sdfSetting = mixed();
    const tablet = { ...defaultBar(), sdfSetting };
    expect(gridCells({ ...tablet, pieceMode: 'repeat' })).toEqual(gridCells(tablet));
    expect(gridCells({ ...tablet, kind: BarKind.Custom, pieceMode: 'unique' })).toEqual(gridCells({ ...tablet, kind: BarKind.Custom }));
  });
});

describe('repeat', () => {
  const ANCHORS = (['top', 'middle', 'bottom'] as AlignZ[]).flatMap((anchorZ) => (['left', 'center', 'right'] as AlignX[]).map((anchorX) => ({ anchorX, anchorZ })));

  test('two pieces of the same size have the same surface', () => {
    const sdfSetting = mixed();
    const fields = fieldsOf(sdfSetting);
    // the two 4x1 of the default layout, and its two 2x1
    const bar = combined({ sdfSetting, pieceMode: 'repeat' });
    const cells = gridCells(bar, true, fields);
    const meshes = GridParser(bar, [], true, fields);
    [
      [0, 3],
      [1, 2],
    ].forEach(([a, b]) => {
      const [pa, pb] = [cells[a].geometrySettings.basePosition, cells[b].geometrySettings.basePosition];
      expect(meshes[a].vertices.length).toBe(meshes[b].vertices.length);
      let max = 0;
      for (let v = 0; v < meshes[a].vertices.length; v += 3) {
        max = Math.max(
          max,
          Math.abs(meshes[a].vertices[v] - pa.x - (meshes[b].vertices[v] - pb.x)),
          Math.abs(meshes[a].vertices[v + 1] - meshes[b].vertices[v + 1]),
          Math.abs(meshes[a].vertices[v + 2] - pa.z - (meshes[b].vertices[v + 2] - pb.z))
        );
      }
      // the vertices of a mesh are 32 bit floats, where they are on the tablet
      expect(max).toBeLessThan(2e-5);
      // the surface itself is the same
      const [onA, onB] = [compilePattern(cells[a].sdfSettings, fields), compilePattern(cells[b].sdfSettings, fields)];
      for (let x = 0.5; x < 90; x += 7.3) for (let z = 0.5; z < 28; z += 3.1) expect(Math.abs(onA(pa.x + x, 10, pa.z + z) - onB(pb.x + x, 10, pb.z + z))).toBeLessThan(1e-9);
    });
    // across all pieces as one design they differ
    const one = GridParser({ ...bar, pieceMode: 'one' }, [], true, fields);
    expect(Math.abs(one[0].vertices[1] - one[3].vertices[1])).toBeGreaterThan(1e-6);
  });

  test('the centre of the pattern is at the anchor of every piece, a centred shape in the middle of it', () => {
    const fits: Partial<IRepeat>[] = [{}, { fit: 'inside' }, { fit: 'fill', reference: 'tablet' }];
    fits.forEach((fit) =>
      ANCHORS.forEach((anchor) => {
        const sdfSetting = mixed();
        const fields = fieldsOf(sdfSetting);
        const repeat = { ...DEFAULT_REPEAT, ...anchor, ...fit };
        const bar = combined({ sdfSetting, pieceMode: 'repeat', repeat, pieces: TABLET_LAYOUTS[7] });
        const tops = bar.pieces.map((_, i) => topOf(bar, i));
        barFrames(bar).forEach((frame, i) => {
          const k = fitFactor(tops[i], referenceSize(tops, repeat), repeat.fit);
          const at = anchorOf(tops[i], anchor.anchorX, anchor.anchorZ);
          // the centre the pattern has itself moves it, by as much as it is scaled
          const origin = toPattern(frame.pattern, 1, { x: at.x + 3 * k, z: at.z - 2 * k });
          expect(Math.hypot(origin.x, origin.z)).toBeLessThan(0.01);
          expect(frame.pattern.rotation).toBe(20);

          const star = placed(placePattern(frame.pattern, frame.box, fields, frame.centre).root).find((n) => n.kind === 'svg')!;
          const where = toWorld(frame.pattern, staticScale(frame.pattern.root, star.id)!, { x: star.offsetX, z: star.offsetZ });
          const mid = { x: (tops[i].minX + tops[i].maxX) / 2, z: (tops[i].minZ + tops[i].maxZ) / 2 };
          // its padding of 1 is along x of the pattern, which is turned and scaled
          const [c, s] = [Math.cos((20 * Math.PI) / 180), Math.sin((20 * Math.PI) / 180)];
          expect(Math.hypot(where.x - (mid.x + 3 * k + c * k), where.z - (mid.z - 2 * k - s * k))).toBeLessThan(0.01);
        });
      })
    );
  });

  test('a shape against an edge is against that edge of every piece', () => {
    const sdfSetting = { ...mixed(), rotation: 0 };
    const fields = fieldsOf(sdfSetting);
    const bar = combined({ sdfSetting, pieceMode: 'repeat', repeat: { ...DEFAULT_REPEAT, anchorX: 'right', anchorZ: 'bottom' } });
    gridCells(bar, false, fields).forEach((cell, i) => {
      const text = placed(cell.sdfSettings.root).find((n) => n.kind === 'text')!;
      const top = topOf(bar, i);
      // the ink of the field starts at -5, -3: 2 and 1.5 mm from the left and the top of the piece
      const where = toWorld(cell.sdfSettings, 1, { x: text.offsetX - 5, z: text.offsetZ - 3 });
      expect(where.x).toBeCloseTo(top.minX + 2, 9);
      expect(where.z).toBeCloseTo(top.minZ + 1.5, 9);
    });
  });

  test('every scale is the factor it names, against every reference', () => {
    const bar = combined();
    const tops = bar.pieces.map((_, i) => topOf(bar, i));
    // a 4x1 and a 2x1, their tops 6 mm smaller than their bases, which have a gap of 1 mm between them
    const [large, small] = [tops[0], tops[1]];
    expect([large.maxX - large.minX, large.maxZ - large.minZ]).toEqual([93.5, 28.5]);
    expect([small.maxX - small.minX, small.maxZ - small.minZ]).toEqual([43.5, 28.5]);

    const references = { largest: { width: 93.5, length: 28.5 }, tablet: { width: 144, length: 64 }, custom: { width: 50, length: 20 } };
    (Object.keys(references) as (keyof typeof references)[]).forEach((reference) => {
      const size = referenceSize(tops, { ...DEFAULT_REPEAT, reference, referenceWidth: 50, referenceLength: 20 });
      expect(size).toEqual(references[reference]);
      const [w, l] = [43.5 / size.width, 28.5 / size.length];
      const expected = { same: 1, inside: Math.min(w, l), fill: Math.max(w, l), width: w, length: l };
      FITS.forEach((fit) => expect([reference, fit, fitFactor(small, size, fit)]).toEqual([reference, fit, expected[fit]]));
    });
    // a size of nothing is no scale
    expect(fitFactor(small, { width: 0, length: 0 }, 'inside')).toBe(1);
  });

  test('a scale makes the pattern smaller around the anchor, its distances stay in mm', () => {
    const sdfSetting = { ...defaultPattern(), root: { ...methodNode(DistanceMethodType.SDGyroid, 0.3), gain: 0.4 } };
    const bar = combined({ sdfSetting, pieceMode: 'repeat', repeat: { ...DEFAULT_REPEAT, fit: 'width' } });
    const [large, small] = barFrames(bar);
    const k = 43.5 / 93.5;
    const [a, b] = [anchorOf(large.box, 'center', 'middle'), anchorOf(small.box, 'center', 'middle')];
    const [onLarge, onSmall] = [compilePattern(large.pattern), compilePattern(small.pattern)];
    // what is at (dx, dz) from the anchor of the reference is at k times that on the smaller piece, y is not scaled away
    [
      [5, 3],
      [-20, 8],
      [31, -11],
    ].forEach(([dx, dz]) => expect(onSmall(b.x + k * dx, 0, b.z + k * dz)).toBeCloseTo(onLarge(a.x + dx, 0, a.z + dz), 12));
  });

  test('the pattern never turns: an upright piece has it as a flat one has', () => {
    const sdfSetting = mixed();
    // a layout with a 1x2 and a 4x1
    const pieces = TABLET_LAYOUTS.find((l) => l.some((p) => p.size === '1x2') && l.some((p) => p.size === '4x1'))!;
    const bar = combined({ sdfSetting, pieceMode: 'repeat', pieces });
    const frames = barFrames(bar);
    const [upright, flat] = [frames[pieces.findIndex((p) => p.size === '1x2')], frames[pieces.findIndex((p) => p.size === '4x1')]];
    const [a, b] = [anchorOf(upright.box, 'center', 'middle'), anchorOf(flat.box, 'center', 'middle')];
    const [onUpright, onFlat] = [compilePattern(upright.pattern), compilePattern(flat.pattern)];
    [
      [4, 9],
      [-7, -12],
    ].forEach(([dx, dz]) => expect(onUpright(a.x + dx, 4, a.z + dz)).toBeCloseTo(onFlat(b.x + dx, 4, b.z + dz), 12));
  });
});

describe('overrides', () => {
  const tree = () => {
    const text = { ...textNode('all'), size: 6 };
    const gyroid = methodNode(DistanceMethodType.SDGyroid, 0.3);
    const inner = groupNode('add', [text, constantNode(1)]);
    const wave = sineNode(0.3, 4, [methodNode(DistanceMethodType.SDSphere, 0.1)]);
    const root = groupNode('union', [gyroid, inner, wave]);
    return { shared: { ...defaultPattern(), root } as IPattern, text, gyroid, inner, wave, root };
  };
  const ids = (node: SdfNode): string[] => [node.id, ...(isGroup(node) ? node.children.flatMap(ids) : [])];

  test('a setting that differs is a value of its node, the others follow the shared tree', () => {
    const { shared, text, gyroid } = tree();
    const edited = { ...shared, root: updateNode(shared.root, text.id, (n) => ({ ...n, text: 'Jonas', size: 9 }) as SdfNode) };
    const override = diffPattern(shared, edited);
    expect(override).toEqual({ nodes: { [text.id]: { values: { text: 'Jonas', size: 9 } } } });
    expect(resolvePattern(shared, override)).toEqual(edited);
    // the same override gives the same pattern, so nothing is made twice from it
    expect(resolvePattern(shared, override)).toBe(resolvePattern(shared, override));
    expect(resolvePattern(shared, { nodes: {} })).toBe(shared);

    // a shared edit of another setting of the node, or of another node, reaches the piece
    const later = { ...shared, root: updateNode(updateNode(shared.root, text.id, (n) => ({ ...n, bold: false }) as SdfNode), gyroid.id, (n) => ({ ...n, gain: 3 })) };
    const piece = resolvePattern(later, settleOverride(later, override));
    expect(findNode(piece.root, text.id)).toMatchObject({ text: 'Jonas', size: 9, bold: false });
    expect(findNode(piece.root, gyroid.id)).toMatchObject({ gain: 3 });
    // and what is settled is still the same override
    expect(settleOverride(later, override)).toBe(override);
  });

  test('the centre and the rotation of the pattern can differ too', () => {
    const { shared } = tree();
    const override = diffPattern(shared, { ...shared, center: { x: 1, y: 0, z: 2 }, rotation: 30 });
    expect(override).toEqual({ center: { x: 1, y: 0, z: 2 }, rotation: 30, nodes: {} });
    expect(differs(override)).toBe(true);
    expect(resolvePattern(shared, override)).toMatchObject({ center: { x: 1, y: 0, z: 2 }, rotation: 30 });
    // the same as the shared ones again, they follow them
    expect(settleOverride({ ...shared, rotation: 30 }, override)).toEqual({ center: { x: 1, y: 0, z: 2 }, nodes: {} });
  });

  test('a change of the structure makes the group it is in the own of the piece, and no other', () => {
    const { shared, inner, text, gyroid, wave, root } = tree();
    const extra = methodNode(DistanceMethodType.SDTorus);
    const edits: [string, SdfNode, string][] = [
      ['add', insertChild(shared.root, inner.id, extra), inner.id],
      ['remove', removeNode(shared.root, text.id), inner.id],
      ['move', moveNode(shared.root, text.id, 1), inner.id],
      ['kind of a group', updateNode(shared.root, inner.id, (n) => changeKind(n, 'subtract')), inner.id],
      ['kind of a leaf', updateNode(shared.root, text.id, (n) => changeKind(n, 'constant')), text.id],
      ['at the root', insertChild(shared.root, root.id, extra), root.id],
    ];
    edits.forEach(([name, edited, group]) => {
      const override = diffPattern(shared, { ...shared, root: edited });
      expect([name, Object.keys(override.nodes)]).toEqual([name, [group]]);
      expect(override.nodes[group]).toEqual({ own: findNode(edited, group) });
      expect(resolvePattern(shared, override).root).toEqual(edited);
      expect(diffPattern(shared, resolvePattern(shared, override))).toEqual(override);
    });

    // outside its own group the piece still follows the shared tree, inside it no longer does
    const override = diffPattern(shared, { ...shared, root: insertChild(shared.root, inner.id, extra) });
    const later = { ...shared, root: updateNode(updateNode(updateNode(shared.root, gyroid.id, (n) => ({ ...n, gain: 3 })), text.id, (n) => ({ ...n, text: 'new' }) as SdfNode), wave.id, (n) => ({ ...n, period: 9 }) as SdfNode) };
    const piece = resolvePattern(later, settleOverride(later, override));
    expect(findNode(piece.root, gyroid.id)).toMatchObject({ gain: 3 });
    expect(findNode(piece.root, wave.id)).toMatchObject({ period: 9 });
    expect(findNode(piece.root, text.id)).toMatchObject({ text: 'all' });
    expect((findNode(piece.root, inner.id) as GroupNode).children).toHaveLength(3);
  });

  test('a group edited back to the children of the shared one follows it again, with the settings that differ', () => {
    const { shared, inner, text } = tree();
    const extra = methodNode(DistanceMethodType.SDTorus);
    const added = insertChild(updateNode(shared.root, text.id, (n) => ({ ...n, text: 'Jonas' }) as SdfNode), inner.id, extra);
    expect(Object.keys(diffPattern(shared, { ...shared, root: added }).nodes)).toEqual([inner.id]);
    const back = diffPattern(shared, { ...shared, root: removeNode(added, extra.id) });
    expect(back).toEqual({ nodes: { [text.id]: { values: { text: 'Jonas' } } } });
  });

  test('a shared edit drops what is on a node that is gone, and the settings its node no longer has', () => {
    const { shared, text, inner, gyroid, wave } = tree();
    const override: IPieceOverride = {
      nodes: { [text.id]: { values: { text: 'Jonas' } }, [gyroid.id]: { values: { gain: 2, method: DistanceMethodType.SDNeovius } }, [wave.id]: { values: { period: 9 } } },
    };
    // the text is gone, the gyroid is a constant now: it has a gain but no method
    const later = { ...shared, root: updateNode(removeNode(shared.root, text.id), gyroid.id, (n) => changeKind(n, 'constant')) };
    expect(settleOverride(later, override)).toEqual({ nodes: { [gyroid.id]: { values: { gain: 2 } }, [wave.id]: { values: { period: 9 } } } });
    // a setting the shared node has the same is no difference
    const same = { ...shared, root: updateNode(shared.root, wave.id, (n) => ({ ...n, period: 9 }) as SdfNode) };
    expect(Object.keys(settleOverride(same, override).nodes).sort()).toEqual([text.id, gyroid.id].sort());
    // below a group the piece has its own of, nothing differs any more
    const own: IPieceOverride = { nodes: { ...override.nodes, [inner.id]: { own: { ...inner, children: [] } } } };
    expect(Object.keys(settleOverride(shared, own).nodes).sort()).toEqual([gyroid.id, wave.id, inner.id].sort());
  });

  test('what differs stays on its node when the shared tree is reordered', () => {
    const { shared, text, wave } = tree();
    const override: IPieceOverride = { nodes: { [text.id]: { values: { text: 'Jonas' } }, [wave.id]: { values: { period: 9 } } } };
    const later = { ...shared, root: moveNode(moveNode(shared.root, wave.id, -1), wave.id, -1) };
    expect(settleOverride(later, override)).toBe(override);
    const piece = resolvePattern(later, override);
    expect(findNode(piece.root, text.id)).toMatchObject({ kind: 'text', text: 'Jonas' });
    expect(findNode(piece.root, wave.id)).toMatchObject({ kind: 'sine', period: 9 });
    expect(leaves(piece.root).filter((n) => n.kind === 'text')).toHaveLength(1);
  });

  test('no id is twice in the pattern of a piece', () => {
    const { shared, inner, text, wave } = tree();
    // the piece moved the text into the wave: both groups are its own, the text is only in the wave
    const moved = insertChild(removeNode(shared.root, text.id), wave.id, text);
    const override = diffPattern(shared, { ...shared, root: moved });
    expect(Object.keys(override.nodes).sort()).toEqual([inner.id, wave.id].sort());
    // the add follows the shared tree again, which has the text: the one in the wave is another node now
    const reset = settleOverride(shared, resetNode(override, inner.id));
    const all = ids(resolvePattern(shared, reset).root);
    expect(new Set(all).size).toBe(all.length);
    expect(leaves(resolvePattern(shared, reset).root).filter((n) => n.kind === 'text')).toHaveLength(2);
    // the wave itself keeps its id, so it stays in its place
    expect(findNode(resolvePattern(shared, reset).root, wave.id)).toMatchObject({ kind: 'sine' });
  });

  test('one setting or a whole node can be reset to the shared one', () => {
    const { text, inner } = tree();
    const override: IPieceOverride = { rotation: 5, nodes: { [text.id]: { values: { text: 'Jonas', size: 9 } }, [inner.id]: { own: inner } } };
    expect(resetNode(override, text.id, 'size').nodes[text.id]).toEqual({ values: { text: 'Jonas' } });
    expect(resetNode(resetNode(override, text.id, 'size'), text.id, 'text').nodes).toEqual({ [inner.id]: { own: inner } });
    expect(resetNode(override, text.id).nodes).toEqual({ [inner.id]: { own: inner } });
    expect(resetNode(override, inner.id)).toEqual({ rotation: 5, nodes: { [text.id]: { values: { text: 'Jonas', size: 9 } } } });
    expect(resetNode(override, 'gone')).toBe(override);
  });
});

describe('a unique tablet', () => {
  const unique = () => {
    const text = { ...textNode('all'), size: 6 };
    const gyroid = methodNode(DistanceMethodType.SDGyroid, 0.3);
    const inner = groupNode('add', [text, constantNode(1)]);
    const sdfSetting: IPattern = { ...defaultPattern(), root: groupNode('union', [gyroid, inner]) };
    const bar = combined({ sdfSetting, pieceMode: 'unique' });
    const named = (b: IBar, piece: number, name: string) => withPiecePattern(b, piece, { ...piecePattern(b, piece), root: updateNode(piecePattern(b, piece).root, text.id, (n) => ({ ...n, text: name }) as SdfNode) });
    return { bar, text, gyroid, inner, named };
  };
  const textOf = (bar: IBar, piece: number) => leaves(barFrames(bar)[piece].pattern.root).find((n): n is ITextNode => n.kind === 'text')?.text;

  test('an edit of a piece changes that piece only', () => {
    const { bar, named } = unique();
    const before = barFrames(bar);
    const edited = named(bar, 2, 'Jonas');
    const after = barFrames(edited);
    expect(bar.pieces.map((_, i) => textOf(edited, i))).toEqual(['all', 'all', 'Jonas', 'all']);
    [0, 1, 3].forEach((i) => expect(after[i].pattern).toBe(before[i].pattern));
    expect(after[2].pattern).not.toBe(before[2].pattern);
    expect(edited.overrides.map((o) => differs(o))).toEqual([false, false, true]);
    // the shared pattern is as it was
    expect(edited.sdfSetting).toBe(bar.sdfSetting);
  });

  test('an edit of all pieces reaches every piece, but for a setting that differs on one and a group one has its own of', () => {
    const { bar, text, gyroid, inner, named } = unique();
    let edited = named(bar, 2, 'Jonas');
    // piece 3 has another node in the add
    edited = withPiecePattern(edited, 3, { ...piecePattern(edited, 3), root: insertChild(piecePattern(edited, 3).root, inner.id, methodNode(DistanceMethodType.SDTorus)) });
    const root = updateNode(updateNode(edited.sdfSetting.root, text.id, (n) => ({ ...n, text: 'every', size: 9 }) as SdfNode), gyroid.id, (n) => ({ ...n, gain: 3 }));
    edited = withSharedPattern(edited, { ...edited.sdfSetting, root });
    expect(bar.pieces.map((_, i) => textOf(edited, i))).toEqual(['every', 'every', 'Jonas', 'all']);
    // the size of the text is not what differs on piece 2
    expect(findNode(piecePattern(edited, 2).root, text.id)).toMatchObject({ text: 'Jonas', size: 9 });
    bar.pieces.forEach((_, i) => expect(findNode(piecePattern(edited, i).root, gyroid.id)).toMatchObject({ gain: 3 }));
  });

  test('an uploaded svg shape is shared, whatever piece it was uploaded on', () => {
    const { bar } = unique();
    const svgs = { ...bar.sdfSetting.svgs, logo: { name: 'logo', source: '<svg/>' } };
    const edited = withPiecePattern(bar, 1, { ...piecePattern(bar, 1), svgs });
    expect(edited.sdfSetting.svgs).toBe(svgs);
    expect(edited.overrides.some(differs)).toBe(false);
  });

  test('leaving unique, the pattern of the piece becomes the shared one', () => {
    const { bar, named } = unique();
    const edited = named(named(bar, 1, 'Ada'), 2, 'Jonas');
    (['repeat', 'one'] as const).forEach((mode) => {
      const left = withPieceMode(edited, mode, 2);
      expect(left).toMatchObject({ pieceMode: mode, overrides: [] });
      expect(left.sdfSetting).toBe(piecePattern(edited, 2));
      expect(bar.pieces.map((_, i) => textOf(left, i))).toEqual(['Jonas', 'Jonas', 'Jonas', 'Jonas']);
    });
    // into unique and between the others nothing is lost
    expect(withPieceMode({ ...edited, pieceMode: 'repeat' }, 'unique', 0).overrides).toBe(edited.overrides);
  });

  test('another layout keeps what differs on a piece of the same size at the same place', () => {
    const { bar, named } = unique();
    const edited = named(named(bar, 0, 'Ada'), 3, 'Jonas');
    // the default layout with its second row the other way around: its first row stays
    const pieces = TABLET_LAYOUTS.find((l) => l.length === 4 && l.some((p) => p.size === '4x1' && p.u === 0 && p.v === 0) && l.some((p) => p.size === '4x1' && p.u === 0 && p.v === 1))!;
    const changed = withPieces(edited, pieces);
    const kept = pieces.findIndex((p) => p.size === '4x1' && p.u === 0 && p.v === 0);
    expect(changed.pieces).toBe(pieces);
    expect(pieces.map((_, i) => textOf(changed, i))).toEqual(pieces.map((_, i) => (i === kept ? 'Ada' : 'all')));
    expect(overrideOf(changed, kept)).toBe(overrideOf(edited, 0));
    // a layout of other pieces only keeps nothing
    expect(withPieces(edited, DEFAULT_PIECES.map((p) => ({ ...p, size: '1x2' as const }))).overrides).toEqual([]);
  });
});
