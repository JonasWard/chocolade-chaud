import React from 'react';
import { IPattern, svgKey } from '../../../geometry/sdf/tree';
import { MAX_SVG_BYTES } from '../../../geometry/svg/rasterizeSvg';
import { numberField } from '../../../state/schema';
import { Field, NumberField, NumberSetting } from '../../shared/Fields';
import { ErrorText, Hint } from '../../shared/Hint';
import { SubPanel } from '../../shared/SettingsPanel';
import { ColumnEditor } from './ColumnEditor';
import { FormulaPreview } from './FormulaPreview';
import { OutlineEditor } from './OutlineEditor';
import { usePatternEditorContext } from '../../../hooks/usePatternEditor';
import { Picker } from '../../shared/Picker';
import { PRESETS } from '../../../geometry/sdf/presets';
import { Expert, useMode } from '../../shared/Mode';

// x, y and z have the same range
const [CENTER, ROTATION] = ['center.x', 'rotation'].map(numberField);

const SvgAssets: React.FC<{ pattern: IPattern; setPattern: (p: IPattern) => void }> = ({ pattern, setPattern }) => {
  const { errors } = usePatternEditorContext();
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

/** the pattern of the bars: its tree of distance functions, its placement and the svg shapes it can use */
export const PatternPanel: React.FC = () => {
  const { mobile } = useMode();
  const { pattern, setPattern, pickPreset } = usePatternEditorContext();
  const center = (axis: 'x' | 'y' | 'z') => (
    <NumberField
      label={axis}
      value={pattern.center[axis]}
      field={CENTER}
      step={1}
      onChange={(v) => setPattern({ ...pattern, center: { ...pattern.center, [axis]: v } })}
    />
  );

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
        <FormulaPreview />
      </Expert>
      {mobile ? <ColumnEditor /> : <OutlineEditor />}
      <SubPanel id='placement' title='Placement'>
        <Expert>
          <Field label='Centre mm' group>
            <div className='row'>
              {center('x')}
              {center('y')}
              {center('z')}
            </div>
          </Field>
        </Expert>
        <NumberSetting label='Rotation °' field={ROTATION} step={5} value={pattern.rotation} onChange={(rotation) => setPattern({ ...pattern, rotation })} />
      </SubPanel>
      <SubPanel id='svgs' title='SVG shapes'>
        <SvgAssets pattern={pattern} setPattern={setPattern} />
      </SubPanel>
    </>
  );
};
