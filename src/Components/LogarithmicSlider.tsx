import { Slider } from 'antd';
import React from 'react';
import './slider.css';

export const LogarithmicSlider: React.FC<{ value: number; setValue: (v: number) => void; min?: number; max?: number; valueBefore?: string }> = ({
  min = -5,
  max = 5,
  value,
  setValue,
  valueBefore,
}) => {
  const [localValue, setLocalValue] = React.useState(Math.log10(value));
  const updateValue = (v: number) => {
    setValue(10 ** v);
    setLocalValue(v);
  };

  return (
    <div className='parent'>
      <Slider
        className='slider'
        value={localValue}
        onChange={updateValue}
        min={min}
        max={max}
        step={0.01}
        tooltip={{ formatter: (v) => `${(10 ** (v ?? 0)).toPrecision(3)}` }}
      />
      <div className='number'>{`${valueBefore ?? ''} ${(10 ** localValue).toPrecision(3)}`}</div>
    </div>
  );
};
