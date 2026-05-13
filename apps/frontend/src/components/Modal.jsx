import { useState } from 'react';

export default function Modal({ modal, onClose }) {
  const [values, setValues] = useState(
    Object.fromEntries(Object.entries(modal.fields).map(([k, f]) => [k, f.value ?? '']))
  );

  function confirm() {
    const data = {};
    for (const [k, v] of Object.entries(values)) {
      data[k] = !isNaN(v) && v !== '' ? Number(v) : v;
    }
    modal.onConfirm(data);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3>{modal.title}</h3>
        {Object.entries(modal.fields).map(([key, { label, type }]) => (
          <div className="field" key={key}>
            <label>{label}</label>
            <input
              type={type || 'text'}
              value={values[key] ?? ''}
              onChange={e => setValues(prev => ({ ...prev, [key]: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && confirm()}
              autoFocus={Object.keys(modal.fields).indexOf(key) === 0}
            />
          </div>
        ))}
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Annuleren</button>
          <button className="btn primary" onClick={confirm}>Aanmaken</button>
        </div>
      </div>
    </div>
  );
}
