import { StagingPanel } from '../components/StagingPanel'
import { DiffView } from '../components/DiffView'
import { Resizer, useSize } from '../components/Resizer'

export function ChangesScreen() {
  const leftW = useSize('changesLeftW', 340)
  return (
    <div className="changes-screen">
      <div className="changes-left" style={{ width: leftW }}>
        <StagingPanel />
      </div>
      <Resizer axis="x" sizeKey="changesLeftW" def={340} min={260} max={560} dir={1} />
      <div className="changes-right">
        <DiffView />
      </div>
    </div>
  )
}
