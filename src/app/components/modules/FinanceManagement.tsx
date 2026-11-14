import React from 'react';
import KasBankModule from './finance/KasBankModule';
import GeneralLedgerModule from './finance/GeneralLedgerModule';
import { Coins, Layers, FileText } from 'lucide-react';

interface Props {
  subTab?: string;
}

export default function FinanceManagement({ subTab = 'kasBank' }: Props) {
  if (subTab === 'kasBank') return <KasBankModule />;
  if (subTab === 'generalLedger') return <GeneralLedgerModule />;

  // Placeholder views for the other sub-tabs
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-8 text-center max-w-2xl mx-auto my-8">
      <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
        {subTab === 'pattyCash' && <Coins size={28} />}
        {subTab === 'kasKecil' && <Layers size={28} />}
        {subTab === 'laporanKeuangan' && <FileText size={28} />}
      </div>
      <h3 className="text-lg font-bold text-slate-900 capitalize">
        {subTab === 'pattyCash' && 'Patty Cash'}
        {subTab === 'kasKecil' && 'Kas Kecil (Tante Yanti)'}
        {subTab === 'laporanKeuangan' && 'Laporan Keuangan & Rekapitulasi'}
      </h3>
      <p className="text-sm text-slate-500 mt-2">
        Modul ini siap dikonfigurasi setelah modul <b>Kas Bank</b> dan <b>General Ledger</b> selesai.
      </p>
    </div>
  );
}
