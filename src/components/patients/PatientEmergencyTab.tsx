"use client";

interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email?: string | null;
}

interface Props {
  contacts: EmergencyContact[];
}

export function PatientEmergencyTab({ contacts }: Props) {
  if (contacts.length === 0) {
    return <p className="text-center text-slate-400 text-sm py-6">No emergency contacts on file.</p>;
  }

  return (
    <div className="space-y-3">
      {contacts.map((c) => (
        <div key={c.id} className="flex items-start justify-between py-2 border-b border-slate-50 last:border-0">
          <div>
            <p className="text-sm font-medium text-slate-900">{c.name}</p>
            <p className="text-xs text-slate-500">{c.relationship}</p>
            {c.email && <p className="text-xs text-slate-400">{c.email}</p>}
          </div>
          <p className="text-sm font-medium text-slate-700">{c.phone}</p>
        </div>
      ))}
    </div>
  );
}
