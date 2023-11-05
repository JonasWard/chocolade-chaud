import { Button, Drawer } from 'antd';
import React from 'react';
import { DistanceMethodType, IDistanceData, IMethodEntry, defaultDistanceData } from '../geometry/sdMethods';
import { ChocolateLogarithmicSlider } from './ChocolateLogarithmicSlider';
import './drawers.css';

export const MethodDrawer: React.FC<{ sdfSettings: IDistanceData; setSdfSettings: (ss: IDistanceData) => void }> = ({ sdfSettings, setSdfSettings }) => {
  const [showDrawer, setShowDrawer] = React.useState(false);

  const [entries, setEntries] = React.useState<IMethodEntry[]>(defaultDistanceData.methods);

  const updateEntries = (i: number, v: IMethodEntry) => {
    const localEntries = [...sdfSettings.methods];
    localEntries[i] = v;
    setEntries(entries);
    setSdfSettings({ ...sdfSettings, methods: localEntries });
  };

  const localSetEntries = (es: IMethodEntry[]) => {
    setEntries(es);
    setSdfSettings({ ...sdfSettings, methods: es });
  };

  return (
    <>
      {showDrawer ? null : (
        <Button className='drawer-button-left' onClick={() => setShowDrawer(!showDrawer)}>
          sdf
        </Button>
      )}
      <Drawer title='SdfSettings' placement='left' closable={true} onClose={() => setShowDrawer(false)} open={showDrawer}>
        {entries.map((entry, i) => (
          <ChocolateLogarithmicSlider min={-5} max={5} entry={entry} setEntry={(v: IMethodEntry) => updateEntries(i, v)} />
        ))}
        <Button onClick={() => localSetEntries([...entries, { method: DistanceMethodType.SDGyroid, number: 1 }])}>+</Button>
        <Button onClick={() => localSetEntries([...entries.slice(0, -1)])}>-</Button>
      </Drawer>
    </>
  );
};
