import { Button, ColorPicker, Drawer, Form, InputNumber, MenuProps, Space, Switch } from 'antd';
import React from 'react';
import './drawers.css';
import Dropdown from 'antd/es/dropdown/dropdown';
import { DefaultGridSettings, GridType, IGridSettings, MAX_DIV_PER_MM, MAX_UV_COUNT } from '../geometry/grid';
import { MethodContent } from './MethodContent';
import { DEFAULT_COLOR } from '../geometry/createMesh';

// IndividuallyCustomizable and Groupable are not implemented yet (their parsers return no meshes)
const IMPLEMENTED_GRID_TYPES = [GridType.Single, GridType.Simple];

export const GridGeometryDrawer: React.FC<{ gridSettings: IGridSettings; setGridSettings: (g: IGridSettings) => void }> = ({
  gridSettings,
  setGridSettings,
}) => {
  const [showDrawer, setShowDrawer] = React.useState(false);

  const updateType = (type: GridType) => setGridSettings(DefaultGridSettings(type));

  const menu: MenuProps = {
    items: IMPLEMENTED_GRID_TYPES.map((v) => ({
      key: v,
      label: <div onClick={() => updateType(v as GridType)}>{v}</div>,
    })),
  };

  const formRenderer = (gridSettings: IGridSettings) => {
    switch (gridSettings.type) {
      case GridType.Single:
        return (
          <Form layout='vertical'>
            <Form.Item label={'Inner Width'}>
              <InputNumber
                step={5}
                min={5}
                max={400}
                onChange={(v) => v !== null && setGridSettings({ ...gridSettings, cellWidth: v })}
                value={gridSettings.cellWidth}
              />
            </Form.Item>
            <Form.Item label={'Inner Length'}>
              <InputNumber
                step={5}
                min={5}
                max={400}
                onChange={(v) => v !== null && setGridSettings({ ...gridSettings, cellLength: v })}
                value={gridSettings.cellLength}
              />
            </Form.Item>
            <Form.Item label={'Height'}>
              <InputNumber step={0.5} min={2.5} max={10} onChange={(v) => v !== null && setGridSettings({ ...gridSettings, height: v })} value={gridSettings.height} />
            </Form.Item>
            <Form.Item label={'Inset'}>
              <InputNumber onChange={(v) => v !== null && setGridSettings({ ...gridSettings, inset: v })} value={gridSettings.inset} />
            </Form.Item>
            <Form.Item label={'Amplitude of Pattern'}>
              <InputNumber step={0.05} onChange={(v) => v !== null && setGridSettings({ ...gridSettings, amplitude: v })} value={gridSettings.amplitude} />
            </Form.Item>
            <Form.Item label={'Chocolate Color'}>
              <ColorPicker value={gridSettings.color} onChange={(c) => setGridSettings({ ...gridSettings, color: c.toHexString() })} />
            </Form.Item>
            <Form.Item label={'Divisions per mm'}>
              <InputNumber
                step={0.1}
                min={0.25}
                max={MAX_DIV_PER_MM}
                onChange={(v) => v !== null && setGridSettings({ ...gridSettings, divPerMM: v })}
                onStep={(v) => v !== null && setGridSettings({ ...gridSettings, divPerMM: v })}
                value={gridSettings.divPerMM}
              />
            </Form.Item>
            <Form.Item label={'Show Wireframe'}>
              <Switch onChange={(v) => setGridSettings({ ...gridSettings, displayWireframe: v })} checked={!!gridSettings.displayWireframe} />
            </Form.Item>
            <Form.Item label={'Edit Pattern'}>
              <MethodContent sdfSettings={gridSettings.sdfSetting} setSdfSettings={(sdfSetting) => setGridSettings({ ...gridSettings, sdfSetting })} />
            </Form.Item>
          </Form>
        );
      case GridType.Simple:
        return (
          <Form layout='vertical'>
            <Form.Item label={'Inner Width'}>
              <InputNumber
                step={5}
                min={5}
                max={200}
                onChange={(v) => v !== null && setGridSettings({ ...gridSettings, cellWidth: v })}
                value={gridSettings.cellWidth}
              />
            </Form.Item>
            <Form.Item label={'Inner Length'}>
              <InputNumber
                step={5}
                min={5}
                max={200}
                onChange={(v) => v !== null && setGridSettings({ ...gridSettings, cellLength: v })}
                value={gridSettings.cellLength}
              />
            </Form.Item>
            <Form.Item label={'Horizontal Items'}>
              <InputNumber
                step={1}
                min={1}
                max={MAX_UV_COUNT}
                onChange={(v) => v !== null && setGridSettings({ ...gridSettings, uCount: v })}
                value={gridSettings.uCount}
              />
            </Form.Item>
            <Form.Item label={'Vertical Items'}>
              <InputNumber
                step={1}
                min={1}
                max={MAX_UV_COUNT}
                onChange={(v) => v !== null && setGridSettings({ ...gridSettings, vCount: v })}
                value={gridSettings.vCount}
              />
            </Form.Item>
            <Form.Item label={'Height'}>
              <InputNumber step={0.5} min={2.5} max={10} onChange={(v) => v !== null && setGridSettings({ ...gridSettings, height: v })} value={gridSettings.height} />
            </Form.Item>
            <Form.Item label={'Inset'}>
              <InputNumber onChange={(v) => v !== null && setGridSettings({ ...gridSettings, inset: v })} value={gridSettings.inset} />
            </Form.Item>
            <Form.Item label={'Amplitude of Pattern'}>
              <InputNumber step={0.05} onChange={(v) => v !== null && setGridSettings({ ...gridSettings, amplitude: v })} value={gridSettings.amplitude} />
            </Form.Item>
            <Form.Item label={'Chocolate Color'} style={{ alignItems: 'center' }}>
              {gridSettings.colors.map((colorString, i) => (
                <ColorPicker
                  key={`color-${i}`}
                  value={colorString}
                  size='large'
                  onChange={(c) => {
                    const hexString = c.toHexString();
                    if (hexString === colorString) return;
                    setGridSettings({ ...gridSettings, colors: [...gridSettings.colors.slice(0, i), hexString, ...gridSettings.colors.slice(i + 1)] });
                  }}
                />
              ))}
              <Button
                size='large'
                onClick={() => {
                  setGridSettings({ ...gridSettings, colors: [...gridSettings.colors, DEFAULT_COLOR] });
                }}
              >
                +
              </Button>
            </Form.Item>
            <Form.Item label={'Divisions per mm'}>
              <InputNumber
                step={0.1}
                min={0.25}
                max={MAX_DIV_PER_MM}
                onChange={(v) => v !== null && setGridSettings({ ...gridSettings, divPerMM: v })}
                onStep={(v) => v !== null && setGridSettings({ ...gridSettings, divPerMM: v })}
                value={gridSettings.divPerMM}
              />
            </Form.Item>
            <Form.Item label={'Show Wireframe'}>
              <Switch onChange={(v) => setGridSettings({ ...gridSettings, displayWireframe: v })} checked={!!gridSettings.displayWireframe} />
            </Form.Item>
            <Form.Item label={'Edit Pattern'}>
              <MethodContent sdfSettings={gridSettings.sdfSetting} setSdfSettings={(sdfSetting) => setGridSettings({ ...gridSettings, sdfSetting })} />
            </Form.Item>
          </Form>
        );
      case GridType.Groupable:
      case GridType.IndividuallyCustomizable:
    }
  };

  return (
    <>
      {showDrawer ? null : (
        <Button className='drawer-button-right-grid' onClick={() => setShowDrawer(!showDrawer)}>
          grid
        </Button>
      )}
      <Drawer title='Grid Settings' placement='right' closable={true} onClose={() => setShowDrawer(false)} open={showDrawer}>
        <Dropdown className='method' menu={{ ...menu, selectedKeys: [gridSettings.type] }} trigger={['click']}>
          <Button onClick={(e) => e.preventDefault()}>
            <Space>{gridSettings.type}</Space>
          </Button>
        </Dropdown>
        {formRenderer(gridSettings)}
      </Drawer>
    </>
  );
};
