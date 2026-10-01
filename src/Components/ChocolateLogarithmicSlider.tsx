import { Button, MenuProps, Slider, Space } from 'antd';
import { Dropdown } from 'antd';
import React from 'react';
import { DistanceMethodType, IMethodEntry } from '../geometry/sdMethods';
import './slider.css';
import gyroid from '../assets/icons/gyroid.png';
import neovius from '../assets/icons/neovius.png';
import schwarzD from '../assets/icons/schwarzD.png';
import schwarzP from '../assets/icons/schwarzP.png';

const LocalMethodImage: React.FC<{ method: DistanceMethodType }> = ({ method }) => {
  const imageStyle: React.CSSProperties = { width: 32, height: 32, marginRight: 8 };

  switch (method) {
    case DistanceMethodType.SDGyroid:
      return <img style={imageStyle} src={gyroid} alt={method} />;
    case DistanceMethodType.SDSchwarzP:
      return <img style={imageStyle} src={schwarzP} alt={method} />;
    case DistanceMethodType.SDSchwarzD:
      return <img style={imageStyle} src={schwarzD} alt={method} />;
    case DistanceMethodType.SDNeovius:
      return <img style={imageStyle} src={neovius} alt={method} />;
    default:
      return <img style={imageStyle} alt='' />;
  }
};

export const MethodIcon: React.FC<{ method: DistanceMethodType }> = ({ method }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', width: 80 }}>
      <LocalMethodImage method={method} />
      <div style={{ width: 40, textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>{method.slice(2)}</div>
    </div>
  );
};

export const ChocolateLogarithmicSlider: React.FC<{ entry: IMethodEntry; setEntry: (v: IMethodEntry) => void; min?: number; max?: number }> = ({
  min = -5,
  max = 5,
  entry,
  setEntry,
}) => {
  const localValue = Math.log10(entry.number);
  const localMethod = entry.method;

  const updateValue = (v: number) => setEntry({ method: localMethod, number: 10 ** v });

  const updateMethod = (method: DistanceMethodType) => setEntry({ number: entry.number, method });

  const menu: MenuProps = {
    items: Object.keys(DistanceMethodType).map((v) => ({
      key: v,
      label: (
        <div onClick={() => updateMethod(v as DistanceMethodType)}>
          <MethodIcon method={v as DistanceMethodType} />
        </div>
      ),
    })),
  };

  return (
    <div className='parent'>
      <Dropdown className='method' menu={{ ...menu, selectedKeys: [localMethod] }} trigger={['click']}>
        <Button style={{ height: 40, width: 120 }} onClick={(e) => e.preventDefault()}>
          <Space>
            <MethodIcon method={localMethod} />
          </Space>
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
