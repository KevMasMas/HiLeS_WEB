import { Editor } from './features/editor/Editor'
import { MqttPanel } from './features/mqtt/MqttPanel'

function App() {
  return (
    <>
      <Editor />
      <div style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 30, width: 320, boxShadow: '0 10px 30px rgba(15, 23, 42, 0.18)', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
        <MqttPanel />
      </div>
    </>
  )
}

export default App
