import { Button, MenuProps, Slider, Space } from 'antd';
import { Dropdown } from 'antd';
import React from 'react';
import { DistanceMethodType, IMethodEntry } from '../geometry/sdMethods';
import './slider.css';

export const ChocolateLogarithmicSlider: React.FC<{ entry: IMethodEntry; setEntry: (v: IMethodEntry) => void; min?: number; max?: number }> = ({
  min = -5,
  max = 5,
  entry,
  setEntry,
}) => {
  const [localValue, setLocalValue] = React.useState(Math.log10(entry.number));
  const [localMethod, setLocalMethod] = React.useState(entry.method);
  const updateValue = (v: number) => {
    setEntry({ method: localMethod, number: 10 ** v });
    setLocalValue(v);
  };

  const updateMethod = (method: DistanceMethodType) => {
    setLocalMethod(method);
    setEntry({ number: 10 ** localValue, method });
  };

  const menu: MenuProps = {
    items: Object.keys(DistanceMethodType).map((v) => ({
      key: v,
      label: <div onClick={() => updateMethod(v as DistanceMethodType)}>{v}</div>,
    })),
  };

  return (
    <div className='parent'>
      <Dropdown className='method' menu={{ ...menu, selectedKeys: [localMethod] }} trigger={['click']}>
        <Button onClick={(e) => e.preventDefault()}>
          <Space>{localMethod}</Space>
        </Button>
      </Dropdown>
      <Slider
        className='slider'
        value={localValue}
        onChange={updateValue}
        min={min}
        max={max}
        step={0.01}
        tooltip={{ formatter: (v) => `${(10 ** (v ?? 0)).toPrecision(3)}` }}
      />
      <div className='number'>{`${(10 ** localValue).toPrecision(3)}`}</div>
    </div>
  );
};
