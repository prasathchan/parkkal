export interface DrugSuggestion {
  name: string;
  defaultDosage?: string;
  defaultFrequency?: string;
  defaultDuration?: string;
}

export const DENTAL_DRUGS: DrugSuggestion[] = [
  // Antibiotics
  { name: "Amoxicillin 500mg", defaultDosage: "1 capsule", defaultFrequency: "1-1-1", defaultDuration: "5 days" },
  { name: "Amoxicillin 250mg", defaultDosage: "1 capsule", defaultFrequency: "1-1-1", defaultDuration: "5 days" },
  { name: "Amoxicillin + Clavulanate 625mg", defaultDosage: "1 tablet", defaultFrequency: "1-0-1", defaultDuration: "5 days" },
  { name: "Amoxicillin + Clavulanate 375mg", defaultDosage: "1 tablet", defaultFrequency: "1-1-1", defaultDuration: "5 days" },
  { name: "Azithromycin 500mg", defaultDosage: "1 tablet", defaultFrequency: "1-0-0", defaultDuration: "3 days" },
  { name: "Metronidazole 400mg", defaultDosage: "1 tablet", defaultFrequency: "1-1-1", defaultDuration: "5 days" },
  { name: "Metronidazole 200mg", defaultDosage: "1 tablet", defaultFrequency: "1-1-1", defaultDuration: "5 days" },
  { name: "Clindamycin 300mg", defaultDosage: "1 capsule", defaultFrequency: "1-1-1", defaultDuration: "7 days" },
  { name: "Doxycycline 100mg", defaultDosage: "1 capsule", defaultFrequency: "1-0-0", defaultDuration: "7 days" },
  { name: "Ciprofloxacin 500mg", defaultDosage: "1 tablet", defaultFrequency: "1-0-1", defaultDuration: "5 days" },
  { name: "Erythromycin 250mg", defaultDosage: "1 tablet", defaultFrequency: "1-1-1-1", defaultDuration: "5 days" },
  { name: "Tinidazole 500mg", defaultDosage: "2 tablets", defaultFrequency: "1-0-0", defaultDuration: "5 days" },
  { name: "Ornidazole 500mg", defaultDosage: "1 tablet", defaultFrequency: "1-0-1", defaultDuration: "5 days" },

  // Analgesics / NSAIDs
  { name: "Ibuprofen 400mg", defaultDosage: "1 tablet", defaultFrequency: "1-1-1", defaultDuration: "3 days" },
  { name: "Ibuprofen 600mg", defaultDosage: "1 tablet", defaultFrequency: "1-0-1", defaultDuration: "3 days" },
  { name: "Diclofenac 50mg", defaultDosage: "1 tablet", defaultFrequency: "1-1-1", defaultDuration: "3 days" },
  { name: "Diclofenac 75mg", defaultDosage: "1 tablet", defaultFrequency: "1-0-1", defaultDuration: "3 days" },
  { name: "Ketorolac 10mg", defaultDosage: "1 tablet", defaultFrequency: "1-1-1", defaultDuration: "5 days" },
  { name: "Naproxen 250mg", defaultDosage: "1 tablet", defaultFrequency: "1-0-1", defaultDuration: "3 days" },
  { name: "Naproxen 500mg", defaultDosage: "1 tablet", defaultFrequency: "1-0-1", defaultDuration: "3 days" },
  { name: "Aceclofenac 100mg", defaultDosage: "1 tablet", defaultFrequency: "1-0-1", defaultDuration: "3 days" },
  { name: "Nimesulide 100mg", defaultDosage: "1 tablet", defaultFrequency: "1-0-1", defaultDuration: "3 days" },
  { name: "Celecoxib 200mg", defaultDosage: "1 capsule", defaultFrequency: "1-0-1", defaultDuration: "3 days" },
  { name: "Etoricoxib 60mg", defaultDosage: "1 tablet", defaultFrequency: "1-0-0", defaultDuration: "3 days" },
  { name: "Etoricoxib 90mg", defaultDosage: "1 tablet", defaultFrequency: "1-0-0", defaultDuration: "3 days" },
  { name: "Mefenamic Acid 500mg", defaultDosage: "1 tablet", defaultFrequency: "1-1-1", defaultDuration: "3 days" },

  // Paracetamol combinations
  { name: "Paracetamol 500mg", defaultDosage: "1 tablet", defaultFrequency: "1-1-1", defaultDuration: "3 days" },
  { name: "Paracetamol 650mg", defaultDosage: "1 tablet", defaultFrequency: "1-1-1", defaultDuration: "3 days" },
  { name: "Paracetamol + Ibuprofen (Combiflan)", defaultDosage: "1 tablet", defaultFrequency: "1-1-1", defaultDuration: "3 days" },
  { name: "Paracetamol + Tramadol 37.5/325mg", defaultDosage: "1 tablet", defaultFrequency: "1-0-1", defaultDuration: "3 days" },

  // Corticosteroids
  { name: "Dexamethasone 0.5mg", defaultDosage: "2 tablets", defaultFrequency: "1-0-1", defaultDuration: "3 days" },
  { name: "Dexamethasone 4mg", defaultDosage: "1 tablet", defaultFrequency: "1-0-0", defaultDuration: "3 days" },
  { name: "Prednisolone 5mg", defaultDosage: "2 tablets", defaultFrequency: "1-0-0", defaultDuration: "5 days" },
  { name: "Methylprednisolone 4mg", defaultDosage: "1 tablet", defaultFrequency: "1-1-1", defaultDuration: "5 days" },
  { name: "Betamethasone 0.5mg", defaultDosage: "2 tablets", defaultFrequency: "1-0-1", defaultDuration: "3 days" },

  // Antifungals
  { name: "Fluconazole 150mg", defaultDosage: "1 capsule", defaultFrequency: "1-0-0", defaultDuration: "7 days" },
  { name: "Clotrimazole Gel", defaultDosage: "Apply thin layer", defaultFrequency: "TDS", defaultDuration: "7 days" },
  { name: "Nystatin Oral Suspension", defaultDosage: "5ml swish & swallow", defaultFrequency: "QID", defaultDuration: "14 days" },
  { name: "Miconazole Oral Gel", defaultDosage: "Apply to lesion", defaultFrequency: "QID", defaultDuration: "7 days" },

  // Antivirals
  { name: "Acyclovir 400mg", defaultDosage: "1 tablet", defaultFrequency: "1-1-1-1-1", defaultDuration: "5 days" },
  { name: "Acyclovir 200mg", defaultDosage: "1 tablet", defaultFrequency: "1-1-1-1-1", defaultDuration: "5 days" },
  { name: "Valacyclovir 500mg", defaultDosage: "1 tablet", defaultFrequency: "1-0-1", defaultDuration: "5 days" },

  // Antihistamines
  { name: "Cetirizine 10mg", defaultDosage: "1 tablet", defaultFrequency: "0-0-1", defaultDuration: "3 days" },
  { name: "Loratadine 10mg", defaultDosage: "1 tablet", defaultFrequency: "1-0-0", defaultDuration: "3 days" },
  { name: "Chlorphenamine 4mg", defaultDosage: "1 tablet", defaultFrequency: "1-1-1", defaultDuration: "3 days" },

  // GI / Stomach protection
  { name: "Omeprazole 20mg", defaultDosage: "1 capsule", defaultFrequency: "1-0-0", defaultDuration: "5 days" },
  { name: "Pantoprazole 40mg", defaultDosage: "1 tablet", defaultFrequency: "1-0-0", defaultDuration: "5 days" },
  { name: "Ranitidine 150mg", defaultDosage: "1 tablet", defaultFrequency: "1-0-1", defaultDuration: "5 days" },
  { name: "Domperidone 10mg", defaultDosage: "1 tablet", defaultFrequency: "1-1-1", defaultDuration: "3 days" },

  // Muscle relaxants
  { name: "Thiocolchicoside 4mg", defaultDosage: "1 tablet", defaultFrequency: "1-0-1", defaultDuration: "5 days" },
  { name: "Methocarbamol 750mg", defaultDosage: "1 tablet", defaultFrequency: "1-1-1", defaultDuration: "5 days" },

  // Local anaesthetic adjuncts
  { name: "Lignocaine 2% Gel", defaultDosage: "Apply to area", defaultFrequency: "SOS", defaultDuration: "As needed" },
  { name: "Benzocaine Gel 20%", defaultDosage: "Apply to area", defaultFrequency: "SOS", defaultDuration: "As needed" },

  // Vitamins / Supplements
  { name: "Vitamin C 500mg", defaultDosage: "1 tablet", defaultFrequency: "1-0-0", defaultDuration: "14 days" },
  { name: "Vitamin D3 60000 IU", defaultDosage: "1 capsule", defaultFrequency: "Once weekly", defaultDuration: "8 weeks" },
  { name: "Calcium + Vitamin D3", defaultDosage: "1 tablet", defaultFrequency: "1-0-1", defaultDuration: "30 days" },
  { name: "Zinc 50mg", defaultDosage: "1 tablet", defaultFrequency: "1-0-0", defaultDuration: "14 days" },

  // Mouthwashes / Topicals
  { name: "Chlorhexidine 0.2% Mouthwash", defaultDosage: "10ml rinse 30 sec", defaultFrequency: "BD", defaultDuration: "7 days" },
  { name: "Povidone-Iodine Mouthwash", defaultDosage: "10ml rinse", defaultFrequency: "TDS", defaultDuration: "5 days" },
  { name: "Benzydamine Mouthwash", defaultDosage: "15ml rinse", defaultFrequency: "TDS", defaultDuration: "7 days" },
  { name: "Hydrogen Peroxide 1.5% Mouthwash", defaultDosage: "10ml rinse", defaultFrequency: "BD", defaultDuration: "7 days" },
  { name: "Triamcinolone Acetonide Dental Paste", defaultDosage: "Apply thin film", defaultFrequency: "TDS + HS", defaultDuration: "7 days" },
  { name: "Dologel Gel", defaultDosage: "Apply to ulcer", defaultFrequency: "TDS", defaultDuration: "7 days" },
  { name: "Orajel Gel", defaultDosage: "Apply to area", defaultFrequency: "SOS", defaultDuration: "3 days" },
  { name: "Metronidazole Gel 0.75%", defaultDosage: "Apply to pocket", defaultFrequency: "OD", defaultDuration: "7 days" },
  { name: "Clindamycin Phosphate Gel 1%", defaultDosage: "Apply to pocket", defaultFrequency: "BD", defaultDuration: "7 days" },
];

export function searchDrugs(query: string, limit = 8): DrugSuggestion[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return DENTAL_DRUGS.filter((d) => d.name.toLowerCase().includes(q)).slice(0, limit);
}
