import { Button, Drawer, Form, InputNumber, Switch } from 'antd';
import React from 'react';
import './drawers.css';
import { IGeometrySettings } from '../geometry/createMesh';

export const GeometryDrawer: React.FC<{ geometrySettings: IGeometrySettings; setGeometrySettings: (ss: IGeometrySettings) => void }> = ({
  geometrySettings,
  setGeometrySettings,
}) => {
  const [showDrawer, setShowDrawer] = React.useState(false);

  return (
    <>
      {showDrawer ? null : (
        <Button className='drawer-button-right' onClick={() => setShowDrawer(!showDrawer)}>
          geo
        </Button>
      )}
      <Drawer title='SdfSettings' placement='right' closable={true} onClose={() => setShowDrawer(false)} open={showDrawer}>
        <Form layout='vertical'>
          <Form.Item label={'Inner Width'}>
            <InputNumber onChange={(v) => v && setGeometrySettings({ ...geometrySettings, innerWidth: v })} value={geometrySettings.innerWidth} />
          </Form.Item>
          <Form.Item label={'Inner Length'}>
            <InputNumber onChange={(v) => v && setGeometrySettings({ ...geometrySettings, innerLength: v })} value={geometrySettings.innerLength} />
          </Form.Item>
          <Form.Item label={'Height'}>
            <InputNumber onChange={(v) => v && setGeometrySettings({ ...geometrySettings, height: v })} value={geometrySettings.height} />
          </Form.Item>
          <Form.Item label={'Inset'}>
            <InputNumber onChange={(v) => v && setGeometrySettings({ ...geometrySettings, inset: v })} value={geometrySettings.inset} />
          </Form.Item>
          <Form.Item label={'Horizontal Divisions'}>
            <InputNumber
              onChange={(v) => v && setGeometrySettings({ ...geometrySettings, horizontalDivisions: v })}
              value={geometrySettings.horizontalDivisions}
            />
          </Form.Item>
          <Form.Item label={'Vertical Divisions'}>
            <InputNumber onChange={(v) => v && setGeometrySettings({ ...geometrySettings, verticalDivisions: v })} value={geometrySettings.verticalDivisions} />
          </Form.Item>
          <Form.Item label={'Base Position'}>
            <InputNumber
              onChange={(v) => (v || v === 0) && setGeometrySettings({ ...geometrySettings, basePosition: { ...geometrySettings.basePosition, x: v } })}
              value={geometrySettings.basePosition.x}
              name={'x'}
            />
            <InputNumber
              onChange={(v) => (v || v === 0) && setGeometrySettings({ ...geometrySettings, basePosition: { ...geometrySettings.basePosition, y: v } })}
              value={geometrySettings.basePosition.y}
              name={'y'}
            />
            <InputNumber
              onChange={(v) => (v || v === 0) && setGeometrySettings({ ...geometrySettings, basePosition: { ...geometrySettings.basePosition, z: v } })}
              value={geometrySettings.basePosition.z}
              name={'z'}
            />
          </Form.Item>
          <Form.Item label={'Show Wireframe'}>
            <Switch onChange={(v) => setGeometrySettings({ ...geometrySettings, displayWireframe: v })} checked={!!geometrySettings.displayWireframe} />
          </Form.Item>
        </Form>
      </Drawer>
    </>
  );
};
