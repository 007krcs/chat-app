import { useEffect, useRef, useState } from 'react';
import WebViewer, {WebViewerInstance} from '@pdftron/webviewer';

const PDFEditor = () => {
    const viewerDiv = useRef(null);
    const [instance, setInstance] = useState<WebViewerInstance | null>(null);

    useEffect(() => {
        let viewerInstance: any;

        if (!instance && viewerDiv.current) {
            WebViewer(
                {
                    path: '/lib', // Path to WebViewer's assets
                    initialDoc: '/blob.pdf', // Path to your PDF
                },
                viewerDiv.current,
            ).then((inst) => {
                viewerInstance = inst;
                setInstance(viewerInstance);
            });
        }

        return () => {
            if (viewerInstance) {
                viewerInstance.dispose(); // Dispose of the instance when the component unmounts or re-renders
                setInstance(null); // Clear the instance state
            }
        };
    }, [instance]);

    const savePdf = async () => {
        if (instance) {
            const { documentViewer, annotationManager } = instance.Core;
            const doc = documentViewer.getDocument() // TypeScript now understands the type
            const xfdfString = await annotationManager.exportAnnotations();
            const data = await doc.getFileData({ xfdfString });
            const blob = new Blob([new Uint8Array(data)], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'edited-document.pdf';
            a.click();
            URL.revokeObjectURL(url);
        }
    };

    return (
        <>
            <div
                ref={viewerDiv}
                style={{ height: '30rem', width: '100%', border: '1px solid black', marginLeft: '28rem' }}
            ></div>
            <button onClick={savePdf} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginLeft: '28rem' }}>Save PDF</button>
        </>
    );
};

export default PDFEditor;

"@pdftron/pdfjs-express": "^8.7.5",
    "@pdftron/webviewer": "^10.11.1",
