import React from 'react';
import './navbar.css';
import { ChocolateLogarithmicSlider } from './Components/ChocolateLogarithmicSlider';
import { DistanceMethodType, IDistanceData, IMethodEntry, defaultDistanceData } from './geometry/sdMethods';
import { Button } from 'antd';

export const Navbar: React.FC<{ sdfSettings: IDistanceData; setSdfSettings: (ss: IDistanceData) => void }> = ({ sdfSettings, setSdfSettings }) => {
  const [entries, setEntries] = React.useState<IMethodEntry[]>(defaultDistanceData.methods);

  const updateEntries = (i: number, v: IMethodEntry) => {
    const localEntries = [...sdfSettings.methods];
    localEntries[i] = v;
    setEntries(entries);
    setSdfSettings({ ...sdfSettings, methods: localEntries });
  };

  return (
    <div className='navbar-main'>
      {entries.map((entry, i) => (
        <ChocolateLogarithmicSlider min={-5} max={5} entry={entry} setEntry={(v: IMethodEntry) => updateEntries(i, v)} />
      ))}
      <Button onClick={() => setEntries([...entries, { method: DistanceMethodType.SDGyroid, number: 1 }])}>+</Button>
      <Button onClick={() => setEntries([...entries.slice(0, -1)])}>-</Button>
    </div>
  );
};

export default Navbar;
