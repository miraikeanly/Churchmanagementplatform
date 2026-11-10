import React from 'react';
import { DollarSign } from 'lucide-react';

export default function FinanceManagement() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
        <DollarSign size={28} />
      </div>
      <h3 className="text-lg font-bold text-slate-900">Modul Keuangan Bersih (Siap Dikonfigurasi Ulang)</h3>
      <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
        Semua fitur dan data eksperimen sebelumnya telah dibersihkan. Silakan berikan instruksi lengkap dari klien Anda untuk dibangun kembali dari awal.
      </p>
    </div>
  );
}
