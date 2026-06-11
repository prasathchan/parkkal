export function exportPatients(): void {
  window.location.href = "/api/export?type=patients";
}

export function exportVisits(): void {
  window.location.href = "/api/export?type=visits";
}

export function exportTreatments(): void {
  window.location.href = "/api/export?type=treatments";
}
