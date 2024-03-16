import { Button } from 'antd';
import React from 'react';
import { DistanceMethodType, IDistanceData, IMethodEntry, defaultDistanceData } from '../geometry/sdMethods';
import { ChocolateLogarithmicSlider } from './ChocolateLogarithmicSlider';
import './drawers.css';
import { LogarithmicSlider } from './LogarithmicSlider';

export const MethodContent: React.FC<{ sdfSettings: IDistanceData; setSdfSettings: (ss: IDistanceData) => void }> = ({ sdfSettings, setSdfSettings }) => {
  const [entries, setEntries] = React.useState<IMethodEntry[]>(defaultDistanceData.methods);

  const updateEntries = (i: number, v: IMethodEntry) => {
    const localEntries = [...entries];
    localEntries[i] = v;
    setEntries(localEntries);
    setSdfSettings({ ...sdfSettings, methods: localEntries });
  };

  const localSetEntries = (es: IMethodEntry[]) => {
    setEntries(es);
    setSdfSettings({ ...sdfSettings, methods: es });
  };

  const updateCenter = (x: number, y: number, z: number) => {
    setSdfSettings({ ...sdfSettings, center: { x, y, z } });
  };

  return (
    <>
      {entries.map((entry, i) => (
        <ChocolateLogarithmicSlider key={i} min={-5} max={5} entry={entry} setEntry={(v: IMethodEntry) => updateEntries(i, v)} />
      ))}
      <LogarithmicSlider value={0} setValue={(v: number): void => updateCenter(v, sdfSettings.center.y, sdfSettings.center.z)} valueBefore='X: ' />
      <LogarithmicSlider value={0} setValue={(v: number): void => updateCenter(sdfSettings.center.x, v, sdfSettings.center.z)} valueBefore='Y: ' />
      <LogarithmicSlider value={0} setValue={(v: number): void => updateCenter(sdfSettings.center.x, sdfSettings.center.y, v)} valueBefore='Z: ' />
      <span>
        <Button onClick={() => localSetEntries([...entries, { method: DistanceMethodType.SDGyroid, number: 1 }])}>+</Button>
        <Button onClick={() => localSetEntries([...entries.slice(0, -1)])}>-</Button>
      </span>
    </>
  );
};
