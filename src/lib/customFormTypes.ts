export type QuestionType =
  | 'short_text'
  | 'paragraph'
  | 'radio'
  | 'checkbox'
  | 'dropdown'
  | 'date'
  | 'time'
  | 'file_upload';

export interface FormQuestion {
  id: string;
  title: string;
  type: QuestionType;
  required: boolean;
  options?: string[]; // for radio, checkbox, dropdown
  description?: string;
  placeholder?: string;
  isPaymentProof?: boolean; // marks this question as payment proof
}

export type FormTheme = 'standard' | 'natal' | 'paskah' | 'retret' | 'youth' | 'custom';

export interface CustomEventForm {
  id: string;
  title: string;
  description?: string;
  slug: string;
  active: boolean;
  showOnHomepage: boolean;
  headerBannerUrl?: string;
  theme?: FormTheme;
  customColor?: string; // hex or tailwind-like color e.g. '#2563eb'
  questions: FormQuestion[];
  createdAt: string;
  updatedAt: string;
}

export interface FormSubmission {
  id: string;
  formId: string;
  formSlug: string;
  formTitle: string;
  submittedAt: string;
  answers: Record<string, any>; // questionId -> value (string | string[])
}

export const QUESTION_TYPES = [
  { value: 'short_text',   label: 'Jawaban singkat', icon: 'Minus' },
  { value: 'paragraph',    label: 'Paragraf',        icon: 'AlignLeft' },
  { value: 'radio',        label: 'Pilihan ganda',   icon: 'CheckCircle2' },
  { value: 'checkbox',     label: 'Kotak centang',   icon: 'CheckSquare' },
  { value: 'dropdown',     label: 'Drop-down',       icon: 'ChevronDown' },
  { value: 'date',         label: 'Tanggal',         icon: 'Calendar' },
  { value: 'time',         label: 'Waktu',           icon: 'Clock' },
  { value: 'file_upload',  label: 'Upload Bukti Pembayaran / Foto', icon: 'Upload' },
] as const;
