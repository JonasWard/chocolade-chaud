import { Button, InputNumber } from 'antd';
import React from 'react';
import { DistanceMethodType, IDistanceData, IMethodEntry } from '../geometry/sdMethods';
import { ChocolateLogarithmicSlider } from './ChocolateLogarithmicSlider';
import './drawers.css';

export const MethodContent: React.FC<{ sdfSettings: IDistanceData; setSdfSettings: (ss: IDistanceData) => void }> = ({ sdfSettings, setSdfSettings }) => {
  const entries = sdfSettings.methods;

  const setEntries = (methods: IMethodEntry[]) => setSdfSettings({ ...sdfSettings, methods });

  const updateEntries = (i: number, v: IMethodEntry) => setEntries([...entries.slice(0, i), v, ...entries.slice(i + 1)]);

  const updateCenter = (axis: 'x' | 'y' | 'z', v: number | null) => {
    if (v === null) return;
    setSdfSettings({ ...sdfSettings, center: { ...sdfSettings.center, [axis]: v } });
  };

  return (
    <>
      {entries.map((entry, i) => (
        <ChocolateLogarithmicSlider key={i} min={-5} max={5} entry={entry} setEntry={(v: IMethodEntry) => updateEntries(i, v)} />
      ))}
      {(['x', 'y', 'z'] as const).map((axis) => (
        <InputNumber key={axis} addonBefore={axis.toUpperCase()} step={1} value={sdfSettings.center[axis]} onChange={(v) => updateCenter(axis, v)} />
      ))}
      <span>
        <Button onClick={() => setEntries([...entries, { method: DistanceMethodType.SDGyroid, number: 1 }])}>+</Button>
        <Button onClick={() => setEntries(entries.slice(0, -1))}>-</Button>
      </span>
    </>
  );
};
