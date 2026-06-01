export interface Visit {
  id: string;
  visitCode: string;
  patientId: string;
  doctorId: string;
  visitDate: string;
  chiefComplaint?: string | null;
  doctorNotes?: string | null;
  diagnosis?: string | null;
  status: "OPEN" | "COMPLETED" | "CANCELLED";
  totalAmount: number;
  paidAmount: number;
  createdAt: number;
  updatedAt: number;
  patientName?: string;
  patientCode?: string;
  doctorName?: string;
}

export interface VisitItem {
  id: string;
  visitId: string;
  itemName: string;
  category: "MEDICINE" | "PROCEDURE" | "XRAY" | "CONSULTATION" | "OTHER";
  toothNumber?: string | null;
  quantity: number;
  unitPrice: number;
  amount: number;
  notes?: string | null;
  createdAt: number;
}

export interface Payment {
  id: string;
  visitId: string;
  patientId: string;
  amount: number;
  paymentMethod: "CASH" | "CARD" | "UPI" | "BANK_TRANSFER";
  referenceNumber?: string | null;
  notes?: string | null;
  paidAt: number;
  recordedBy: string;
  recordedByName?: string;
}

export interface Attachment {
  id: string;
  visitId: string;
  patientId: string;
  fileName: string;
  originalName: string;
  fileType: "XRAY" | "PRESCRIPTION" | "DOCTOR_NOTE" | "LAB_REPORT" | "OTHER";
  mimeType: string;
  fileSize: number;
  fileUrl: string;
  uploadedBy: string;
  uploadedByName?: string;
  createdAt: number;
}

export interface PatientBalance {
  totalBilled: number;
  totalPaid: number;
  totalDue: number;
  visitCount: number;
  pendingVisits: number;
  lastVisit: string | null;
}
