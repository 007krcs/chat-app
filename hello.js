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
        prefillFormFields(pdfDoc); // Prefill form fields if needed
      };

      fileReader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Error loading PDF file: ', error);
      alert('Failed to load the PDF file.');
    }
  };

  const prefillFormFields = (pdfDoc: PDFDocument) => {
    const form = pdfDoc.getForm();

    // Example: Prefill a text field
    const textField = form.getTextField('Name');
    textField.setText('John Doe');

    // Example: Prefill a checkbox field
    const checkboxField = form.getCheckBox('Agree');
    checkboxField.check();

    // Update the displayed PDF with prefilled fields
    const modifiedBytes = pdfDoc.save();
    modifiedBytes.then((bytes) => {
      setPdfBytes(new Uint8Array(bytes));
      displayPdf(new Uint8Array(bytes));
    });
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
