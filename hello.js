import React, { useState } from 'react';
import { PDFDocument, PDFTextField, PDFCheckBox } from 'pdf-lib';

const PDFEditor: React.FC = () => {
  const [pdfDoc, setPdfDoc] = useState<PDFDocument | null>(null);
  const [formFields, setFormFields] = useState<{ [key: string]: string }>({});

  const loadPdf = async (file: File) => {
    try {
      const fileReader = new FileReader();

      fileReader.onload = async () => {
        const typedArray = new Uint8Array(fileReader.result as ArrayBuffer);
        const doc = await PDFDocument.load(typedArray);
        setPdfDoc(doc);

        const form = doc.getForm();
        const fields = form.getFields();

        const initialValues: { [key: string]: string } = {};
        fields.forEach(field => {
          const fieldName = field.getName();
          if (field instanceof PDFTextField) {
            initialValues[fieldName] = field.getText();
          } else if (field instanceof PDFCheckBox) {
            initialValues[fieldName] = field.isChecked() ? 'checked' : '';
          }
        });

        setFormFields(initialValues);
      };

      fileReader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Error loading PDF file:', error);
      alert('Failed to load the PDF file.');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormFields({
      ...formFields,
      [name]: value,
    });
  };

  const savePdf = async () => {
    if (pdfDoc) {
      const form = pdfDoc.getForm();
      Object.keys(formFields).forEach(key => {
        const field = form.getField(key);
        if (field instanceof PDFTextField) {
          field.setText(formFields[key]);
        } else if (field instanceof PDFCheckBox) {
          if (formFields[key] === 'checked') {
            field.check();
          } else {
            field.uncheck();
          }
        }
      });

      const modifiedBytes = await pdfDoc.save();
      const blob = new Blob([modifiedBytes], { type: 'application/pdf' });
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

      {Object.keys(formFields).length > 0 && (
        <form>
          {Object.keys(formFields).map((fieldName) => (
            <div key={fieldName}>
              <label>{fieldName}</label>
              <input
                type="text"
                name={fieldName}
                value={formFields[fieldName]}
                onChange={handleChange}
              />
            </div>
          ))}
        </form>
      )}

      <button onClick={savePdf} disabled={!pdfDoc}>
        Save PDF
      </button>
    </div>
  );
};

export default PDFEditor;
