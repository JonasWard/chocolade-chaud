import React from 'react';
import './App.css';
import { Scene } from './three/Scene';
import { Export } from './Components/Export';
import { DefaultGridSettings, GridType, IGridSettings } from './geometry/grid';
import { GridGeometryDrawer } from './Components/GridGeometryDrawer';
import { useGridMeshes } from './hooks/useGridMeshes';
import { Spin } from 'antd';

function App() {
  const [gridSettings, setGridSettings] = React.useState<IGridSettings>(DefaultGridSettings(GridType.Single));
  const { result, pending, error } = useGridMeshes(gridSettings);

  return (
    <div className='App'>
      <header className='App-header'>
        <Scene meshes={result} />
      </header>
      <Spin className='mesh-status' spinning={pending} />
      {error && <div className='mesh-status'>{error}</div>}
      <Export meshes={pending ? undefined : result} />
      <GridGeometryDrawer gridSettings={gridSettings} setGridSettings={setGridSettings} />
    </div>
  );
}

export default App;
