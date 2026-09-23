import { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';

interface CodeEditorProps {
  codigo: string;
  lenguaje: 'javascript' | 'python';
  onChange: (nuevoCodigo: string) => void;
  onProbar?: () => void;
  resultadoPrueba?: string | null;
  variablesDisponibles?: string[];
}

export const CodeEditor = ({
  codigo,
  lenguaje,
  onChange,
  onProbar,
  resultadoPrueba,
  variablesDisponibles,
}: CodeEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  // Inicializar o recrear el editor cuando cambie el lenguaje
  useEffect(() => {
    if (!editorRef.current) return;

    const extensions = [
      basicSetup,
      oneDark,
      EditorView.lineWrapping,
      lenguaje === 'python' ? python() : javascript(),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChange(update.state.doc.toString());
        }
      })
    ];

    const state = EditorState.create({
      doc: codigo,
      extensions
    });

    const view = new EditorView({
      state,
      parent: editorRef.current
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Deshabilitamos la regla porque si ponemos 'codigo' o 'onChange', 
    // CodeMirror se destruirá y recreará en cada tipeo (perdiendo el foco).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lenguaje]); 

  // Sincronizar cambios que vengan de afuera (e.g. deshacer de zustand, o selección de otro nodo)
  useEffect(() => {
    if (viewRef.current) {
      const currentCode = viewRef.current.state.doc.toString();
      if (codigo !== currentCode) {
        viewRef.current.dispatch({
          changes: { from: 0, to: currentCode.length, insert: codigo }
        });
      }
    }
  }, [codigo]);

  const isError = resultadoPrueba?.startsWith('⚠') || resultadoPrueba?.toLowerCase().includes('error') || resultadoPrueba?.startsWith('Error');

  return (
    <div style={{ marginTop: '8px', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {/* Chips con las variables de los puertos de entrada */}
      {variablesDisponibles && variablesDisponibles.length > 0 && (
        <div className="code-editor__vars">
          {variablesDisponibles.map((v) => (
            <span key={v} className="code-editor__var-chip" title="Variable disponible en este bloque">{v}</span>
          ))}
        </div>
      )}
      
      {/* Contenedor del DOM para CodeMirror */}
      <div 
        ref={editorRef} 
        className={`code-editor-wrapper ${isError ? 'has-error' : ''}`}
        style={{ fontSize: '12px' }}
      />

      {/* Botón de probar código (ejecución inline) */}
      {onProbar && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
          <button 
            onClick={onProbar}
            style={{ 
              padding: '2px 8px', fontSize: '11px', cursor: 'pointer', 
              borderRadius: '4px', border: '1px solid #cbd5e1', background: '#f8fafc' 
            }}
          >
            ▶ Probar código
          </button>
        </div>
      )}

      {/* Retroalimentación de la ejecución */}
      {resultadoPrueba && (
        <div className={isError ? 'code-editor__error-msg' : ''} style={{ fontSize: '11px', color: isError ? '#dc2626' : '#16a34a' }}>
          {resultadoPrueba}
        </div>
      )}
    </div>
  );
};
