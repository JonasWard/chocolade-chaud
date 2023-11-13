import { Button, ColorPicker, Drawer, Form, InputNumber, MenuProps, Space, Switch } from 'antd';
import React from 'react';
import './drawers.css';
import Dropdown from 'antd/es/dropdown/dropdown';
import { DefaultGridSettings, GridType, IGridSettings, MAX_DIV_PER_MM, MAX_UV_COUNT } from '../geometry/grid';
import { DEFAULT_COLOR } from '../geometry/createMesh';

export const GridGeometryDrawer: React.FC<{ gridSettings: IGridSettings; setGridSettings: (g: IGridSettings) => void }> = ({
  gridSettings,
  setGridSettings,
}) => {
  const [showDrawer, setShowDrawer] = React.useState(false);
  const [localGridSettings, setLocalGridSettings] = React.useState<IGridSettings>(DefaultGridSettings(GridType.Single));

  const updateType = (type: GridType) => updateMethod({ ...localGridSettings, ...DefaultGridSettings(type) });

  const updateMethod = (gridSettings: IGridSettings) => {
    setLocalGridSettings(gridSettings);
    setGridSettings(gridSettings);
  };

  const menu: MenuProps = {
    items: Object.keys(GridType).map((v) => ({
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
                max={200}
                onChange={(v) => v && setGridSettings({ ...gridSettings, cellWidth: v })}
                value={gridSettings.cellWidth}
              />
            </Form.Item>
            <Form.Item label={'Inner Length'}>
              <InputNumber
                step={5}
                min={5}
                max={200}
                onChange={(v) => v && setGridSettings({ ...gridSettings, cellLength: v })}
                value={gridSettings.cellLength}
              />
            </Form.Item>
            <Form.Item label={'Height'}>
              <InputNumber step={0.5} min={2.5} max={10} onChange={(v) => v && setGridSettings({ ...gridSettings, height: v })} value={gridSettings.height} />
            </Form.Item>
            <Form.Item label={'Inset'}>
              <InputNumber onChange={(v) => v && setGridSettings({ ...gridSettings, inset: v })} value={gridSettings.inset} />
            </Form.Item>
            <Form.Item label={'Amplitude of Pattern'}>
              <InputNumber step={0.05} onChange={(v) => v && setGridSettings({ ...gridSettings, amplitude: v })} value={gridSettings.amplitude} />
            </Form.Item>
            <Form.Item label={'Chocolate Color'}>
              <ColorPicker value={gridSettings.color} onChange={(c) => setGridSettings({ ...gridSettings, color: c.toHexString() })} />
            </Form.Item>
            <Form.Item label={'Divisions per mm'}>
              <InputNumber
                step={0.1}
                min={0.25}
                max={MAX_DIV_PER_MM}
                onChange={(v) => v && setGridSettings({ ...gridSettings, divPerMM: v })}
                value={gridSettings.divPerMM}
              />
            </Form.Item>
            <Form.Item label={'Show Wireframe'}>
              <Switch onChange={(v) => setGridSettings({ ...gridSettings, displayWireframe: v })} checked={!!gridSettings.displayWireframe} />
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
                onChange={(v) => v && setGridSettings({ ...gridSettings, cellWidth: v })}
                value={gridSettings.cellWidth}
              />
            </Form.Item>
            <Form.Item label={'Inner Length'}>
              <InputNumber
                step={5}
                min={5}
                max={200}
                onChange={(v) => v && setGridSettings({ ...gridSettings, cellLength: v })}
                value={gridSettings.cellLength}
              />
            </Form.Item>
            <Form.Item label={'Horizontal Items'}>
              <InputNumber
                step={1}
                min={1}
                max={MAX_UV_COUNT}
                onChange={(v) => v && setGridSettings({ ...gridSettings, uCount: v })}
                value={gridSettings.uCount}
              />
            </Form.Item>
            <Form.Item label={'Vertical Items'}>
              <InputNumber
                step={1}
                min={1}
                max={MAX_UV_COUNT}
                onChange={(v) => v && setGridSettings({ ...gridSettings, vCount: v })}
                value={gridSettings.vCount}
              />
            </Form.Item>
            <Form.Item label={'Height'}>
              <InputNumber step={0.5} min={2.5} max={10} onChange={(v) => v && setGridSettings({ ...gridSettings, height: v })} value={gridSettings.height} />
            </Form.Item>
            <Form.Item label={'Inset'}>
              <InputNumber onChange={(v) => v && setGridSettings({ ...gridSettings, inset: v })} value={gridSettings.inset} />
            </Form.Item>
            <Form.Item label={'Amplitude of Pattern'}>
              <InputNumber step={0.05} onChange={(v) => v && setGridSettings({ ...gridSettings, amplitude: v })} value={gridSettings.amplitude} />
            </Form.Item>
            <Form.Item label={'Chocolate Color'}>
              {gridSettings.colors.map((colorString, i) => (
                <ColorPicker
                  value={colorString}
                  onChange={(c) =>
                    setGridSettings({ ...gridSettings, colors: [...gridSettings.colors.slice(0, i), c.toHexString(), ...gridSettings.colors.slice(i)] })
                  }
                />
              ))}
              <Button onClick={() => setGridSettings({ ...gridSettings, colors: [...gridSettings.colors, DEFAULT_COLOR] })}>Add Color</Button>
            </Form.Item>
            <Form.Item label={'Divisions per mm'}>
              <InputNumber
                step={0.1}
                min={0.25}
                max={MAX_DIV_PER_MM}
                onChange={(v) => v && setGridSettings({ ...gridSettings, divPerMM: v })}
                value={gridSettings.divPerMM}
              />
            </Form.Item>
            <Form.Item label={'Show Wireframe'}>
              <Switch onChange={(v) => setGridSettings({ ...gridSettings, displayWireframe: v })} checked={!!gridSettings.displayWireframe} />
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
      <Drawer title='SdfSettings' placement='right' closable={true} onClose={() => setShowDrawer(false)} open={showDrawer}>
        <Dropdown className='method' menu={{ ...menu, selectedKeys: [localGridSettings.type] }} trigger={['click']}>
          <Button onClick={(e) => e.preventDefault()}>
            <Space>{localGridSettings.type}</Space>
          </Button>
        </Dropdown>
        {formRenderer(gridSettings)}
      </Drawer>
    </>
  );
};
