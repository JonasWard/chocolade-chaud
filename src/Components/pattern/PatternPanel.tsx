import React from 'react';
import { IPattern, SdfNode, svgKey } from '../../geometry/sdf/tree';
import { updateNode } from '../../geometry/sdf/treeOps';
import { MAX_SVG_BYTES } from '../../geometry/svg/rasterizeSvg';
import { PATTERN } from '../../state/settings';
import { ErrorText, Field, Hint, NumberField, NumberSetting, Section } from '../ui';
import { NodeAction, applyAction } from './actions';
import { ColumnEditor } from './ColumnEditor';
import { FormulaPreview } from './FormulaPreview';
import { OutlineEditor } from './OutlineEditor';
import { EditorContext } from './editorContext';
import { Picker } from '../Picker';
import { PRESETS } from '../../geometry/sdf/presets';
import { Expert, useMode } from '../mode';

const SvgAssets: React.FC<{ pattern: IPattern; setPattern: (p: IPattern) => void }> = ({ pattern, setPattern }) => {
  const { errors } = React.useContext(EditorContext);
  const [uploadError, setUploadError] = React.useState<string>();
  const setSvgs = (svgs: IPattern['svgs']) => setPattern({ ...pattern, svgs });

  const upload = async (files: FileList | null) => {
    setUploadError(undefined);
    const added: IPattern['svgs'] = {};
    for (const file of files ?? []) {
      if (file.size > MAX_SVG_BYTES) setUploadError(`${file.name} is too large`);
      else {
        const source = await file.text();
        added[svgKey(source)] = { name: file.name.replace(/\.svg$/i, ''), source };
      }
    }
    setSvgs({ ...pattern.svgs, ...added });
  };

  return (
    <>
      {Object.entries(pattern.svgs).map(([asset, svg]) => (
        <div key={asset} className='row'>
          <input aria-label='name' value={svg.name} onChange={(e) => setSvgs({ ...pattern.svgs, [asset]: { ...svg, name: e.target.value } })} />
          <button aria-label={`remove ${svg.name}`} onClick={() => setSvgs(Object.fromEntries(Object.entries(pattern.svgs).filter(([k]) => k !== asset)))}>
            ✕
          </button>
          {errors[asset] && <ErrorText>{errors[asset]}</ErrorText>}
        </div>
      ))}
      <label className='upload'>
        Upload SVG…
        <input type='file' accept='.svg,image/svg+xml' multiple onChange={(e) => upload(e.target.files)} hidden />
      </label>
      {uploadError && <ErrorText>{uploadError}</ErrorText>}
      <Hint>Filled and stroked parts are inside the shape. Use it with ⋯ › Add › SVG.</Hint>
    </>
  );
};

/** the pattern of the bars: its tree of distance functions, its placement and the svg shapes it can use. selected is the selected node */
export const PatternPanel: React.FC<{ pattern: IPattern; setPattern: (p: IPattern) => void; selected?: string; setSelected: (id?: string) => void }> = ({
  pattern,
  setPattern,
  selected,
  setSelected,
}) => {
  const { mobile } = useMode();
  // the group the mobile editor shows
  const [focus, setFocus] = React.useState(pattern.root.id);

  const setRoot = (root: SdfNode) => setPattern({ ...pattern, root });
  const onChange = (node: SdfNode) => setRoot(updateNode(pattern.root, node.id, () => node));
  const onAction = (id: string, action: NodeAction) => {
    const { root, select } = applyAction(pattern, id, action);
    setRoot(root);
    if (select) setSelected(select);
  };
  const center = (axis: 'x' | 'y' | 'z') => (
    <NumberField
      label={axis}
      value={pattern.center[axis]}
      setting={PATTERN.center}
      onChange={(v) => setPattern({ ...pattern, center: { ...pattern.center, [axis]: v } })}
    />
  );

  // a preset replaces the tree, undo brings it back
  const pickPreset = (i: number) => {
    const { root, svgs } = PRESETS[i].make();
    setSelected(undefined);
    setFocus(root.id);
    setPattern({ ...pattern, root, svgs: { ...pattern.svgs, ...svgs } });
  };

  const editorProps = { pattern, selected, onSelect: setSelected, onAction, onChange };
  return (
    <>
      <Expert
        fallback={
          <Picker<number>
            label='start from a pattern'
            trigger={
              <>
                <span className='picker-label'>Start from a pattern…</span>
                <span className='picker-caret'>▾</span>
              </>
            }
            sections={[{ items: PRESETS.map((p, i) => ({ value: i, label: p.name })) }]}
            onPick={pickPreset}
          />
        }
      >
        <FormulaPreview pattern={pattern} selected={selected} />
      </Expert>
      {mobile ? <ColumnEditor {...editorProps} focus={focus} setFocus={setFocus} /> : <OutlineEditor {...editorProps} />}
      <Section title='Placement' className='subsection'>
        <Expert>
          <Field label={`${PATTERN.center.label} ${PATTERN.center.unit}`} group>
            <div className='row'>
              {center('x')}
              {center('y')}
              {center('z')}
            </div>
          </Field>
        </Expert>
        <NumberSetting setting={PATTERN.rotation} value={pattern.rotation} onChange={(rotation) => setPattern({ ...pattern, rotation })} />
      </Section>
      <Section title='SVG shapes' className='subsection'>
        <SvgAssets pattern={pattern} setPattern={setPattern} />
      </Section>
    </>
  );
};
