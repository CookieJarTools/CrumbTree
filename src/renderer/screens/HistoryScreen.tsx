import { CommitGraph } from '../components/CommitGraph'
import { CommitDetail } from '../components/CommitDetail'
import { DiffView } from '../components/DiffView'
import { Resizer, useSize } from '../components/Resizer'
import { useStore } from '../store/store'

export function HistoryScreen() {
  const selectedFile = useStore((s) => s.selectedFile)
  const rightW = useSize('historyRightW', 460)
  const detailH = useSize('historyDetailH', 260)
  return (
    <div className="history-screen">
      <div className="history-left">
        <CommitGraph />
      </div>
      <Resizer axis="x" sizeKey="historyRightW" def={460} min={320} max={900} dir={-1} />
      <div className="history-right" style={{ width: rightW }}>
        <div className="history-detail" style={{ height: selectedFile ? detailH : undefined }}>
          <CommitDetail />
        </div>
        {selectedFile && (
          <>
            <Resizer axis="y" sizeKey="historyDetailH" def={260} min={120} max={600} dir={1} />
            <div className="history-diff">
              <DiffView />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
