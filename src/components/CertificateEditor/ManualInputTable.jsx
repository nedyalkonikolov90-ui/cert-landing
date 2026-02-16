import React, { useRef, useCallback } from "react";

export default function ManualInputTable({ manualRows, setManualRows }) {
  const nameRefs = useRef([]);
  const awardRefs = useRef([]);

  const addRow = useCallback((focusIndex = null) => {
    setManualRows((prev) => {
      const next = [...prev, { name: "", award: "" }];
      const idx = focusIndex ?? next.length - 1;
      setTimeout(() => nameRefs.current?.[idx]?.focus(), 0);
      return next;
    });
  }, [setManualRows]);

  const updateRow = useCallback((idx, patch) => {
    setManualRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }, [setManualRows]);

  const removeRow = useCallback((idx) => {
    setManualRows((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((_, i) => i !== idx);
      
      // Clean up refs
      nameRefs.current = nameRefs.current.filter((_, i) => i !== idx);
      awardRefs.current = awardRefs.current.filter((_, i) => i !== idx);
      
      setTimeout(() => {
        const target = Math.min(idx, next.length - 1);
        nameRefs.current?.[target]?.focus();
      }, 0);
      return next;
    });
  }, [setManualRows]);

  const handleKeyDown = useCallback((e, idx, field) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (field === "name") {
        awardRefs.current?.[idx]?.focus();
      } else {
        if (idx === manualRows.length - 1) {
          addRow();
        } else {
          nameRefs.current?.[idx + 1]?.focus();
        }
      }
    }
  }, [manualRows.length, addRow]);

  const handlePaste = useCallback((e) => {
    const text = e.clipboardData?.getData("text/plain") || "";
    const lines = text.split("\n").filter(l => l.trim());
    
    if (lines.length <= 1) return;
    
    e.preventDefault();
    
    const parsed = lines.map(line => {
      if (line.includes("\t")) {
        const [name, award] = line.split("\t");
        return { name: name?.trim() || "", award: award?.trim() || "" };
      }
      if (line.includes(",")) {
        const [name, award] = line.split(",");
        return { name: name?.trim() || "", award: award?.trim() || "" };
      }
      return null;
    }).filter(Boolean);

    if (parsed.length > 0) {
      setManualRows((prev) => {
        const first = prev[0];
        const shouldReplace = !first.name?.trim() && !first.award?.trim();
        return shouldReplace ? parsed : [...prev, ...parsed];
      });
    }
  }, [setManualRows]);

  return (
    <div className="manual-table">
      <div className="table-header">
        <div className="table-header-cell">Name</div>
        <div className="table-header-cell">Award / Achievement</div>
        <div className="table-header-action"></div>
      </div>
      
      <div className="table-body">
        {manualRows.map((row, idx) => (
          <div key={idx} className="table-row">
            <input
              ref={(el) => (nameRefs.current[idx] = el)}
              className="table-input"
              value={row.name}
              onChange={(e) => updateRow(idx, { name: e.target.value })}
              onKeyDown={(e) => handleKeyDown(e, idx, "name")}
              onPaste={handlePaste}
              placeholder="Full name"
            />
            <input
              ref={(el) => (awardRefs.current[idx] = el)}
              className="table-input"
              value={row.award}
              onChange={(e) => updateRow(idx, { award: e.target.value })}
              onKeyDown={(e) => handleKeyDown(e, idx, "award")}
              placeholder="Achievement description"
            />
            <button
              className="table-remove-btn"
              onClick={() => removeRow(idx)}
              disabled={manualRows.length === 1}
              title="Remove row"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        ))}
      </div>

      <button className="add-row-btn" onClick={() => addRow()}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        Add Row
      </button>

      <p className="table-hint">
        💡 Tip: Paste from Excel/Sheets or press Enter to add rows quickly
      </p>
    </div>
  );
}
