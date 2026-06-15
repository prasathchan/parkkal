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
    return <p className="text-center text-pk-text-muted text-sm py-6">No emergency contacts on file.</p>;
  }

  return (
    <div className="space-y-3">
      {contacts.map((c) => (
        <div key={c.id} className="flex items-start justify-between py-2 border-b border-pk-border last:border-0">
          <div>
            <p className="text-sm font-medium text-pk-text">{c.name}</p>
            <p className="text-xs text-pk-text-muted">{c.relationship}</p>
            {c.email && <p className="text-xs text-pk-text-muted">{c.email}</p>}
          </div>
          <p className="text-sm font-medium text-pk-text-secondary">{c.phone}</p>
        </div>
      ))}
    </div>
  );
}
