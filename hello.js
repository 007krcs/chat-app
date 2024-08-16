import React, { useState, useRef } from 'react';
import { PDFDocument } from 'pdf-lib';

const PDFEditor: React.FC = () => {
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const loadPdf = async (file: File) => {
    try {
      const fileReader = new FileReader();

      fileReader.onload = async () => {
        const typedArray = new Uint8Array(fileReader.result as ArrayBuffer);
        const pdfDoc = await PDFDocument.load(typedArray);
        setPdfBytes(typedArray);
        displayPdf(typedArray); // Display the original PDF
      };

      fileReader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Error loading PDF file: ', error);
      alert('Failed to load the PDF file.');
    }
  };

  const modifyPdf = async () => {
    if (pdfBytes) {
      try {
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const form = pdfDoc.getForm();

        // Example: Set text field value
        const textField = form.getTextField('Name');
        textField.setText('John Doe');

        // Example: Set checkbox value
        const checkboxField = form.getCheckBox('Agree');
        checkboxField.check();

        // Save the modifications
        const modifiedBytes = await pdfDoc.save();
        setPdfBytes(modifiedBytes);
        displayPdf(modifiedBytes); // Display the modified PDF
      } catch (error) {
        console.error('Error modifying PDF: ', error);
        alert('Failed to modify the PDF.');
      }
    }
  };

  const displayPdf = (pdfData: Uint8Array) => {
    const blob = new Blob([pdfData], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    if (iframeRef.current) {
      iframeRef.current.src = url;
    }
  };

  const savePdf = () => {
    if (pdfBytes) {
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'modified.pdf';
      link.click();
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="application/pdf"
        onChange={(e) => {
          if (e.target.files) loadPdf(e.target.files[0]);
        }}
      />
      <button onClick={modifyPdf} disabled={!pdfBytes}>
        Modify PDF
      </button>
      <button onClick={savePdf} disabled={!pdfBytes}>
        Save PDF
      </button>

      <iframe
        ref={iframeRef}
        title="PDF Viewer"
        style={{ width: '100%', height: '500px', border: 'none' }}
      />
    </div>
  );
};

export default PDFEditor;
