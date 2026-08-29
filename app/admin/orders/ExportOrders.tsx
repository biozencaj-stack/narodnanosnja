'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';

export function ExportOrders() {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.append('from', fromDate);
      if (toDate) params.append('to', toDate);

      const response = await fetch(`/api/admin/orders/export?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `porudzbine-${new Date().toISOString().split('T')[0]}.xlsx`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export error:', error);
      alert('Greška pri exportu porudžbina');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex items-center gap-4 bg-white p-4 rounded-lg shadow-sm">
      <div className="flex items-center gap-2">
        <label htmlFor="fromDate" className="text-sm text-stone-600">
          Od:
        </label>
        <input
          type="date"
          id="fromDate"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="px-3 py-1.5 border border-stone-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-stone-500"
        />
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="toDate" className="text-sm text-stone-600">
          Do:
        </label>
        <input
          type="date"
          id="toDate"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="px-3 py-1.5 border border-stone-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-stone-500"
        />
      </div>
      <button
        onClick={handleExport}
        disabled={isExporting}
        className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-md text-sm font-medium hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <Download className="h-4 w-4" />
        {isExporting ? 'Exportujem...' : 'Export Excel'}
      </button>
    </div>
  );
}
