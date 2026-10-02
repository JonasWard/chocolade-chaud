import React from 'react';
import { IPattern, SdfNode, svgKey } from '../../geometry/sdf/tree';
import { updateNode } from '../../geometry/sdf/treeOps';
import { MAX_SVG_BYTES } from '../../geometry/svg/rasterizeSvg';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { Field, NumberField, Section } from '../ui';
import { NodeAction, applyAction } from './actions';
import { DrillDownEditor } from './DrillDownEditor';
import { FormulaPreview } from './FormulaPreview';
import { OutlineEditor } from './OutlineEditor';
import { EditorContext } from './editorContext';

export const MOBILE = '(max-width: 720px)';

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
          <button
            aria-label={`remove ${svg.name}`}
            onClick={() => setSvgs(Object.fromEntries(Object.entries(pattern.svgs).filter(([k]) => k !== asset)))}
          >
            ✕
          </button>
          {errors[asset] && <span className='error'>{errors[asset]}</span>}
        </div>
      ))}
      <label className='upload'>
        Upload SVG…
        <input type='file' accept='.svg,image/svg+xml' multiple onChange={(e) => upload(e.target.files)} hidden />
      </label>
      {uploadError && <span className='error'>{uploadError}</span>}
      <p className='hint'>Filled and stroked parts are inside the shape. Use it with ⋯ › Add › SVG.</p>
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
  const mobile = useMediaQuery(MOBILE);
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
    <NumberField label={axis} value={pattern.center[axis]} step={1} onChange={(v) => setPattern({ ...pattern, center: { ...pattern.center, [axis]: v } })} />
  );

  const editorProps = { pattern, selected, onSelect: setSelected, onAction, onChange };
  return (
    <>
      <FormulaPreview pattern={pattern} selected={selected} />
      {mobile ? <DrillDownEditor {...editorProps} focus={focus} setFocus={setFocus} /> : <OutlineEditor {...editorProps} />}
      <Section title='Placement' className='subsection'>
        <Field label='Centre'>
          <div className='row'>
            {center('x')}
            {center('y')}
            {center('z')}
          </div>
        </Field>
        <Field label='Rotation °'>
          <NumberField value={pattern.rotation} step={5} onChange={(rotation) => setPattern({ ...pattern, rotation })} />
        </Field>
      </Section>
      <Section title='SVG shapes' className='subsection'>
        <SvgAssets pattern={pattern} setPattern={setPattern} />
      </Section>
    </>
  );
};
